import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  LAUNCH_ACCEPTANCE_SCENARIOS,
  buildLaunchAcceptanceReport,
} from "../../src/lib/platform/launchAcceptance.js";

const pilotEvidencePanel = readFileSync("src/components/PlatformPilotEvidencePanel.jsx", "utf8");
const grantDashboard = readFileSync("src/components/analytics/GrantImpactDashboard.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202607110008_subscription_launch_acceptance_gate.sql", "utf8");
const runbook = readFileSync("docs/REAL_ACCOUNT_SUBSCRIPTION_ACCEPTANCE.md", "utf8");

describe("subscription launch acceptance phase 2", () => {
  test("the shared package-contract report passes and covers every real-account scenario", () => {
    const report = buildLaunchAcceptanceReport();
    expect(report.result).toBe("pass");
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
    expect(LAUNCH_ACCEPTANCE_SCENARIOS.map((item) => item.id)).toEqual([
      "core",
      "pro",
      "elite",
      "read-only",
      "suspended",
      "invalid",
    ]);
  });

  test("platform launch control exposes the acceptance scenarios and structured evidence action", () => {
    expect(pilotEvidencePanel).toContain("Subscription launch acceptance");
    expect(pilotEvidencePanel).toContain("Use as evidence");
    expect(pilotEvidencePanel).toContain('gate.code === "subscription_acceptance"');
    expect(pilotEvidencePanel).toContain("Real staging accounts must still prove");
  });

  test("the dedicated launch gate is installed without replacing existing gate evidence", () => {
    expect(migration).toContain("subscription_acceptance");
    expect(migration).toContain("real_account_evidence_required");
    expect(migration).toContain("on conflict (code) do update");
  });

  test("funding opportunity facts use readable two-column cards rather than four narrow columns", () => {
    expect(grantDashboard).toContain('className="mt-5 grid gap-3 sm:grid-cols-2"');
    expect(grantDashboard).toContain("Evidence readiness");
    expect(grantDashboard).toContain("readinessPercent");
    expect(grantDashboard).not.toContain('sm:grid-cols-2 xl:grid-cols-4');
  });

  test("the manual runbook covers actual plans, restrictions and end-to-end proof", () => {
    expect(runbook).toContain("Scenario 1 — Core");
    expect(runbook).toContain("Scenario 3 — Elite");
    expect(runbook).toContain("Scenario 5 — Suspended subscription");
    expect(runbook).toContain("End-to-end workflow");
  });
});
