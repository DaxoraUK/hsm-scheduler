import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const productShell = read("../../src/layout/ProductShell.jsx");
const dashboard = read("../../src/pages/DashboardPage.jsx");
const matchday = read("../../src/pages/MatchdayPage.jsx");
const fixtureDrawer = read(
  "../../src/components/Operations/shared/FixtureDrawer.jsx",
);
const analyticsDashboard = read(
  "../../src/components/analytics/AnalyticsVisualDashboard.jsx",
);
const reports = read("../../src/pages/ReportsPage.jsx");
const subscription = read(
  "../../src/components/Settings/SubscriptionSettingsPanel.jsx",
);
const settingsTabs = read("../../src/components/Settings/SettingsTabs.jsx");
const integrationSettings = read(
  "../../src/components/Settings/IntegrationSettingsPanel.jsx",
);
const packageMigration = read(
  "../../supabase/migrations/202607110001_launch_package_truthfulness.sql",
);

describe("live UI and subscription truthfulness", () => {
  test("uses a focused five-item customer navigation", () => {
    expect(productShell).toContain('"Mission Control"');
    expect(productShell).toContain('"Operations"');
    expect(productShell).toContain('"Analytics"');
    expect(productShell).toContain('"Reports"');
    expect(productShell).toContain('"Settings"');
    expect(productShell).not.toContain('["communications", "Communications"');
    expect(
      existsSync(
        new URL("../../src/pages/CommunicationsPage.jsx", import.meta.url),
      ),
    ).toBe(false);
  });

  test("removes duplicate and unfinished dashboard and matchday surfaces", () => {
    expect(dashboard).toContain("Matchweek snapshot");
    expect(dashboard).not.toContain("DashboardWorkflowCard");
    expect(dashboard).not.toContain("GroundStatusCard");
    expect(dashboard).not.toContain("WeekendTimelineCard");
    expect(matchday).toContain("Parking Capacity & Arrivals");
    expect(matchday).not.toContain('id: "parkingCapacity"');
    expect(matchday).not.toContain('id: "operationsHealth"');
    expect(matchday).not.toContain('id: "publishing"');
    expect(fixtureDrawer).not.toContain('["history", "History"');
    expect(fixtureDrawer).not.toContain("Audit trail placeholder");
  });

  test("keeps the default analytics view focused and moves evidence detail behind disclosure", () => {
    expect(analyticsDashboard).toContain(
      'new Set(["fixture-trends", "pitch-use"])',
    );
    expect(analyticsDashboard).toContain('label="Delivery rate"');
    expect(analyticsDashboard).toContain('label="Busiest pitch"');
    expect(analyticsDashboard).toContain('label="Officials coverage"');
    expect(analyticsDashboard).toContain('label="Parking pressure"');
    expect(analyticsDashboard).not.toContain('label="Peak kick-off"');
    expect(analyticsDashboard).not.toContain('label="Facility activity"');
    expect(analyticsDashboard).not.toContain('label="Weather evidence"');
    expect(analyticsDashboard).toContain('id="evidence-quality"');
    expect(analyticsDashboard).not.toContain("Ground Control insight");
  });

  test("enforces advanced report access and CSV export", () => {
    expect(reports).toContain("ADVANCED_REPORT_IDS");
    expect(reports).toContain("advancedReportsEnabled");
    expect(reports).toContain("dataExportEnabled");
    expect(reports).toContain("CSV export is not included in this plan");
  });

  test("shows only launch-ready packages and delivered features", () => {
    expect(subscription).toContain("getLaunchPlans()");
    expect(subscription).toMatch(
      /Link is intentionally excluded from\s+the launch catalogue/,
    );
    expect(subscription).not.toContain("Priority support");
    expect(subscription).not.toContain("Premium support");
    expect(subscription).not.toContain("Advanced integrations");
  });

  test("keeps setup shortcuts on Overview and reduces permanent Settings navigation", () => {
    expect(settingsTabs).not.toContain('["workspace", "Workspace"');
    expect(settingsTabs).not.toContain('["onboarding", "Setup wizard"');
    expect(settingsTabs).toContain('label: "Club & venues"');
    expect(settingsTabs).toContain('label: "Teams & resources"');
    expect(settingsTabs).toContain('label: "Plan & billing"');
    expect(settingsTabs).toContain('label: "Access & data"');
  });

  test("shows only integrations that have a genuine workflow", () => {
    expect(integrationSettings).toContain("Full-Time FA");
    expect(integrationSettings).not.toContain("TeamFeePay");
    expect(integrationSettings).not.toContain("Pitchero");
    expect(integrationSettings).not.toContain("Spond");
  });

  test("aligns the database catalogue with the launch package matrix", () => {
    expect(packageMigration).toContain("2026-07-11.1");
    expect(packageMigration).toContain("'launch_status', 'held'");
    expect(packageMigration).toContain("'operations_advanced'");
    const proPackage = packageMigration
      .split("where code = 'pro';")[0]
      .split("update public.subscription_plans")
      .at(-1);
    const elitePackage = packageMigration
      .split("where code = 'elite';")[0]
      .split("update public.subscription_plans")
      .at(-1);
    expect(proPackage).not.toContain("advanced_integrations");
    expect(proPackage).not.toContain("priority_support");
    expect(elitePackage).not.toContain("premium_support");
    expect(packageMigration).toContain(
      "- array['advanced_integrations','priority_support','premium_support']",
    );
  });
});
