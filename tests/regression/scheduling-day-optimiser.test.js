import { describe, expect, test } from "vitest";
import { scheduleSat } from "../../src/lib/scheduler.js";

const twoYouthPitches = [
  { id: "P1", label: "Pitch 1", format: "7v7" },
  { id: "P2", label: "Pitch 2", format: "7v7" },
];

describe("deterministic whole-day scheduling", () => {
  test("uses the alternative allocation so a greedy first choice does not make another fixture unresolved", () => {
    const result = scheduleSat(
      [
        { canonicalFixtureIdentity: "url:flexible", homeTeam: "Flexible U10", awayTeam: "Visitors", status: "active" },
        { canonicalFixtureIdentity: "url:restricted", homeTeam: "Restricted U10", awayTeam: "Visitors", status: "active" },
      ],
      false,
      [],
      [
        { name: "Flexible U10", teamType: "youth", format: "7v7", defaultPitch: "P1", altPitch: "P2", ageOrder: 1, gameMins: 50 },
        { name: "Restricted U10", teamType: "youth", format: "7v7", defaultPitch: "P1", ageOrder: 2, gameMins: 50 },
      ],
      { "7v7": 15 },
      9 * 60,
      9 * 60,
      twoYouthPitches,
      3,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.scheduled).toEqual(expect.arrayContaining([
      expect.objectContaining({ homeTeam: "Restricted U10", pitchId: "P1" }),
      expect.objectContaining({ homeTeam: "Flexible U10", pitchId: "P2" }),
    ]));
  });

  test("classifies an Open Age team from its configured category, not 11v11 format or pitch preference", () => {
    const result = scheduleSat(
      [{ canonicalFixtureIdentity: "url:open-age", homeTeam: "Saturday Firsts", awayTeam: "Visitors", status: "active" }],
      false,
      [],
      [{ name: "Saturday Firsts", teamType: "open age", format: "11v11", defaultPitch: "P1", ageOrder: 1, gameMins: 90 }],
      { "11v11": 30 },
      8 * 60 + 30,
      16 * 60,
      [{ id: "P1", label: "Pitch 1", format: "11v11" }],
      3,
    );

    expect(result.unresolved).toEqual([]);
    expect(result.scheduled[0]).toMatchObject({ koTime: "14:00", fixedKO: true });
  });

  test("uses the shared playing, half-time and turnaround occupancy for allocations", () => {
    const result = scheduleSat(
      [{ canonicalFixtureIdentity: "url:timed", homeTeam: "Timed U13", awayTeam: "Visitors", status: "active" }],
      false,
      [],
      [{ name: "Timed U13", teamType: "youth", format: "7v7", defaultPitch: "P1", ageOrder: 1, gameMins: 50, halfTimeMins: 5 }],
      { "7v7": 15 },
      9 * 60,
      11 * 60,
      [{ id: "P1", label: "Pitch 1", format: "7v7" }],
      3,
    );

    expect(result.scheduled[0]).toMatchObject({ koMins: 540, endMins: 610 });
  });
});
