import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildCommunicationApprovalKeyFromSnapshot,
  buildCommunicationApprovalSnapshot,
  buildExecutiveReportApprovalKey,
  buildExecutiveReportSnapshot,
  buildFundingPackApprovalKey,
  buildFundingPackSnapshot,
  buildMatchweekApprovalKey,
  buildMatchweekApprovalSnapshot,
} from "../../src/lib/elite/eliteApprovalSnapshots.js";
import {
  ENTITLEMENTS,
  PLAN_CATALOGUE,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";

const migration = readFileSync("supabase/migrations/202607130003_elite_integrity_and_package_controls.sql", "utf8");
const persistence = readFileSync("src/hooks/useWeekPersistence.js", "utf8");
const commandPage = readFileSync("src/pages/EliteCommandCentrePage.jsx", "utf8");
const reportsPage = readFileSync("src/pages/ReportsPage.jsx", "utf8");
const dispatch = readFileSync("server-api/communications/dispatch.js", "utf8");
const subscriptionPanel = readFileSync("src/components/Settings/SubscriptionSettingsPanel.jsx", "utf8");

function fixture(overrides = {}) {
  return {
    id: "fixture-1",
    homeTeam: "U14 Hawks",
    awayTeam: "Visitors",
    koTime: "10:00",
    pitchId: "P1",
    referee: "Official One",
    status: "scheduled",
    ...overrides,
  };
}

describe("Elite integrity and package controls", () => {
  test("uses immutable matchweek snapshots that change when publishable fixture content changes", () => {
    const first = buildMatchweekApprovalSnapshot([{ key: "saturday", date: "2026-09-19", fixtures: [fixture()] }]);
    const same = buildMatchweekApprovalSnapshot([{ key: "saturday", date: "2026-09-19", fixtures: [fixture()] }]);
    const changed = buildMatchweekApprovalSnapshot([{ key: "saturday", date: "2026-09-19", fixtures: [fixture({ koTime: "10:30" })] }]);

    expect(buildMatchweekApprovalKey(first)).toBe(buildMatchweekApprovalKey(same));
    expect(buildMatchweekApprovalKey(changed)).not.toBe(buildMatchweekApprovalKey(first));
    expect(persistence).toContain("approvalSnapshotHash");
    expect(migration).toContain("approval.snapshot ->> 'contentHash' = approval_hash");
  });

  test("governs executive and funding exports against their exact approved content", () => {
    const executive = buildExecutiveReportSnapshot({ organisationName: "Example FC", fixtureCount: 4 }, { start: "2026-09-19", end: "2026-09-20" });
    const changedExecutive = buildExecutiveReportSnapshot({ organisationName: "Example FC", fixtureCount: 5 }, { start: "2026-09-19", end: "2026-09-20" });
    expect(buildExecutiveReportApprovalKey(changedExecutive)).not.toBe(buildExecutiveReportApprovalKey(executive));

    const funding = buildFundingPackSnapshot({ project: { id: "p1", title: "Pitch works" }, tasks: [{ id: "t1", projectId: "p1", title: "Quote", status: "todo" }] });
    const changedFunding = buildFundingPackSnapshot({ project: { id: "p1", title: "Pitch works" }, tasks: [{ id: "t1", projectId: "p1", title: "Quote", status: "done" }] });
    expect(buildFundingPackApprovalKey(changedFunding)).not.toBe(buildFundingPackApprovalKey(funding));
    expect(commandPage).toContain("authoriseEliteGovernedExport");
    expect(reportsPage).toContain("authoriseEliteGovernedExport");
    expect(migration).toContain("Approval is required before this exact export can be released");
  });

  test("keeps template-level communication approval effective for the exact batch", () => {
    const row = {
      id: "row-1",
      messageHash: "hash-1",
      governedTemplateKey: "fixture_confirmed",
      governedTemplateVersion: "2026-07-13T12:00:00Z",
      governedTemplateApprovalRequired: true,
      recipients: [{ type: "coach", channel: "email", destination: "coach@example.org", message: "Confirmed" }],
    };
    const first = buildCommunicationApprovalSnapshot([row], { messages: [{}], unavailable: [] });
    const changed = buildCommunicationApprovalSnapshot([{ ...row, messageHash: "hash-2" }], { messages: [{}], unavailable: [] });
    expect(first.approvalRequired).toBe(true);
    expect(first.templates).toEqual(["fixture_confirmed"]);
    expect(buildCommunicationApprovalKeyFromSnapshot(changed)).not.toBe(buildCommunicationApprovalKeyFromSnapshot(first));
    expect(dispatch).toContain("request_template_keys");
    expect(migration).toContain("template.approval_required = true");
  });

  test("enforces reviewer scope, rejection reasons, cancellation, expiry and duplicate protection in the database", () => {
    expect(migration).toContain("elite_approval_requests_one_pending_idx");
    expect(migration).toContain("target_site_id");
    expect(migration).toContain("A rejection reason is required");
    expect(migration).toContain("cancel_elite_approval_request");
    expect(migration).toContain("Expired automatically");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("enforce_elite_subscription_write");
  });

  test("rejects unknown client overrides and exposes package usage and commercial boundaries", () => {
    const subscription = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      entitlement_overrides: {
        analytics_advanced: true,
        invented_super_feature: true,
      },
    });
    expect(subscription.features.has(ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(subscription.features.has("invented_super_feature")).toBe(false);
    expect(PLAN_CATALOGUE.core.commercial.capacityExtensions).toBe(true);
    expect(PLAN_CATALOGUE.pro.commercial.capacityExtensions).toBe(true);
    expect(PLAN_CATALOGUE.elite.commercial.capacityExtensions).toBe(true);
    expect(subscriptionPanel).toContain("Plan limits");
    expect(subscriptionPanel).toContain("Capacity extensions");
    expect(migration).toContain("known_entitlements constant text[]");
  });
});
