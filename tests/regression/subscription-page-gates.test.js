import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const analyticsPage = readFileSync("src/pages/AnalyticsPage.jsx", "utf8");
const communicationsPage = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");

describe("authoritative subscription page gates", () => {
  test("AppCore calculates and passes advanced package access", () => {
    expect(appCore).toContain("const advancedAnalyticsEnabled=hasEntitlement(subscription,ENTITLEMENTS.ANALYTICS_ADVANCED)");
    expect(appCore).toContain("const advancedIntegrationsEnabled=hasEntitlement(subscription,ENTITLEMENTS.ADVANCED_INTEGRATIONS)");
    expect(appCore).toContain("advancedAnalyticsEnabled={advancedAnalyticsEnabled}");
    expect(appCore).toContain("advancedIntegrationsEnabled={advancedIntegrationsEnabled}");
  });

  test("Analytics and Communications consume the authoritative access flags", () => {
    expect(analyticsPage).toContain("authoritativeAdvancedAnalyticsEnabled");
    expect(communicationsPage).toContain("authoritativeAdvancedIntegrationsEnabled");
  });
});
