import { describe, expect, test } from "vitest";
import { scheduleSat } from "../../src/lib/scheduler.js";
import { buildEffectiveMatchdaySchedule } from "../../src/lib/domain/effectiveMatchdaySchedule.js";
import { resolveEffectiveAllocation } from "../../src/lib/domain/effectiveAllocation.js";
import { getFixtureOccupancy } from "../../src/lib/domain/fixtureOccupancy.js";
import { isPitchSuitableForFixture } from "../../src/lib/intelligence/pitch/pitchService.js";
import { buildReportsModel } from "../../src/lib/reports/reportingEngine.js";
import { mergeFixtureIntent } from "../../src/lib/domain/schedulingState.js";
import { validateProposedSchedule } from "../../src/lib/domain/scheduleTransaction.js";

describe("matchday consumer boundaries", () => {
  test.each([
    ["U16 Cheetahs", "11v11", "P1", 80],
    ["U12 Rockets", "9v9", "P3", 60],
  ])("retains the optimiser eligibility and occupancy for %s", (name, format, pitchId, gameMins) => {
    const pitches = [{ id: pitchId, format, label: pitchId }];
    const teams = [{ name, format, defaultPitch: pitchId, gameMins, halfTimeMins: 10, ageOrder: 1 }];
    const result = buildEffectiveMatchdaySchedule({
      providerFixtures: [{ canonicalFixtureIdentity: `url:${name}`, homeTeam: name, awayTeam: "Visitors", date: "2026-09-05", status: "active" }],
      scheduler: (fixtures) => scheduleSat(fixtures, false, [], teams, { [format]: 5 }, 480, 900, pitches, 3),
    });
    expect(result.safe).toBe(true);
    expect(result.scheduled).toHaveLength(1);
    const fixture = result.scheduled[0];
    expect(isPitchSuitableForFixture(pitches[0], fixture)).toBe(true);
    expect(getFixtureOccupancy({ fixture }).occupancyMins).toBe(gameMins + 15);
    expect(fixture.endMins - fixture.koMins).toBe(gameMins + 15);
  });

  test("a textual 11:45 move replaces the old numeric 10:45 allocation", () => {
    const moved = resolveEffectiveAllocation({
      fixture: { canonicalFixtureIdentity: "url:vulcans", cfg: { gameMins: 70 }, pitchId: "P4a", koTime: "10:45", koMins: 645, endMins: 730 },
      pendingPatch: { koTime: "11:45" },
    });
    expect(moved).toMatchObject({ koTime: "11:45", koMins: 705, endMins: 790 });
  });

  test("an unassigned null kick-off is not midnight", () => {
    expect(getFixtureOccupancy({ fixture: { koMins: null, koTime: "" } }).koMins).toBeNull();
  });

  test("editing persisted manual KO replaces its old numeric value and derived end before rehydration", () => {
    const intents = mergeFixtureIntent({ "url:vulcans": { allocation: { mode: "locked", pitchId: "P4a", koTime: "10:45", koMins: 645, endMins: 730 } } },
      "url:vulcans", { allocation: { mode: "locked", koTime: "11:45" } });
    const restored = JSON.parse(JSON.stringify(intents));
    expect(resolveEffectiveAllocation({ fixture: { cfg: { gameMins: 70 } }, intent: restored["url:vulcans"] }))
      .toMatchObject({ pitchId: "P4a", koTime: "11:45", koMins: 705, endMins: 790 });
  });

  test("a stored old end cannot shorten configured occupancy in validation", () => {
    const fixtures = [
      { canonicalFixtureIdentity: "url:a", pitchId: "P1", koMins: 485, koTime: "08:05", endMins: 545, cfg: { format: "11v11", gameMins: 70 }, occupancyTiming: { halfTimeMins: 10, turnaroundMins: 5 } },
      { canonicalFixtureIdentity: "url:b", pitchId: "P1", koMins: 565, koTime: "09:25", cfg: { format: "11v11", gameMins: 70 }, occupancyTiming: { halfTimeMins: 10, turnaroundMins: 5 } },
    ];
    expect(validateProposedSchedule({ fixtures, pitchCfg: [{ id: "P1", format: "11v11" }] }).blocking[0]?.type).toBe("pitch_clash");
    fixtures[1].koMins = 570; fixtures[1].koTime = "09:30";
    expect(validateProposedSchedule({ fixtures, pitchCfg: [{ id: "P1", format: "11v11" }] }).blocking).toEqual([]);
  });

  test("prints all 18 canonical fixtures even when every fixture shares one feed ID", () => {
    const fixtures = Array.from({ length: 18 }, (_, i) => ({
      canonicalFixtureIdentity: `url:fixture-${i}`, sourceId: "full-time-feed",
      homeTeam: `Home ${i}`, awayTeam: "Visitors", date: "2026-09-05",
      pitchId: "P1", koTime: "08:05", koMins: 485, endMins: 570, status: "active", format: "11v11",
    }));
    const report = buildReportsModel({
      scope: "saturday", reportType: "fixtures", source: "current",
      current: { satDate: "2026-09-05", satHasRun: true, satFinal: fixtures },
    });
    expect(report.activeFixtures).toHaveLength(18);
    expect(new Set(report.activeFixtures.map((row) => row.raw.canonicalFixtureIdentity)).size).toBe(18);
  });
});
