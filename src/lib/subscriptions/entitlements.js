export const PLAN_CODES = Object.freeze({
  LINK: "link",
  CORE: "core",
  PRO: "pro",
  ELITE: "elite",
});

export const SUBSCRIPTION_STATUSES = Object.freeze({
  TRIALING: "trialing",
  ACTIVE: "active",
  GRACE: "grace",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
  INTERNAL: "internal",
});

export const ENTITLEMENTS = Object.freeze({
  DASHBOARD: "dashboard",
  CLUB_PROFILE: "club_profile",
  FIXTURE_IMPORT: "fixture_import",
  LEAGUE_LINK: "league_link",
  COMMUNICATIONS: "communications",
  RESOURCE_REGISTRY: "resource_registry",
  MATCHDAY_SCHEDULING: "matchday_scheduling",
  MIDWEEK_SCHEDULING: "midweek_scheduling",
  OPERATIONS_ADVANCED: "operations_advanced",
  PITCH_INTELLIGENCE: "pitch_intelligence",
  PARKING_INTELLIGENCE: "parking_intelligence",
  WEATHER_INTELLIGENCE: "weather_intelligence",
  OFFICIALS_MANAGEMENT: "officials_management",
  REPORTS_OPERATIONS: "reports_operations",
  REPORTS_ADVANCED: "reports_advanced",
  ANALYTICS_CORE: "analytics_core",
  ANALYTICS_ADVANCED: "analytics_advanced",
  DATA_EXPORT: "data_export",
  MULTI_VENUE: "multi_venue",
  PRIORITY_SUPPORT: "priority_support",
  PREMIUM_SUPPORT: "premium_support",
  ADVANCED_INTEGRATIONS: "advanced_integrations",
  ORGANISATION_COMMAND: "organisation_command",
  EXECUTIVE_REPORTING: "executive_reporting",
  GOVERNANCE_CONTROLS: "governance_controls",
  APPROVAL_WORKFLOWS: "approval_workflows",
  SITE_RESPONSIBILITY: "site_responsibility",
  COMMUNICATION_GOVERNANCE: "communication_governance",
  FUNDING_PORTFOLIO: "funding_portfolio",
  ENHANCED_AUDIT: "enhanced_audit",
  ANNUAL_PLANNER: "annual_planner",
});

export const LIMIT_KEYS = Object.freeze({
  TEAMS: "teams",
  VENUES: "venues",
  USERS: "users",
  PITCHES: "pitches",
  HISTORY_ENTRIES: "history_entries",
  HISTORY_RETENTION_DAYS: "history_retention_days",
});

const linkFeatures = [
  ENTITLEMENTS.DASHBOARD,
  ENTITLEMENTS.CLUB_PROFILE,
  ENTITLEMENTS.FIXTURE_IMPORT,
  ENTITLEMENTS.LEAGUE_LINK,
  ENTITLEMENTS.COMMUNICATIONS,
  ENTITLEMENTS.RESOURCE_REGISTRY,
];

const coreFeatures = [
  ENTITLEMENTS.DASHBOARD,
  ENTITLEMENTS.CLUB_PROFILE,
  ENTITLEMENTS.FIXTURE_IMPORT,
  ENTITLEMENTS.RESOURCE_REGISTRY,
  ENTITLEMENTS.COMMUNICATIONS,
  ENTITLEMENTS.MATCHDAY_SCHEDULING,
  ENTITLEMENTS.MIDWEEK_SCHEDULING,
  ENTITLEMENTS.PITCH_INTELLIGENCE,
  ENTITLEMENTS.PARKING_INTELLIGENCE,
  ENTITLEMENTS.WEATHER_INTELLIGENCE,
  ENTITLEMENTS.OFFICIALS_MANAGEMENT,
  ENTITLEMENTS.REPORTS_OPERATIONS,
  ENTITLEMENTS.ANALYTICS_CORE,
  ENTITLEMENTS.DATA_EXPORT,
];

const proFeatures = [
  ...coreFeatures,
  ENTITLEMENTS.OPERATIONS_ADVANCED,
  ENTITLEMENTS.REPORTS_ADVANCED,
  ENTITLEMENTS.ANALYTICS_ADVANCED,
  ENTITLEMENTS.MULTI_VENUE,
  ENTITLEMENTS.ANNUAL_PLANNER,
];

const eliteFeatures = [
  ...proFeatures,
  ENTITLEMENTS.ORGANISATION_COMMAND,
  ENTITLEMENTS.EXECUTIVE_REPORTING,
  ENTITLEMENTS.GOVERNANCE_CONTROLS,
  ENTITLEMENTS.APPROVAL_WORKFLOWS,
  ENTITLEMENTS.SITE_RESPONSIBILITY,
  ENTITLEMENTS.COMMUNICATION_GOVERNANCE,
  ENTITLEMENTS.FUNDING_PORTFOLIO,
  ENTITLEMENTS.ENHANCED_AUDIT,
];

export const PLAN_CATALOGUE = Object.freeze({
  [PLAN_CODES.LINK]: Object.freeze({
    code: PLAN_CODES.LINK,
    name: "Link",
    strapline: "The future operational connection between a club and its league.",
    monthlyPricePence: 2900,
    annualPricePence: 29000,
    features: Object.freeze(linkFeatures),
    limits: Object.freeze({
      teams: 4,
      venues: 1,
      users: 3,
      pitches: 6,
      history_entries: 12,
      history_retention_days: 90,
    }),
    launchStatus: "held",
    customerVisible: false,
    assignable: false,
  }),
  [PLAN_CODES.CORE]: Object.freeze({
    code: PLAN_CODES.CORE,
    name: "Core",
    strapline: "Complete scheduling and matchday control for a single-site grassroots club.",
    monthlyPricePence: 14900,
    annualPricePence: null,
    features: Object.freeze(coreFeatures),
    limits: Object.freeze({
      teams: 15,
      venues: 1,
      users: 5,
      pitches: 15,
      history_entries: 52,
      history_retention_days: 365,
    }),
    commercial: Object.freeze({
      capacityExtensions: true,
      support: "Support and onboarding scope confirmed in the order form",
      communications: "Provider usage allowance confirmed before paid activation",
      storage: "Evidence storage allowance confirmed before paid activation",
      offboarding: "Data export available before workspace closure",
    }),
    launchStatus: "available",
    customerVisible: true,
    assignable: true,
  }),
  [PLAN_CODES.PRO]: Object.freeze({
    code: PLAN_CODES.PRO,
    name: "Pro",
    strapline: "Advanced cross-day operations, reporting and funding evidence for larger clubs.",
    monthlyPricePence: 24900,
    annualPricePence: null,
    features: Object.freeze(proFeatures),
    limits: Object.freeze({
      teams: 40,
      venues: 4,
      users: 15,
      pitches: 50,
      history_entries: 156,
      history_retention_days: 730,
    }),
    commercial: Object.freeze({
      capacityExtensions: true,
      support: "Priority support and onboarding scope confirmed in the order form",
      communications: "Provider usage allowance confirmed before paid activation",
      storage: "Expanded evidence storage allowance confirmed before paid activation",
      offboarding: "Data export available before workspace closure",
    }),
    launchStatus: "available",
    customerVisible: true,
    assignable: true,
  }),
  [PLAN_CODES.ELITE]: Object.freeze({
    code: PLAN_CODES.ELITE,
    name: "Elite",
    strapline: "Organisation-wide command, governance and executive evidence for complex multi-site clubs.",
    monthlyPricePence: 39900,
    annualPricePence: null,
    features: Object.freeze(eliteFeatures),
    limits: Object.freeze({
      teams: 60,
      venues: 8,
      users: 25,
      pitches: 80,
      history_entries: 260,
      history_retention_days: 1095,
    }),
    contractModel: Object.freeze({
      band: "Elite 60",
      largerOrganisations: "Custom contracted capacity",
    }),
    commercial: Object.freeze({
      capacityExtensions: true,
      support: "Named onboarding, support and governance scope agreed in the Elite order form",
      communications: "Provider volumes and any overage rates agreed before activation",
      storage: "Evidence storage and retention requirements agreed before activation",
      offboarding: "Governed export and retention handover agreed at contract start",
    }),
    launchStatus: "contact",
    customerVisible: true,
    assignable: true,
  }),
});

const RESTRICTED_PLAN = Object.freeze({
  code: "unverified",
  name: "Unverified plan",
  strapline: "Plan access could not be verified.",
  monthlyPricePence: 0,
  annualPricePence: null,
  features: Object.freeze([]),
  limits: Object.freeze({
    teams: 0,
    venues: 0,
    users: 0,
    pitches: 0,
    history_entries: 0,
    history_retention_days: 0,
  }),
  launchStatus: "unavailable",
  customerVisible: false,
  assignable: false,
});

export const ROUTE_ENTITLEMENTS = Object.freeze({
  dashboard: ENTITLEMENTS.DASHBOARD,
  operations: ENTITLEMENTS.MATCHDAY_SCHEDULING,
  communications: ENTITLEMENTS.COMMUNICATIONS,
  analytics: ENTITLEMENTS.ANALYTICS_CORE,
  reports: ENTITLEMENTS.REPORTS_OPERATIONS,
  planner: ENTITLEMENTS.ANNUAL_PLANNER,
  executive: ENTITLEMENTS.ORGANISATION_COMMAND,
});

export function getLaunchPlans() {
  return Object.values(PLAN_CATALOGUE).filter((plan) => plan.customerVisible);
}

export function getAssignablePlans({ includeCode = "" } = {}) {
  const normalisedIncludeCode = String(includeCode || "").toLowerCase();
  return Object.values(PLAN_CATALOGUE).filter(
    (plan) => plan.assignable || plan.code === normalisedIncludeCode
  );
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseLimits(limits = {}) {
  return Object.fromEntries(
    Object.values(LIMIT_KEYS).map((key) => {
      const raw = Number(limits?.[key]);
      return [key, Number.isFinite(raw) ? raw : 0];
    })
  );
}

export function getPlanDefinition(code) {
  const normalisedCode = String(code || "").trim().toLowerCase();
  return PLAN_CATALOGUE[normalisedCode] || RESTRICTED_PLAN;
}

function normaliseObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

const KNOWN_ENTITLEMENT_KEYS = new Set(Object.values(ENTITLEMENTS));

function enabledOverrideKeys(value) {
  return Object.entries(normaliseObject(value))
    .filter(([, enabled]) => enabled === true || String(enabled).toLowerCase() === "true")
    .map(([key]) => String(key || "").trim())
    .filter((key) => KNOWN_ENTITLEMENT_KEYS.has(key));
}

export function normaliseSubscriptionPayload(payload = {}) {
  const requestedPlanCode = payload.plan_code || payload.planCode;
  const plan = getPlanDefinition(requestedPlanCode);
  const status = String(payload.status || SUBSCRIPTION_STATUSES.TRIALING).toLowerCase();
  const billingExempt = Boolean(payload.billing_exempt ?? payload.billingExempt);

  // The package catalogue is authoritative. Server rows may be stale after a
  // package change, so only explicit enabled overrides can add capabilities.
  const overrideRows = enabledOverrideKeys(
    payload.entitlement_overrides ?? payload.entitlementOverrides
  );
  const features = new Set([...plan.features, ...overrideRows]);

  const limitOverrides = normaliseObject(payload.limit_overrides ?? payload.limitOverrides);
  // The launch catalogue is authoritative. A stale database plan row must not
  // silently restore older, more generous limits. Only deliberate per-club
  // overrides may change the package limits.
  const limits = normaliseLimits({
    ...plan.limits,
    ...limitOverrides,
  });
  const accessState = plan.code === RESTRICTED_PLAN.code
    ? "read_only"
    : String(payload.access_state || payload.accessState || "read_only").toLowerCase();

  return Object.freeze({
    clubId: payload.club_id || payload.clubId || "",
    planCode: plan.code,
    planName: plan.code === RESTRICTED_PLAN.code
      ? RESTRICTED_PLAN.name
      : payload.plan_name || payload.planName || plan.name,
    status,
    statusLabel: getSubscriptionStatusLabel(status),
    accessState,
    canWrite: accessState === "full",
    isReadOnly: accessState !== "full",
    isInternal: status === SUBSCRIPTION_STATUSES.INTERNAL || billingExempt,
    billingInterval: payload.billing_interval || payload.billingInterval || "monthly",
    trialEndsAt: safeDate(payload.trial_ends_at || payload.trialEndsAt),
    graceEndsAt: safeDate(payload.grace_ends_at || payload.graceEndsAt),
    currentPeriodEnd: safeDate(payload.current_period_end || payload.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end ?? payload.cancelAtPeriodEnd),
    billingExempt,
    features,
    limits,
    plan,
    packageVersion: String(payload.package_version || payload.packageVersion || "").trim(),
    message: String(payload.access_message || payload.accessMessage || "").trim()
      || (plan.code === RESTRICTED_PLAN.code ? "The workspace plan is unrecognised and has been restricted for safety." : ""),
  });
}

export function getSubscriptionStatusLabel(status) {
  const labels = {
    trialing: "Trial",
    active: "Active",
    grace: "Grace period",
    suspended: "Suspended",
    cancelled: "Cancelled",
    internal: "Internal",
  };
  return labels[String(status || "").toLowerCase()] || "Unknown";
}

export function hasEntitlement(subscription, key) {
  if (!key) return true;
  if (!subscription) return false;

  if (subscription.features instanceof Set && subscription.features.has(key)) return true;
  if (Array.isArray(subscription.features) && subscription.features.includes(key)) return true;

  const planCode = subscription.planCode || subscription.plan_code || subscription.plan?.code;
  return getPlanDefinition(planCode).features.includes(key);
}

export function canUseMatchdayWorkspace(subscription) {
  return hasEntitlement(subscription, ENTITLEMENTS.MATCHDAY_SCHEDULING);
}

export function getEntitlementLimit(subscription, key, fallback = 0) {
  const value = Number(subscription?.limits?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function isUnlimitedLimit(value) {
  return Number(value) < 0;
}

export function isAtEntitlementLimit(subscription, key, currentCount = 0) {
  const limit = getEntitlementLimit(subscription, key);
  return !isUnlimitedLimit(limit) && Number(currentCount) >= limit;
}

export function formatEntitlementLimit(value) {
  return isUnlimitedLimit(value) ? "Unlimited" : new Intl.NumberFormat("en-GB").format(Number(value) || 0);
}

export function getRequiredEntitlementForPage(page) {
  return ROUTE_ENTITLEMENTS[String(page || "").toLowerCase()] || null;
}

export function canOpenPage(subscription, page) {
  return hasEntitlement(subscription, getRequiredEntitlementForPage(page));
}

export function getUpgradePlanForEntitlement(entitlement) {
  return getLaunchPlans().find((plan) => plan.features.includes(entitlement)) || PLAN_CATALOGUE[PLAN_CODES.ELITE];
}

export function applySubscriptionAccess(workspaceAccess, subscription) {
  const base = workspaceAccess || {};
  const subscriptionReadOnly = Boolean(subscription?.isReadOnly);
  return Object.freeze({
    ...base,
    subscriptionReadOnly,
    subscriptionStatus: subscription?.status || "unknown",
    subscriptionPlanCode: subscription?.planCode || "",
    subscriptionPlanName: subscription?.planName || "Plan unavailable",
    canOperate: Boolean(base.canOperate) && !subscriptionReadOnly,
    canPublish: Boolean(base.canPublish) && !subscriptionReadOnly,
    isReadOnly: Boolean(base.isReadOnly) || subscriptionReadOnly,
    canManageSubscription: base.role === "owner" && !base.isSupport,
  });
}
