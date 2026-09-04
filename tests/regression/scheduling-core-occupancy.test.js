import { describe, expect, test } from "vitest";
import * as schedulingState from "../../src/lib/domain/schedulingState.js";
import { getFixtureDuration, validateFixtureUpdate } from "../../src/lib/engines/validationEngine.js";
import { pitchClashRule } from "../../src/lib/intelligence/pitch/pitchRules.js";
import { findOfficialConflicts } from "../../src/lib/engines/officialsEngine.js";

const fixtureIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=occupancy-u17";

describe("shared fixture occupancy and allocation", () => {
  test("exposes one explicit occupancy calculation for youth and adult timing", () => {
    expect(schedulingState).toMatchObject({
      getFixtureOccupancy: expect.any(Function),
    });

    expect(schedulingState.getFixtureOccupancy({
      fixture: { gameMins: 70, format: "11v11-youth", koMins: 600 },
      timing: { halfTimeMins: 10, youthTurnaroundMins: 15 },
    })).toMatchObject({
      playingMins: 70,
      halfTimeMins: 10,
      turnaroundMins: 15,
      occupancyMins: 95,
      endMins: 695,
    });

    expect(schedulingState.getFixtureOccupancy({
      fixture: { gameMins: 90, format: "11v11", koMins: 840 },
      timing: { adultTurnaroundMins: 30 },
    })).toMatchObject({
      playingMins: 90,
      halfTimeMins: 0,
      turnaroundMins: 30,
      occupancyMins: 120,
      endMins: 960,
    });
  });

  test("resolves one canonical allocation with pending Calendar intent taking precedence", () => {
    expect(schedulingState).toMatchObject({
      resolveEffectiveAllocation: expect.any(Function),
    });

    const effective = schedulingState.resolveEffectiveAllocation({
      fixture: {
        canonicalFixtureIdentity: fixtureIdentity,
        homeTeam: "HSM U17 Knights",
        awayTeam: "Visitors U17",
        gameMins: 80,
      },
      derivedAllocation: { pitchId: "P1", pitchLabel: "Pitch 1", koTime: "10:00", koMins: 600, endMins: 710 },
      intent: { allocation: { mode: "locked", pitchId: "P3", pitchLabel: "Pitch 3", koTime: "11:00", koMins: 660 } },
      pendingPatch: { pitchId: "P4", pitchLabel: "Pitch 4", koTime: "11:30", koMins: 690 },
      timing: { youthTurnaroundMins: 15 },
    });

    expect(effective).toMatchObject({
      canonicalFixtureIdentity: fixtureIdentity,
      pitchId: "P4",
      pitchLabel: "Pitch 4",
      koTime: "11:30",
      koMins: 690,
      endMins: 785,
    });
  });

  test("uses the same explicit timing policy for validation duration", () => {
    expect(getFixtureDuration(
      { gameMins: 70, format: "11v11-youth" },
      { youthHalfTimeMins: 10, youthTurnaroundMins: 15 },
    )).toBe(95);
  });

  test("adapts the existing matchday youth and adult buffer settings as turnaround", () => {
    expect(schedulingState.getFixtureOccupancy({
      fixture: { homeTeam: "HSM U15 Knights", gameMins: 70, koMins: 600 },
      timing: { bufferYouth: 18, bufferAdult: 42 },
    })).toMatchObject({ turnaroundMins: 18, endMins: 688 });

    expect(schedulingState.getFixtureOccupancy({
      fixture: { homeTeam: "HSM Firsts", teamType: "open age", gameMins: 90, koMins: 600 },
      timing: { bufferYouth: 18, bufferAdult: 42 },
    })).toMatchObject({ turnaroundMins: 42, endMins: 732 });
  });

  test("uses shared occupancy for pitch clashes and allows an exact handoff", () => {
    const fixtures = [{
      canonicalFixtureIdentity: fixtureIdentity,
      homeTeam: "HSM U17 Knights",
      pitchId: "P1",
      koTime: "10:00",
      koMins: 600,
      gameMins: 70,
      format: "11v11-youth",
      status: "active",
    }];
    const timing = { youthHalfTimeMins: 10, youthTurnaroundMins: 15 };

    expect(pitchClashRule({
      fixtures,
      fixtureIndex: 1,
      next: { ...fixtures[0], canonicalFixtureIdentity: "url:next", homeTeam: "HSM U17 Falcons", koTime: "11:35", koMins: 695 },
      pitchCfg: [{ id: "P1", label: "Pitch 1", format: "11v11-youth" }],
      timing,
    })).toBeNull();

    expect(pitchClashRule({
      fixtures,
      fixtureIndex: 1,
      next: { ...fixtures[0], canonicalFixtureIdentity: "url:next", homeTeam: "HSM U17 Falcons", koTime: "11:34", koMins: 694 },
      pitchCfg: [{ id: "P1", label: "Pitch 1" }],
      timing,
    })).toMatchObject({ type: "pitch_clash" });
  });

  test("passes club timing through the normal validation path", () => {
    const fixtures = [
      {
        canonicalFixtureIdentity: fixtureIdentity,
        homeTeam: "HSM U17 Knights",
        pitchId: "P1",
        koTime: "10:00",
        koMins: 600,
        gameMins: 70,
        format: "11v11-youth",
        status: "active",
      },
      {
        canonicalFixtureIdentity: "url:https://fulltime.thefa.com/displayfixture.html?id=occupancy-falcons",
        homeTeam: "HSM U17 Falcons",
        pitchId: "P1",
        koTime: "12:00",
        koMins: 720,
        gameMins: 70,
        format: "11v11-youth",
        status: "active",
      },
    ];

    expect(validateFixtureUpdate({
      fixtures,
      fixtureIndex: 1,
      patch: { koTime: "11:34", koMins: 694 },
      pitchCfg: [{ id: "P1", label: "Pitch 1", format: "11v11-youth" }],
      club: { timingSettings: { latestYouthKickOff: "14:00", youthHalfTimeMins: 10, youthTurnaroundMins: 15 } },
      validateParking: false,
    })).toMatchObject({ ok: false, type: "pitch_clash" });
  });

  test("uses shared occupancy for official conflicts", () => {
    const fixtures = [
      {
        canonicalFixtureIdentity: fixtureIdentity,
        homeTeam: "HSM U17 Knights",
        referee: "Canonical Ref",
        refStatus: "confirmed",
        koTime: "10:00",
        koMins: 600,
        gameMins: 70,
        format: "11v11-youth",
        status: "active",
      },
      {
        canonicalFixtureIdentity: "url:https://fulltime.thefa.com/displayfixture.html?id=official-falcons",
        homeTeam: "HSM U17 Falcons",
        referee: "Canonical Ref",
        refStatus: "confirmed",
        koTime: "11:34",
        koMins: 694,
        gameMins: 70,
        format: "11v11-youth",
        status: "active",
      },
    ];

    expect(findOfficialConflicts(fixtures, [], {
      youthHalfTimeMins: 10,
      youthTurnaroundMins: 15,
    })).toHaveLength(1);
  });
});
