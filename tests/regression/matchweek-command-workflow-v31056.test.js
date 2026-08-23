import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const command = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");
const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("guided matchweek command workflow", () => {
  test("presents one six-stage route through matchweek operations", () => {
    ["Import", "Review", "Allocate", "Resolve", "Notify", "Lock"].forEach((stage) => {
      expect(command).toContain(`title: "${stage}"`);
    });
    expect(command).toContain("Next action");
  });

  test("routes primary actions to their owning specialist sections", () => {
    expect(page).toContain('onReview={() => openIntelligenceTarget("unresolved")}');
    expect(page).toContain('refWarnings > 0 ? "officialsIntelligence" : "pitchClosures"');
  });

  test("removes the duplicate fixture-summary surface without removing schedule detail", () => {
    expect(page).not.toContain('id: "summary"');
    expect(page).toContain('id: "schedule"');
    expect(page).toContain('id: "officialsIntelligence"');
    expect(page).toContain('id: "weatherIntelligence"');
  });
});
