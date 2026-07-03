import { describe, expect, test } from "vitest";
import { scheduleFixtureDay, scheduleSat } from "../../src/lib/scheduler.js";
import {
  getAvailablePitchSuggestions,
  getNextAvailableTimes,
  getValidatedFixRecommendations,
} from "../../src/lib/engines/recommendationEngine.js";
import { TEAM_CONFIG_DEFAULT } from "../../src/lib/constants.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

const buffers = {
  "3v3": 15,
  "5v5": 15,
  "7v7": 15,
  "9v9": 15,
  "11v11-youth": 30,
  "11v11-small": 30,
  "11v11": 30,
};

describe("fixture scheduling regressions", () => {
  test("closed preferred pitches are excluded from automatic scheduling", () => {
    const result = scheduleSat(
      [{ homeTeam: "U10 Wanderers", awayTeam: "Visitors", status: "active" }],
      false,
      ["P3a"],
      TEAM_CONFIG_DEFAULT,
      buffers,
      8 * 60 + 30,
      11 * 60 + 30,
      clonePitches(),
      3
    );

    expect(result.unresolved).toHaveLength(0);
    expect(result.scheduled[0].pitchId).not.toBe("P3a");
  });

  test("weekend adult fixtures retain the fixed 14:00 rule", () => {
    const result = scheduleSat(
      [{ homeTeam: "HSM 1st Team", awayTeam: "Visitors", status: "active" }],
      false,
      [],
      TEAM_CONFIG_DEFAULT,
      buffers,
      8 * 60 + 30,
      11 * 60 + 30,
      clonePitches(),
      3
    );

    expect(result.unresolved).toHaveLength(0);
    expect(result.scheduled[0].koTime).toBe("14:00");
    expect(result.scheduled[0].fixedKO).toBe(true);
  });

  test("midweek adult scheduling uses the selected evening window instead of the weekend fixed time", () => {
    const result = scheduleFixtureDay({
      dayKey: "midweek",
      fixtures: [{ homeTeam: "HSM 1st Team", awayTeam: "Visitors", status: "active" }],
      closedPitches: [],
      cfgList: TEAM_CONFIG_DEFAULT,
      bufMap: buffers,
      startMins: 18 * 60,
      endMins: 21 * 60 + 30,
      pitchCfg: clonePitches(),
      maxConcurrent: 3,
      rules: { fixedAdultKickOffMins: null },
    });

    expect(result.unresolved).toHaveLength(0);
    expect(result.scheduled[0].koTime).toBe("18:00");
    expect(result.scheduled[0].fixtureDayKey).toBe("midweek");
  });

  test("unknown teams remain unresolved rather than receiving an invented format", () => {
    const result = scheduleSat(
      [{ homeTeam: "Unknown Team", awayTeam: "Visitors", status: "active" }],
      false,
      [],
      TEAM_CONFIG_DEFAULT,
      buffers,
      8 * 60 + 30,
      11 * 60 + 30,
      clonePitches(),
      3
    );

    expect(result.scheduled).toHaveLength(0);
    expect(result.unresolved[0].reason).toContain("Team not in config");
  });
});

describe("validated recommendations", () => {
  test("adult recommendation searches can extend beyond the youth cut-off", () => {
    const adult = makeFixture({ pitchId: "P1", koTime: "09:00", koMins: 540 });
    const youth = makeFixture({
      id: "youth",
      homeTeam: "U14 Spartans",
      format: "11v11-youth",
      pitchId: "P4",
      koTime: "09:00",
      koMins: 540,
      gameMins: 70,
      extra: { cfg: { name: "U14 Spartans", format: "11v11-youth", ageOrder: 7, gameMins: 70 } },
    });
    const club = makeClub({ parkingEnabled: false });

    const adultTimes = getNextAvailableTimes({
      fixtures: [adult],
      fixtureIndex: 0,
      pitchCfg: clonePitches(),
      start: "12:00",
      end: "16:00",
      club,
    });
    const youthTimes = getNextAvailableTimes({
      fixtures: [youth],
      fixtureIndex: 0,
      pitchCfg: clonePitches(),
      start: "12:00",
      end: "16:00",
      club,
    });

    expect(adultTimes.length).toBeGreaterThan(0);
    expect(adultTimes[0] >= "12:00").toBe(true);
    expect(youthTimes).toEqual([]);
  });

  test("pitch suggestions exclude closed and unsuitable pitches", () => {
    const fixtures = [
      makeFixture({ id: "moving", pitchId: "P1", koTime: "09:00", koMins: 540 }),
      makeFixture({ id: "clash", pitchId: "P1", koTime: "09:00", koMins: 540 }),
    ];
    const suggestions = getAvailablePitchSuggestions({
      fixtures,
      fixtureIndex: 0,
      pitchCfg: clonePitches(),
      next: fixtures[0],
      koTime: "09:00",
      closedPitches: ["P1"],
      club: makeClub({ parkingEnabled: false }),
    });

    expect(suggestions.map((item) => item.pitchId)).toContain("P2");
    expect(suggestions.map((item) => item.pitchId)).not.toContain("P1");
    expect(suggestions.map((item) => item.pitchId)).not.toContain("P4");
  });

  test("parking recommendations reduce the whole-day peak and remain fully valid", () => {
    const fixtures = [
      makeFixture({ id: "a", pitchId: "P1", koTime: "09:00", koMins: 540 }),
      makeFixture({ id: "b", pitchId: "P2", koTime: "09:00", koMins: 540 }),
    ];
    const recommendations = getValidatedFixRecommendations({
      fixtures,
      fixtureIndex: 1,
      pitchCfg: clonePitches(),
      closedPitches: [],
      club: makeClub({ capacity: 57 }),
      start: "08:30",
      end: "17:00",
      allowParkingImprovement: true,
    });

    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].reduction).toBeGreaterThan(0);
    expect(recommendations[0].parkingAfter.isOverCapacity).toBe(false);
    expect(recommendations[0].validation.ok).toBe(true);
  });
});
