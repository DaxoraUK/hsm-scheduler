import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");

describe("Ground Control v3.10.7.1 Annual Planner navigation layout", () => {
  it("removes the cramped seven-column workspace bar", () => {
    expect(page).not.toContain("xl:grid-cols-7");
    expect(page).toContain("md:grid-cols-2 lg:grid-cols-4");
  });

  it("uses readable section cards with a clear workspace heading", () => {
    expect(page).toContain("Workspace sections");
    expect(page).toContain("min-h-[108px]");
    expect(page).toContain('aria-current={tab === key ? "page" : undefined}');
  });

  it("keeps all seven Annual Planner destinations available", () => {
    for (const label of ["Calendar", "Bookings", "Requests", "Availability", "Winter sites", "Smart allocation", "Insights"]) {
      expect(page).toContain(`\"${label}\"`);
    }
  });
});
