import { describe, expect, it } from "vitest";
import {
  postponeFixture,
  restoreFixture,
} from "../../src/lib/domain/fixtureLifecycle.js";
import { applyFixtureOverrides, mergeFixtureScheduleResults, shouldApplyFixtureImport } from "../../src/lib/domain/fixtureVenueFlow.js";
import * as venueFlow from "../../src/lib/domain/fixtureVenueFlow.js";
import { scheduleSat } from "../../src/lib/scheduler.js";
import { TEAM_CONFIG_DEFAULT } from "../../src/lib/constants.js";
import { clonePitches } from "./fixtures.js";

const fixture = {
  id: "fixture-1",
  date: "2026-09-05",
  pitchId: "P1",
  pitchLabel: "Pitch 1",
  koMins: 600,
  koTime: "10:00",
  status: "active",
};

describe("fixture postponement lifecycle", () => {
  it("does not replay an invalid old allocation after the optimiser has replaced it", () => {
    const imported = [
      { sourceFixtureKey: "first", homeTeam: "U13 Locomotives", awayTeam: "Visitors", status: "active" },
      { sourceFixtureKey: "restored", homeTeam: "U13 Vulcans", awayTeam: "Other Visitors", status: "active" },
    ];
    const overrides = {
      0: { fixtureIdentity: "first", pitchId: "P3", koMins: 540, koTime: "09:00", endMins: 625 },
      1: { fixtureIdentity: "restored", status: "active", pitchId: "P3", koMins: 540, koTime: "09:00", endMins: 625 },
    };
    const all = applyFixtureOverrides(imported, overrides);
    const result = scheduleSat(all, false, [], TEAM_CONFIG_DEFAULT, { "9v9": 15 }, 540, 960, clonePitches(), 4);
    expect(result.unresolved).toHaveLength(0);
    const displayed = applyFixtureOverrides(result.scheduled, overrides, { preserveValidatedAllocation: true });
    const [a, b] = displayed;
    expect(a.pitchId !== b.pitchId || a.koMins >= b.endMins || b.koMins >= a.endMins).toBe(true);
  });

  it("keeps the optimiser's new allocation after restoring a fixture without its now-occupied old slot", () => {
    const imported = [{ sourceFixtureKey: "restored", homeTeam: "U13 Vulcans", awayTeam: "Visitors", status: "active" }];
    const overrides = { 0: { fixtureIdentity: "restored", status: "active", pitchId: "", pitchLabel: "", koMins: null, koTime: "", endMins: null } };
    const result = scheduleSat(applyFixtureOverrides(imported, overrides), false, [], TEAM_CONFIG_DEFAULT, { "9v9": 15 }, 540, 960, clonePitches(), 4);
    const displayed = applyFixtureOverrides(result.scheduled, overrides, { preserveValidatedAllocation: true });
    expect(displayed[0].pitchId).toBeTruthy();
    expect(Number.isFinite(displayed[0].koMins)).toBe(true);
    const edited = venueFlow.updateFixtureOverride(overrides, 0, "koMins", 720, "restored");
    expect(applyFixtureOverrides(result.scheduled, edited, { preserveValidatedAllocation: true })[0].koMins).toBe(720);
  });

  it("runs the real allocator repeatedly with two fixtures per team without spreading postponements or losing cup games", () => {
    const imported = [
      { sourceFixtureKey: "30598191", homeTeam: "U13 Locomotives", awayTeam: "Cherrybrook", status: "active" },
      { sourceFixtureKey: "30951160", homeTeam: "U13 Locomotives", awayTeam: "Winton Rangers", status: "active" },
      { sourceFixtureKey: "30721968", homeTeam: "U13 Vulcans", awayTeam: "Winton Spiders", status: "active" },
      { sourceFixtureKey: "30951176", homeTeam: "U13 Vulcans", awayTeam: "Woodbank", status: "active" },
    ];
    const allocate = (rows) => scheduleSat(rows, false, [], TEAM_CONFIG_DEFAULT, { "9v9": 15 }, 540, 960, clonePitches(), 4);
    const first = allocate(imported);
    expect(first.unresolved).toHaveLength(0);
    let overrides = {};
    for (const identity of ["30598191", "30721968"]) {
      const index = first.scheduled.findIndex((row) => row.sourceFixtureKey === identity);
      overrides = venueFlow.updateFixtureOverride(overrides, index, "status", "postponed", identity);
    }
    for (let rebuild = 0; rebuild < 20; rebuild += 1) {
      const all = applyFixtureOverrides(imported, overrides);
      const result = allocate(all);
      expect(result.unresolved).toHaveLength(0);
      const displayed = applyFixtureOverrides(mergeFixtureScheduleResults(all, result.scheduled), overrides);
      expect(displayed).toHaveLength(4);
      const active = displayed.filter((row) => row.status === "active");
      expect(active.map((row) => row.sourceFixtureKey).sort()).toEqual(["30951160", "30951176"]);
      expect(active.every((row) => row.pitchId && Number.isFinite(row.koMins))).toBe(true);
      for (const a of active) for (const b of active) {
        if (a === b || a.pitchId !== b.pitchId) continue;
        expect(a.koMins >= b.endMins || b.koMins >= a.endMins).toBe(true);
      }
    }
  });

  it("keeps independent overrides when a different fixture takes the same displayed position", () => {
    let overrides = { 0: { fixtureIdentity: "knights-1", status: "postponed", postponement: { reason: "weather" } } };
    overrides = venueFlow.updateFixtureOverride(overrides, 0, "pitchId", "P2", "cobras-1");
    overrides = venueFlow.updateFixtureOverride(overrides, 3, "koMins", 660, "cobras-1");
    overrides = venueFlow.updateFixtureOverride(overrides, 2, "status", "active", "knights-1");
    const result = applyFixtureOverrides([
      { ...fixture, sourceFixtureKey: "cobras-1" },
      { ...fixture, sourceFixtureKey: "knights-1" },
    ], JSON.parse(JSON.stringify(overrides)));
    expect(result[0]).toMatchObject({ status: "active", pitchId: "P2", koMins: 660 });
    expect(result[0].postponement).toBeUndefined();
    expect(result[1]).toMatchObject({ status: "active", pitchId: "P1", koMins: 600, postponement: { reason: "weather" } });
  });

  it("postpones only the selected source fixtures after schedule order changes and repeated rebuilds", () => {
    const imported = ["knights-1", "knights-2", "cobras-1", "cobras-2"].map((key) => ({
      ...fixture, sourceFixtureKey: key, id: key,
      homeTeam: key.startsWith("knights") ? "U15 Knights" : "U15 Cobras",
    }));
    // The optimiser has sorted the selected fixtures to positions 0 and 1.
    const overrides = {
      0: { fixtureIdentity: "knights-2", status: "postponed" },
      1: { fixtureIdentity: "cobras-2", status: "postponed" },
    };
    for (let rebuild = 0; rebuild < 20; rebuild += 1) {
      const all = applyFixtureOverrides(imported, overrides);
      const scheduled = all.filter((row) => row.status === "active").reverse();
      const rebuilt = mergeFixtureScheduleResults(all, scheduled);
      const displayed = applyFixtureOverrides(rebuilt, overrides);
      expect(displayed).toHaveLength(4);
      expect(displayed.filter((row) => row.status === "active").map((row) => row.id).sort())
        .toEqual(["cobras-1", "knights-1"]);
      expect(displayed.filter((row) => row.status === "postponed").map((row) => row.id).sort())
        .toEqual(["cobras-2", "knights-2"]);
    }
  });

  it("requires a recognised reason and retains the original allocation", () => {
    expect(() => postponeFixture(fixture, { reason: "" })).toThrow(/reason/i);
    const result = postponeFixture(fixture, {
      reason: "weather",
      note: "Standing water",
      actor: "Club owner",
      now: "2026-09-04T18:00:00.000Z",
    });

    expect(result).toMatchObject({ status: "postponed" });
    expect(result.postponement).toMatchObject({
      reason: "weather",
      note: "Standing water",
      actor: "Club owner",
      recordedAt: "2026-09-04T18:00:00.000Z",
      originalDate: "2026-09-05",
      originalPitchId: "P1",
      originalPitchLabel: "Pitch 1",
      originalKoMins: 600,
      originalKoTime: "10:00",
    });
  });

  it("restores the original allocation without deleting postponement history", () => {
    const postponed = postponeFixture(fixture, { reason: "weather", now: "2026-09-04T18:00:00.000Z" });
    const restored = restoreFixture(postponed, { actor: "Club owner", now: "2026-09-05T07:00:00.000Z" });

    expect(restored).toMatchObject({ status: "active", pitchId: "P1", koMins: 600 });
    expect(restored.postponement).toMatchObject({ restoredAt: "2026-09-05T07:00:00.000Z", restoredBy: "Club owner" });
  });

  it("does not fan one stable override out to duplicate records", () => {
    const rows = [
      { ...fixture, id: "fixture-a", sourceFixtureKey: "source-duplicate", status: "active" },
      { ...fixture, id: "fixture-b", sourceFixtureKey: "source-duplicate", status: "active", koTime: "10:15", koMins: 615 },
    ];

    const result = applyFixtureOverrides(rows, {
      0: { fixtureIdentity: "source-duplicate", status: "postponed" },
    });

    expect(result[0].status).toBe("postponed");
    expect(result[1].status).toBe("active");
  });

  it("keeps postponed fixtures in the rebuilt schedule without booking them", () => {
    const active = { ...fixture, id: "active", sourceFixtureKey: "active" };
    const postponed = { ...fixture, id: "postponed", sourceFixtureKey: "postponed", status: "postponed" };

    const result = mergeFixtureScheduleResults(
      [active, postponed],
      [{ ...active, pitchId: "P1" }],
      [],
    );

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(expect.objectContaining({ id: "postponed", status: "postponed" }));
    expect(result.filter((row) => row.id === "postponed")).toHaveLength(1);
  });

  it("does not replace an existing schedule with a partial or empty import", () => {
    const existing = [{ ...fixture, sourceFixtureKey: "existing" }];

    expect(shouldApplyFixtureImport({ fixtures: [], partial: true, existing })).toBe(false);
    expect(shouldApplyFixtureImport({ fixtures: [], partial: false, existing })).toBe(false);
    expect(shouldApplyFixtureImport({ fixtures: [{ ...fixture }], partial: false, existing })).toBe(true);
    expect(shouldApplyFixtureImport({ fixtures: [], partial: false, existing: [] })).toBe(true);
  });
});
