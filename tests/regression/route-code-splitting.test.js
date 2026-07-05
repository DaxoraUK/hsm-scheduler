import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCoreSource = readFileSync(
  new URL("../../src/AppCore.jsx", import.meta.url),
  "utf8"
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
      new RegExp(`const ${moduleName} = lazy\\(\\(\\) => import\\(`)
    );
  });

  test("does not restore eager page imports", () => {
    routeModules.forEach((moduleName) => {
      expect(appCoreSource).not.toMatch(new RegExp(`import ${moduleName} from`));
    });
  });

  test("defers optional onboarding and subscription UI", () => {
    expect(appCoreSource).toContain(
      'const CustomerOnboardingWizard = lazy(() => import("./components/CustomerOnboardingWizard.jsx"));'
    );
    expect(appCoreSource).toContain(
      'const SubscriptionGate = lazy(() => import("./components/SubscriptionGate.jsx"));'
    );
    expect(appCoreSource).toContain("{onboardingOpen && (");
  });
});
