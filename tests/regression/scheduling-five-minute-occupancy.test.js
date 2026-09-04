import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  SCHEDULING_TIME_INCREMENT_MINS,
  classifyFixtureAgeCategory,
  getFixtureOccupancy,
} from "../../src/lib/domain/fixtureOccupancy.js";
import { buildTimelineMovePatch, snapTimelineMinutes } from "../../src/lib/engines/timelineDragEngine.js";

describe("five-minute scheduling and shared occupancy", () => {
  test("classifies U17 as Youth and only explicit adult categories as Adult", () => {
    expect(classifyFixtureAgeCategory({ homeTeam: "HSM U17 Knights", format: "11v11" })).toBe("youth");
    expect(classifyFixtureAgeCategory({ homeTeam: "HSM U16 Falcons", format: "11v11" })).toBe("youth");
    expect(classifyFixtureAgeCategory({ homeTeam: "HSM U15 Cobras", format: "11v11" })).toBe("youth");
    expect(classifyFixtureAgeCategory({ homeTeam: "HSM First Team", teamType: "open_age", format: "11v11" })).toBe("adult");
    expect(classifyFixtureAgeCategory({ homeTeam: "HSM First Team", format: "11v11" })).toBe("unknown");
  });

  test("uses explicit playing, half-time and turnaround values for five-minute occupancy", () => {
    expect(SCHEDULING_TIME_INCREMENT_MINS).toBe(5);
    expect(getFixtureOccupancy({
      fixture: { homeTeam: "HSM U17 Knights", gameMins: 70, koMins: 8 * 60 + 5 },
      timing: { youthHalfTimeMins: 10, youthTurnaroundMins: 5 },
    })).toMatchObject({
      playingMins: 70,
      halfTimeMins: 10,
      turnaroundMins: 5,
      occupancyMins: 85,
      endMins: 570,
    });
  });

  test("keeps a five-minute Calendar move exact instead of rounding it to a quarter hour", () => {
    const patch = buildTimelineMovePatch({
      fixture: { homeTeam: "HSM U15 Cobras", gameMins: 60 },
      pitch: { id: "P2", label: "Pitch 2" },
      koMins: 8 * 60 + 5,
    });

    expect(snapTimelineMinutes(8 * 60 + 5)).toBe(8 * 60 + 5);
    expect(patch).toMatchObject({
      pitchId: "P2",
      koMins: 8 * 60 + 5,
      koTime: "08:05",
    });
  });

  test("does not leave quarter-hour candidate generation in scheduler, recommendations, Resolution Centre or resource calculations", () => {
    const schedulingSources = [
      "src/lib/scheduler.js",
      "src/lib/engines/recommendationEngine.js",
      "src/lib/engines/dayOptimiserEngine.js",
      "src/lib/engines/resourceAllocationEngine.js",
      "src/lib/intelligence/parking/parkingService.js",
      "src/components/Operations/shared/MatchdayUnresolvedCard.jsx",
    ].map((path) => readFileSync(path, "utf8"));

    schedulingSources.forEach((source) => {
      expect(source).not.toMatch(/for\s*\([^)]*\+=\s*15\b/);
      expect(source).not.toMatch(/interval\s*[=:]\s*15\b/);
    });
  });
});
