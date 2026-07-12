import {
  ENTITLEMENTS,
  LIMIT_KEYS,
  PLAN_CATALOGUE,
  PLAN_CODES,
  applySubscriptionAccess,
  canOpenPage,
  formatEntitlementLimit,
  getEntitlementLimit,
  getLaunchPlans,
  hasEntitlement,
  normaliseSubscriptionPayload,
} from "../subscriptions/entitlements.js";

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

function check(id, name, passed, detail) {
  return Object.freeze({ id, name, passed: Boolean(passed), detail });
}

function limitsFor(planCode) {
  const current = subscription(planCode);
  return Object.freeze(Object.fromEntries(
    Object.values(LIMIT_KEYS).map((key) => [key, formatEntitlementLimit(getEntitlementLimit(current, key))])
  ));
}

const ROUTES = Object.freeze(["dashboard", "operations", "communications", "analytics", "reports"]);

export const LAUNCH_ACCEPTANCE_SCENARIOS = Object.freeze([
  Object.freeze({
    id: "core",
    title: "Core",
    description: "Single-site scheduling and operational control without advanced cross-day and funding workspaces.",
    expected: Object.freeze([
      "Mission Control, Saturday/Sunday date selection, day scheduling and Communications open normally.",
      "Core Analytics, operational reports and CSV export are available.",
      "Operations Overview, Matchweek Timeline, advanced reports and funding analytics remain locked.",
      "Resource limits show 15 teams, 1 venue, 5 users and 15 pitches.",
    ]),
    limits: limitsFor(PLAN_CODES.CORE),
  }),
  Object.freeze({
    id: "pro",
    title: "Pro",
    description: "Advanced cross-day operations, reporting and funding evidence for larger clubs.",
    expected: Object.freeze([
      "All Core workflows remain available.",
      "Operations Overview and Matchweek Timeline open without an upgrade prompt.",
      "Advanced Reports and Funding Analytics are available.",
      "Resource limits show 40 teams, 4 venues, 15 users and 50 pitches.",
    ]),
    limits: limitsFor(PLAN_CODES.PRO),
  }),
  Object.freeze({
    id: "elite",
    title: "Elite",
    description: "Pro capability with unlimited launch resource limits and tailored implementation.",
    expected: Object.freeze([
      "All Pro routes and actions are available.",
      "Teams, venues, users, pitches and history limits show Unlimited.",
      "No Core or Pro upgrade prompt appears anywhere in the customer workspace.",
      "Customer-facing copy avoids unsupported premium-service promises.",
    ]),
    limits: limitsFor(PLAN_CODES.ELITE),
  }),
  Object.freeze({
    id: "read-only",
    title: "Read-only role",
    description: "A viewer can inspect permitted information but cannot change operational or personal data.",
    expected: Object.freeze([
      "Save, build, publish, contact-edit and funding-edit actions are disabled or hidden.",
      "The interface explains why the workspace is read-only before an action is attempted.",
      "Direct database mutations are rejected even if a client request is manually replayed.",
      "Exports remain available only where the plan and role both permit them.",
    ]),
  }),
  Object.freeze({
    id: "suspended",
    title: "Suspended subscription",
    description: "Club data remains protected while write access is removed.",
    expected: Object.freeze([
      "The workspace displays a clear suspended or read-only message.",
      "No schedule, contact, communication or funding record can be changed.",
      "Existing data is not deleted or silently hidden.",
      "Reactivation restores only the entitlements belonging to the assigned plan.",
    ]),
  }),
  Object.freeze({
    id: "invalid",
    title: "Unknown plan",
    description: "Damaged or unrecognised subscription data must fail closed.",
    expected: Object.freeze([
      "The plan is normalised to Unverified plan.",
      "Customer routes remain unavailable rather than falling back to Core.",
      "No mutation or export capability is granted.",
      "The user receives a safe support message without internal implementation details.",
    ]),
  }),
]);

export function buildLaunchAcceptanceReport() {
  const core = subscription(PLAN_CODES.CORE);
  const pro = subscription(PLAN_CODES.PRO);
  const elite = subscription(PLAN_CODES.ELITE);
  const suspended = subscription(PLAN_CODES.CORE, { status: "suspended", accessState: "read_only" });
  const viewer = subscription(PLAN_CODES.PRO, { accessState: "read_only" });
  const invalid = normaliseSubscriptionPayload({ plan_code: "damaged-plan", status: "active", access_state: "full" });

  const routeExpectations = {
    [PLAN_CODES.CORE]: Object.fromEntries(ROUTES.map((route) => [route, true])),
    [PLAN_CODES.PRO]: Object.fromEntries(ROUTES.map((route) => [route, true])),
    [PLAN_CODES.ELITE]: Object.fromEntries(ROUTES.map((route) => [route, true])),
  };

  const checks = [
    check(
      "launch-catalogue",
      "Launch catalogue contains only Core, Pro and Elite",
      getLaunchPlans().map((plan) => plan.code).join(",") === "core,pro,elite",
      getLaunchPlans().map((plan) => `${plan.name} (${plan.code})`).join(", "),
    ),
    check(
      "link-held",
      "Link remains held and cannot be assigned",
      PLAN_CATALOGUE.link.customerVisible === false
        && PLAN_CATALOGUE.link.assignable === false
        && !PLAN_CATALOGUE.link.features.includes(ENTITLEMENTS.MATCHDAY_SCHEDULING),
      `visible=${PLAN_CATALOGUE.link.customerVisible}; assignable=${PLAN_CATALOGUE.link.assignable}; launch=${PLAN_CATALOGUE.link.launchStatus}`,
    ),
    check(
      "core-package",
      "Core includes operational scheduling but not advanced workspaces",
      hasEntitlement(core, ENTITLEMENTS.MATCHDAY_SCHEDULING)
        && hasEntitlement(core, ENTITLEMENTS.DATA_EXPORT)
        && !hasEntitlement(core, ENTITLEMENTS.OPERATIONS_ADVANCED)
        && !hasEntitlement(core, ENTITLEMENTS.REPORTS_ADVANCED)
        && !hasEntitlement(core, ENTITLEMENTS.ANALYTICS_ADVANCED),
      "Core: scheduling and CSV enabled; advanced operations, reports and analytics disabled.",
    ),
    check(
      "pro-package",
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
      "elite-limits",
      "Elite has unlimited launch resource limits",
      Object.values(LIMIT_KEYS).every((key) => getEntitlementLimit(elite, key) === -1),
      Object.values(LIMIT_KEYS).map((key) => `${key}=${getEntitlementLimit(elite, key)}`).join(", "),
    ),
    ...Object.entries(routeExpectations).map(([planCode, routes]) => {
      const current = planCode === PLAN_CODES.CORE ? core : planCode === PLAN_CODES.PRO ? pro : elite;
      const mismatches = Object.entries(routes).filter(([route, expected]) => canOpenPage(current, route) !== expected);
      return check(
        `${planCode}-routes`,
        `${PLAN_CATALOGUE[planCode].name} route visibility matches the launch package`,
        mismatches.length === 0,
        mismatches.length ? mismatches.map(([route, expected]) => `${route}: expected ${expected}`).join(", ") : Object.keys(routes).join(", "),
      );
    }),
    check(
      "suspended-read-only",
      "Suspended subscriptions are read-only",
      suspended.isReadOnly && !suspended.canWrite && !applySubscriptionAccess({ canOperate: true, canPublish: true }, suspended).canOperate,
      `access=${suspended.accessState}; canWrite=${suspended.canWrite}`,
    ),
    check(
      "viewer-read-only",
      "Read-only club roles cannot operate or publish",
      viewer.isReadOnly
        && !applySubscriptionAccess({ canOperate: true, canPublish: true, role: "viewer" }, viewer).canOperate
        && !applySubscriptionAccess({ canOperate: true, canPublish: true, role: "viewer" }, viewer).canPublish,
      `plan=${viewer.planCode}; access=${viewer.accessState}`,
    ),
    check(
      "unknown-fails-closed",
      "Unknown plans fail closed",
      invalid.planCode === "unverified"
        && invalid.isReadOnly
        && invalid.features.size === 0
        && !canOpenPage(invalid, "dashboard"),
      `plan=${invalid.planCode}; access=${invalid.accessState}; features=${invalid.features.size}`,
    ),
  ];

  const failed = checks.filter((item) => !item.passed);
  return Object.freeze({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    result: failed.length ? "fail" : "pass",
    scope: "launch-subscription-and-access-acceptance",
    checks: Object.freeze(checks),
    passed: checks.length - failed.length,
    failed: failed.length,
    total: checks.length,
    scenarios: LAUNCH_ACCEPTANCE_SCENARIOS,
    manualEvidenceRequired: Object.freeze([
      "Verify Core, Pro and Elite using real staging accounts and capture screenshots of navigation, locked areas and limits.",
      "Verify suspended and viewer accounts cannot mutate schedules, contacts, communications or funding records.",
      "Run the end-to-end matchweek workflow in docs/REAL_ACCOUNT_SUBSCRIPTION_ACCEPTANCE.md.",
      "Complete keyboard, 1366px laptop, tablet and mobile checks from the launch runbook.",
      "Retain Supabase RLS isolation and communications delivery evidence with the release record.",
    ]),
  });
}
