import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ENTITLEMENTS,
  PLAN_CODES,
  hasEntitlement,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";
import {
  ELITE_APPROVAL_TYPES,
  buildEliteEntityKey,
  normaliseEliteApprovalPolicy,
  summariseEliteFundingPortfolio,
} from "../../src/lib/elite/eliteGovernanceService.js";
import { buildCommunicationApprovalKey } from "../../src/lib/communications/queueSafety.js";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import { buildDeliveryMessages, EMPTY_DELIVERY_CAPABILITIES } from "../../src/lib/communications/deliveryService.js";

const migration = readFileSync("supabase/migrations/202607130002_elite_governance_approvals.sql", "utf8");
const commandPage = readFileSync("src/pages/EliteCommandCentrePage.jsx", "utf8");
const controlWorkspace = readFileSync("src/components/elite/EliteControlWorkspace.jsx", "utf8");
const dispatch = readFileSync("server-api/communications/dispatch.js", "utf8");
const persistence = readFileSync("src/hooks/useWeekPersistence.js", "utf8");

function subscription(planCode) {
  return normaliseSubscriptionPayload({
    club_id: `club-${planCode}`,
    plan_code: planCode,
    status: "active",
    access_state: "full",
  });
}

describe("Elite organisation governance and approvals phase 2", () => {
  test("keeps approval and governance controls exclusive to Elite", () => {
    const pro = subscription(PLAN_CODES.PRO);
    const elite = subscription(PLAN_CODES.ELITE);
    const eliteOnly = [
      ENTITLEMENTS.APPROVAL_WORKFLOWS,
      ENTITLEMENTS.SITE_RESPONSIBILITY,
      ENTITLEMENTS.COMMUNICATION_GOVERNANCE,
      ENTITLEMENTS.FUNDING_PORTFOLIO,
      ENTITLEMENTS.ENHANCED_AUDIT,
    ];
    expect(eliteOnly.every((key) => hasEntitlement(elite, key))).toBe(true);
    expect(eliteOnly.some((key) => hasEntitlement(pro, key))).toBe(false);
  });

  test("creates stable approval keys that change with the governed snapshot", () => {
    const first = buildEliteEntityKey(ELITE_APPROVAL_TYPES.MATCHWEEK, ["sat:u14:10:00:p1", "sun:u12:11:00:p2"]);
    const reordered = buildEliteEntityKey(ELITE_APPROVAL_TYPES.MATCHWEEK, ["sun:u12:11:00:p2", "sat:u14:10:00:p1"]);
    const changed = buildEliteEntityKey(ELITE_APPROVAL_TYPES.MATCHWEEK, ["sat:u14:10:30:p1", "sun:u12:11:00:p2"]);
    expect(first).toBe(reordered);
    expect(changed).not.toBe(first);
  });

  test("creates an exact communication approval key from message snapshots", () => {
    const rows = [{ id: "a", messageHash: "one", status: "scheduled", recipients: [{ type: "coach", channel: "email", destination: "a@example.org", message: "Message one" }] }];
    const first = buildCommunicationApprovalKey(rows);
    expect(buildCommunicationApprovalKey([...rows])).toBe(first);
    expect(buildCommunicationApprovalKey([{ ...rows[0], messageHash: "two" }])).not.toBe(first);
  });

  test("summarises organisation-wide funding applications without inventing outcomes", () => {
    const summary = summariseEliteFundingPortfolio({
      projects: [{ id: "p1" }, { id: "p2" }],
      applications: [
        { id: "a1", status: "draft", requestedAmount: 12000, awardedAmount: 0 },
        { id: "a2", status: "awarded", requestedAmount: 8000, awardedAmount: 6500 },
      ],
      applicationTasks: [{ id: "t1", title: "Submit quotes", status: "todo", dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) }],
      monitoringObligations: [],
    });
    expect(summary.projectCount).toBe(2);
    expect(summary.activeApplications).toBe(1);
    expect(summary.requestedAmount).toBe(20000);
    expect(summary.awardedAmount).toBe(6500);
    expect(summary.dueSoon).toHaveLength(1);
  });

  test("applies active Elite communication templates to the reviewed queue and provider subject", () => {
    const model = buildCommunicationsModel({
      club: { name: "Example FC", venue: "Main Ground" },
      teamCfg: [{ name: "U14 Hawks" }],
      teamContacts: [{ teamKey: "u14-hawks", coachName: "Alex Smith", coachEmail: "alex@example.org", preferredChannel: "email", receiveMatchdayMessages: true }],
      satFinal: [{ id: "fx1", homeTeam: "U14 Hawks", awayTeam: "Visitors", koTime: "10:00", pitch: "Pitch 1", referee: "Official One", refStatus: "confirmed", format: "11v11" }],
      satHasRun: true,
      satDateLabel: "Saturday 19 September 2026",
      governedTemplates: [{
        templateKey: "fixture_confirmed",
        active: true,
        updatedAt: "2026-07-13T12:00:00Z",
        subjectTemplate: "{{club}} | {{team}} confirmed",
        bodyTemplate: "Hi {{coach}}, {{team}} play {{opposition}} at {{kickoff}} on {{pitch}}.",
      }],
    });
    expect(model.rows[0].message).toContain("Hi Alex Smith");
    expect(model.rows[0].message).toContain("Visitors at 10:00 on Pitch 1");
    expect(model.rows[0].subject).toBe("Example FC | U14 Hawks confirmed");
    const capabilities = { ...EMPTY_DELIVERY_CAPABILITIES, channels: { ...EMPTY_DELIVERY_CAPABILITIES.channels, email: { enabled: true } } };
    expect(buildDeliveryMessages(model.rows, capabilities).messages[0].subject).toBe("Example FC | U14 Hawks confirmed");
  });

  test("defaults Elite to separation of duties and controlled expiry", () => {
    const policy = normaliseEliteApprovalPolicy({});
    expect(policy.matchweekApprovalRequired).toBe(true);
    expect(policy.communicationsApprovalRequired).toBe(true);
    expect(policy.fundingPackApprovalRequired).toBe(true);
    expect(policy.separationOfDuties).toBe(true);
    expect(policy.approvalExpiryHours).toBe(168);
  });

  test("installs server-side gates, reviewer separation and governance tables", () => {
    expect(migration).toContain("elite_approval_requests");
    expect(migration).toContain("elite_site_responsibilities");
    expect(migration).toContain("elite_communication_templates");
    expect(migration).toContain("assert_elite_communication_approval");
    expect(migration).toContain("Elite matchweek approval is required before publication");
    expect(migration).toContain("requester cannot approve their own item");
    expect(migration).toContain("private.club_has_entitlement(target_club_id, 'approval_workflows')");
  });

  test("exposes the working control centre and exact action gates", () => {
    expect(commandPage).toContain("Governance & approvals");
    expect(commandPage).toContain("<EliteControlWorkspace");
    expect(controlWorkspace).toContain("Site responsibility");
    expect(controlWorkspace).toContain("Funding portfolio");
    expect(controlWorkspace).toContain("Communication controls");
    expect(dispatch).toContain('userRpc(token, "assert_elite_communication_approval"');
    expect(persistence).toContain("approvalEntityKey");
    expect(persistence).toContain("Elite approval required");
  });
});
