import { describe, expect, test } from "vitest";
import { scheduleSat } from "../../src/lib/scheduler.js";

const pitches = [
  { id: "P1", label: "Pitch 1", format: "7v7" },
  { id: "P2", label: "Pitch 2", format: "7v7" },
];
const teams = [
  { name: "Flexible U10", teamType: "youth", format: "7v7", defaultPitch: "P1", altPitch: "P2", ageOrder: 1, gameMins: 50 },
  { name: "Restricted U10", teamType: "youth", format: "7v7", defaultPitch: "P1", ageOrder: 2, gameMins: 50 },
];

function optimise(fixtures) {
  return scheduleSat(fixtures, false, [], teams, { "7v7": 15 }, 9 * 60, 10 * 60, pitches, 3);
}

describe("deterministic locked-first matchday optimiser", () => {
  test("chooses a deterministic valid arrangement across repeated rebuilds", () => {
    const fixtures = [
      { canonicalFixtureIdentity: "url:flexible", homeTeam: "Flexible U10", awayTeam: "Visitors", status: "active" },
      { canonicalFixtureIdentity: "url:restricted", homeTeam: "Restricted U10", awayTeam: "Visitors", status: "active" },
    ];
    const first = optimise(fixtures);
    const output = Array.from({ length: 10 }, () => optimise(fixtures)).map((result) => result.scheduled.map((fixture) => ({
      identity: fixture.canonicalFixtureIdentity,
      pitchId: fixture.pitchId,
      koMins: fixture.koMins,
    })));

    expect(first.unresolved).toEqual([]);
    expect(output.every((result) => JSON.stringify(result) === JSON.stringify(output[0]))).toBe(true);
  });

  test("does not silently move conflicting explicit locks", () => {
    const locks = [
      {
        canonicalFixtureIdentity: "url:locked-a",
        homeTeam: "Flexible U10",
        awayTeam: "Visitors",
        status: "active",
        lockedAllocation: { pitchId: "P1", koTime: "09:00", koMins: 540 },
      },
      {
        canonicalFixtureIdentity: "url:locked-b",
        homeTeam: "Flexible U10",
        awayTeam: "Visitors",
        status: "active",
        lockedAllocation: { pitchId: "P1", koTime: "09:00", koMins: 540 },
      },
    ];
    const result = optimise(locks);
    const reordered = optimise([...locks].reverse());

    expect(result.scheduled).toHaveLength(1);
    expect(result.unresolved).toContainEqual(expect.objectContaining({
      canonicalFixtureIdentity: "url:locked-b",
      reason: expect.stringMatching(/locked allocation/i),
    }));
    expect(result.scheduled[0].canonicalFixtureIdentity).toBe("url:locked-a");
    expect(reordered.scheduled[0].canonicalFixtureIdentity).toBe("url:locked-a");
  });
});
