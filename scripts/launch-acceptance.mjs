import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENTITLEMENTS,
  LIMIT_KEYS,
  PLAN_CATALOGUE,
  PLAN_CODES,
  applySubscriptionAccess,
  canOpenPage,
  getEntitlementLimit,
  getLaunchPlans,
  hasEntitlement,
  normaliseSubscriptionPayload,
} from "../src/lib/subscriptions/entitlements.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, ".release-evidence");
const checkOnly = process.argv.includes("--check-only");

function subscription(planCode, options = {}) {
  return normaliseSubscriptionPayload({
    club_id: `acceptance-${planCode}`,
    plan_code: planCode,
    plan_name: PLAN_CATALOGUE[planCode]?.name,
    status: options.status || "active",
    access_state: options.accessState || "full",
    billing_exempt: options.billingExempt || false,
  });
}

function check(name, passed, detail) {
  return { name, passed: Boolean(passed), detail };
}

const core = subscription(PLAN_CODES.CORE);
const pro = subscription(PLAN_CODES.PRO);
const elite = subscription(PLAN_CODES.ELITE);
const suspended = subscription(PLAN_CODES.CORE, { status: "suspended", accessState: "read_only" });
const viewer = subscription(PLAN_CODES.PRO, { accessState: "read_only" });
const invalid = normaliseSubscriptionPayload({ plan_code: "damaged-plan", status: "active", access_state: "full" });

const expectedRoutes = {
  [PLAN_CODES.CORE]: { dashboard: true, operations: true, communications: true, analytics: true, reports: true },
  [PLAN_CODES.PRO]: { dashboard: true, operations: true, communications: true, analytics: true, reports: true },
  [PLAN_CODES.ELITE]: { dashboard: true, operations: true, communications: true, analytics: true, reports: true },
};

const checks = [
  check(
    "Launch catalogue contains only Core, Pro and Elite",
    getLaunchPlans().map((plan) => plan.code).join(",") === "core,pro,elite",
    getLaunchPlans().map((plan) => `${plan.name} (${plan.code})`).join(", "),
  ),
  check(
    "Link remains held and cannot be assigned",
    PLAN_CATALOGUE.link.customerVisible === false
      && PLAN_CATALOGUE.link.assignable === false
      && !PLAN_CATALOGUE.link.features.includes(ENTITLEMENTS.MATCHDAY_SCHEDULING),
    `visible=${PLAN_CATALOGUE.link.customerVisible}; assignable=${PLAN_CATALOGUE.link.assignable}; launch=${PLAN_CATALOGUE.link.launchStatus}`,
  ),
  check(
    "Core includes operational scheduling but not advanced workspaces",
    hasEntitlement(core, ENTITLEMENTS.MATCHDAY_SCHEDULING)
      && hasEntitlement(core, ENTITLEMENTS.DATA_EXPORT)
      && !hasEntitlement(core, ENTITLEMENTS.OPERATIONS_ADVANCED)
      && !hasEntitlement(core, ENTITLEMENTS.REPORTS_ADVANCED)
      && !hasEntitlement(core, ENTITLEMENTS.ANALYTICS_ADVANCED),
    "Core: scheduling and CSV enabled; advanced operations, reports and analytics disabled.",
  ),
  check(
    "Pro enables all advanced launch capabilities",
    [
      ENTITLEMENTS.OPERATIONS_ADVANCED,
      ENTITLEMENTS.REPORTS_ADVANCED,
      ENTITLEMENTS.ANALYTICS_ADVANCED,
      ENTITLEMENTS.MULTI_VENUE,
    ].every((entitlement) => hasEntitlement(pro, entitlement)),
    "Pro: cross-day operations, advanced reports, funding analytics and multi-venue enabled.",
  ),
  check(
    "Elite has unlimited launch resource limits",
    Object.values(LIMIT_KEYS).every((key) => getEntitlementLimit(elite, key) === -1),
    Object.values(LIMIT_KEYS).map((key) => `${key}=${getEntitlementLimit(elite, key)}`).join(", "),
  ),
  ...Object.entries(expectedRoutes).map(([planCode, routes]) => {
    const current = planCode === PLAN_CODES.CORE ? core : planCode === PLAN_CODES.PRO ? pro : elite;
    const mismatches = Object.entries(routes).filter(([route, expected]) => canOpenPage(current, route) !== expected);
    return check(
      `${PLAN_CATALOGUE[planCode].name} route visibility matches the launch package`,
      mismatches.length === 0,
      mismatches.length ? mismatches.map(([route, expected]) => `${route}: expected ${expected}`).join(", ") : Object.keys(routes).join(", "),
    );
  }),
  check(
    "Suspended subscriptions are read-only",
    suspended.isReadOnly && !suspended.canWrite && !applySubscriptionAccess({ canOperate: true, canPublish: true }, suspended).canOperate,
    `access=${suspended.accessState}; canWrite=${suspended.canWrite}`,
  ),
  check(
    "Read-only club roles cannot operate or publish",
    viewer.isReadOnly
      && !applySubscriptionAccess({ canOperate: true, canPublish: true, role: "viewer" }, viewer).canOperate
      && !applySubscriptionAccess({ canOperate: true, canPublish: true, role: "viewer" }, viewer).canPublish,
    `plan=${viewer.planCode}; access=${viewer.accessState}`,
  ),
  check(
    "Unknown plans fail closed",
    invalid.planCode === "unverified"
      && invalid.isReadOnly
      && invalid.features.size === 0
      && !canOpenPage(invalid, "dashboard"),
    `plan=${invalid.planCode}; access=${invalid.accessState}; features=${invalid.features.size}`,
  ),
];

const failed = checks.filter((item) => !item.passed);
const generatedAt = new Date().toISOString();
const evidence = {
  schemaVersion: 1,
  generatedAt,
  result: failed.length ? "fail" : "pass",
  scope: "launch-subscription-and-access-acceptance",
  checks,
  manualEvidenceRequired: [
    "Verify Core, Pro and Elite using real staging accounts and capture screenshots of navigation, locked areas and limits.",
    "Verify suspended and viewer accounts cannot mutate schedules, contacts, communications or funding records.",
    "Run the end-to-end matchweek workflow in docs/LAUNCH_ACCEPTANCE_RUNBOOK.md.",
    "Complete keyboard, 1366px laptop, tablet and mobile checks from the runbook.",
    "Retain Supabase RLS isolation and communications delivery evidence with the release record.",
  ],
};

if (!checkOnly) {
  mkdirSync(outputDir, { recursive: true });
  const runId = generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  const jsonPath = join(outputDir, `launch-acceptance-${runId}.json`);
  const markdownPath = join(outputDir, `launch-acceptance-${runId}.md`);
  const markdown = `# Ground Control launch acceptance\n\n- **Generated:** ${generatedAt}\n- **Result:** ${evidence.result.toUpperCase()}\n- **Scope:** Subscription, route and read-only acceptance\n\n## Automated checks\n\n${checks.map((item) => `- **${item.name}:** ${item.passed ? "PASS" : "FAIL"} — ${item.detail}`).join("\n")}\n\n## Manual evidence still required\n\n${evidence.manualEvidenceRequired.map((item) => `- ${item}`).join("\n")}\n`;
  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(markdownPath, markdown);
  writeFileSync(join(outputDir, "latest-launch-acceptance.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(join(outputDir, "latest-launch-acceptance.md"), markdown);
  console.log(`Evidence: ${relative(root, jsonPath)}`);
}

for (const item of checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}`);
console.log(`Ground Control launch acceptance: ${evidence.result.toUpperCase()}`);
process.exit(failed.length ? 1 : 0);
