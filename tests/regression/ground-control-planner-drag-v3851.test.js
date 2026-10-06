import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plannerSource = readFileSync("src/components/Operations/shared/MatchdayTimelineCard.jsx", "utf8");

describe("Ground Control v3.8.5.1 whole-card planner dragging", () => {
  it("retains keyboard-accessible fixture cards and touch interaction styling", () => {
    expect(plannerSource).toContain('role="button"');
    expect(plannerSource).toContain('tabIndex={0}');
    expect(plannerSource).toContain('Press Enter for details.');
    expect(plannerSource).toContain("touch-none select-none");
  });

  it("shows an explicit locked schedule state instead of silently disabling movement", () => {
    expect(plannerSource).toContain("Schedule locked — unlock it to move fixtures");
    expect(plannerSource).toContain("Drag any fixture card or select it");
  });
});
