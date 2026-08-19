import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const fetcher = readFileSync("src/hooks/useFixtureFetcher.js", "utf8");
const settings = readFileSync("src/components/Settings/IntegrationSettingsPanel.jsx", "utf8");

describe("Ground Control fixture imports use the configured referee pool", () => {
  test("does not request or expose the unsupported Full-Time referee page", () => {
    expect(fetcher).not.toContain("fetchRefereeAssignments");
    expect(fetcher).not.toContain("refereeSourceUrl");
    expect(settings).not.toContain("Full-Time referee assignments URL");
  });

  test("does not warn that Full-Time referee assignments are unavailable", () => {
    expect(appCore).not.toContain("Referee assignments unavailable");
    expect(appCore).not.toContain("unmatched officials remain TBC");
  });
});
