import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCoreSource = readFileSync(
  new URL("../../src/AppCore.jsx", import.meta.url),
  "utf8",
);

const routeModules = [
  "DashboardPage",
  "OperationsPage",
  "SaturdayPage",
  "SundayPage",
  "MidweekPage",
  "OperationsCentrePage",
  "OperationsTimelinePage",
  "CommunicationsPage",
  "AnalyticsPage",
  "ReportsPage",
  "SettingsPage",
  "PlatformAdminPage",
];

describe("route-level code splitting", () => {
  test.each(routeModules)("loads %s on demand", (moduleName) => {
    expect(appCoreSource).toMatch(
      new RegExp(
        `const\\s+${moduleName}\\s*=\\s*lazy\\(\\s*\\(\\)\\s*=>\\s*import\\(`,
      ),
    );
  });

  test("does not restore eager page imports", () => {
    routeModules.forEach((moduleName) => {
      expect(appCoreSource).not.toMatch(
        new RegExp(`import\\s+${moduleName}\\s+from`),
      );
    });
  });

  test("defers optional onboarding and subscription UI", () => {
    expect(appCoreSource).toMatch(
      /const\s+CustomerOnboardingWizard\s*=\s*lazy/,
    );
    expect(appCoreSource).toMatch(/const\s+SubscriptionGate\s*=\s*lazy/);
    expect(appCoreSource).toContain("onboardingOpen &&");
  });
});
