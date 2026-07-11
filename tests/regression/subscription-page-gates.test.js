import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const analyticsPage = readFileSync("src/pages/AnalyticsPage.jsx", "utf8");
const reportsPage = readFileSync("src/pages/ReportsPage.jsx", "utf8");
const dayTabs = readFileSync("src/components/Operations/DayTabs.jsx", "utf8");
const matchdayPage = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("authoritative subscription page gates", () => {
  test("AppCore calculates and passes delivered advanced package access", () => {
    expect(appCore).toMatch(
      /const\s+advancedOperationsEnabled\s*=\s*hasEntitlement/,
    );
    expect(appCore).toMatch(
      /const\s+advancedReportsEnabled\s*=\s*hasEntitlement/,
    );
    expect(appCore).toMatch(
      /const\s+advancedAnalyticsEnabled\s*=\s*hasEntitlement/,
    );
    expect(appCore).toContain(
      "advancedOperationsEnabled={advancedOperationsEnabled}",
    );
    expect(appCore).toContain(
      "advancedReportsEnabled={advancedReportsEnabled}",
    );
    expect(appCore).toContain(
      "advancedAnalyticsEnabled={advancedAnalyticsEnabled}",
    );
    expect(appCore).not.toContain("advancedIntegrationsEnabled");
  });

  test("advanced Operations, reports and analytics consume authoritative access flags", () => {
    expect(dayTabs).toContain("advancedOperationsEnabled");
    expect(matchdayPage).toContain("props.advancedOperationsEnabled");
    expect(reportsPage).toContain("authoritativeAdvancedReportsEnabled");
    expect(analyticsPage).toContain("authoritativeAdvancedAnalyticsEnabled");
  });
});
