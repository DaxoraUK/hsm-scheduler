import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");

describe("direct matchweek publication control", () => {
  it("does not expose an obsolete scheduling lock", () => {
    expect(source).not.toContain("isLocked");
  });

  it("keeps publication unavailable until a non-empty schedule is built", () => {
    expect(source).toContain("disabled={!hasRun || blockingCount > 0 || !canPublish}");
  });
});
