import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");

describe("matchweek unlock control", () => {
  it("always permits unlock when a persisted day is locked", () => {
    expect(source).toContain("disabled={!isLocked && (!hasRun || fixtureCount === 0)}");
  });

  it("keeps lock unavailable until a non-empty schedule is built", () => {
    expect(source).toContain('"Build a fixture schedule before locking it"');
  });
});
