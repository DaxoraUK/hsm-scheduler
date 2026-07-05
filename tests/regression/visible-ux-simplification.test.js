import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const dashboardSource = readFileSync(
  new URL("../../src/pages/DashboardPage.jsx", import.meta.url),
  "utf8"
);
const missionHeroSource = readFileSync(
  new URL("../../src/components/dashboard/DashboardMissionHero.jsx", import.meta.url),
  "utf8"
);
const operationsSource = readFileSync(
  new URL("../../src/pages/OperationsPage.jsx", import.meta.url),
  "utf8"
);
const dayTabsSource = readFileSync(
  new URL("../../src/components/Operations/DayTabs.jsx", import.meta.url),
  "utf8"
);

describe("visible UX simplification", () => {
  test("removes promotional duplicate cards from Mission Control", () => {
    expect(dashboardSource).not.toContain("DashboardInsightGrid");
    expect(
      existsSync(new URL("../../src/components/dashboard/DashboardInsightGrid.jsx", import.meta.url))
    ).toBe(false);
  });

  test("labels workflow progress as matchday readiness", () => {
    expect(missionHeroSource).toContain("Matchday Readiness");
    expect(missionHeroSource).not.toContain("Platform Readiness");
  });

  test("does not show an unconditional operations readiness banner", () => {
    expect(operationsSource).not.toContain("Ground Ready");
    expect(operationsSource).not.toContain("Weekend Operations");
  });

  test("uses neutral day descriptions instead of primary and secondary hierarchy", () => {
    expect(dayTabsSource).not.toContain("Primary matchday");
    expect(dayTabsSource).not.toContain("Secondary matchday");
    expect(dayTabsSource).toContain("Saturday fixtures and resources");
    expect(dayTabsSource).toContain("Sunday fixtures and resources");
  });
});
