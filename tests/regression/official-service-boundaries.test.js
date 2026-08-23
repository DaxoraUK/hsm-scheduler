import { describe, expect, test } from "vitest";
import {
  findOfficialClash,
  fixturesOverlap,
  hasNamedOfficial,
  normaliseOfficialName,
} from "../../src/lib/intelligence/officials/officialService.js";

function fixture(overrides = {}) {
  return {
    status: "scheduled",
    referee: "Alex Referee",
    refStatus: "confirmed",
    koMins: 600,
    gameMins: 60,
    ...overrides,
  };
}

describe("official clash boundaries", () => {
  test("normalises names and rejects placeholder officials", () => {
    expect(normaliseOfficialName("  A. Referee  ")).toBe("a referee");
    expect(hasNamedOfficial(fixture({ referee: "TBC" }))).toBe(false);
    expect(hasNamedOfficial(fixture({ referee: "Unassigned" }))).toBe(false);
  });

  test("does not enforce clashes for volunteer and parent officials", () => {
    expect(hasNamedOfficial(fixture({ referee: "Parent referee" }))).toBe(false);
    expect(hasNamedOfficial(fixture({ referee: "Club Volunteer" }))).toBe(false);
  });

  test("allows adjacent appointments but detects genuine overlap", () => {
    const first = fixture({ koMins: 600, gameMins: 60 });
    expect(fixturesOverlap(first, fixture({ koMins: 675 }))).toBe(false);
    expect(fixturesOverlap(first, fixture({ koMins: 674 }))).toBe(true);
  });

  test("ignores the edited fixture and inactive fixtures", () => {
    const current = fixture();
    const postponed = fixture({ status: "postponed", koMins: 620 });
    expect(findOfficialClash({ fixtures: [current, postponed], fixtureIndex: 0, next: current })).toBeNull();
  });

  test("returns the conflicting active appointment", () => {
    const existing = fixture({ koMins: 630 });
    const next = fixture({ koMins: 600 });
    expect(findOfficialClash({ fixtures: [existing], fixtureIndex: -1, next })).toBe(existing);
  });
});
