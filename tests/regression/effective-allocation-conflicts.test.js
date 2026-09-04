import { describe, expect, test } from "vitest";
import { findEffectiveAllocationConflicts } from "../../src/lib/domain/allocationConflicts.js";

const pitchCfg = [
  { id: "P1", label: "Pitch 1" },
  { id: "P1a", label: "Pitch 1A", innerOf: "P1" },
  { id: "P2", label: "Pitch 2" },
];

describe("final effective allocation conflict detector", () => {
  test("uses the final allocation, so a vacated slot has no stale conflict", () => {
    const conflicts = findEffectiveAllocationConflicts({
      pitchCfg,
      fixtures: [
        { canonicalFixtureIdentity: "url:a", pitchId: "P3", koMins: 600, endMins: 675 },
        { canonicalFixtureIdentity: "url:b", pitchId: "P1", koMins: 600, endMins: 675 },
      ],
    });

    expect(conflicts).toEqual([]);
  });

  test("allows an exact occupancy boundary and blocks a linked-pitch overlap", () => {
    expect(findEffectiveAllocationConflicts({
      pitchCfg,
      fixtures: [
        { canonicalFixtureIdentity: "url:a", pitchId: "P1", koMins: 600, endMins: 675 },
        { canonicalFixtureIdentity: "url:b", pitchId: "P1", koMins: 675, endMins: 750 },
      ],
    })).toEqual([]);

    const conflicts = findEffectiveAllocationConflicts({
      pitchCfg,
      fixtures: [
        { canonicalFixtureIdentity: "url:a", pitchId: "P1", koMins: 600, endMins: 675 },
        { canonicalFixtureIdentity: "url:b", pitchId: "P1a", koMins: 670, endMins: 745 },
      ],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].canonicalFixtureIdentities).toEqual(["url:a", "url:b"]);
  });
});
