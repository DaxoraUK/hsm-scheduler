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
  ENTITLEMENTS.DATA_EXPORT,
];

const coreFeatures = [
  ...linkFeatures,
  ENTITLEMENTS.MATCHDAY_SCHEDULING,
  ENTITLEMENTS.MIDWEEK_SCHEDULING,
  ENTITLEMENTS.PITCH_INTELLIGENCE,
  ENTITLEMENTS.PARKING_INTELLIGENCE,
  ENTITLEMENTS.WEATHER_INTELLIGENCE,
  ENTITLEMENTS.OFFICIALS_MANAGEMENT,
  ENTITLEMENTS.REPORTS_OPERATIONS,
  ENTITLEMENTS.ANALYTICS_CORE,
];

const proFeatures = [
  ...coreFeatures,
  ENTITLEMENTS.OPERATIONS_ADVANCED,
  ENTITLEMENTS.REPORTS_ADVANCED,
  ENTITLEMENTS.ANALYTICS_ADVANCED,
  ENTITLEMENTS.MULTI_VENUE,
  ENTITLEMENTS.PRIORITY_SUPPORT,
  ENTITLEMENTS.ADVANCED_INTEGRATIONS,
];

export const PLAN_CATALOGUE = Object.freeze({
  [PLAN_CODES.LINK]: Object.freeze({
    code: PLAN_CODES.LINK,
    name: "Link",
    strapline: "The operational connection between a club and its league.",
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
  }),
  [PLAN_CODES.CORE]: Object.freeze({
    code: PLAN_CODES.CORE,
    name: "Core",
    strapline: "Complete matchday control for established grassroots clubs.",
    monthlyPricePence: 14900,
    annualPricePence: null,
    features: Object.freeze(coreFeatures),
    limits: Object.freeze({
      teams: 20,
      venues: 1,
      users: 6,
      pitches: 20,
      history_entries: 104,
      history_retention_days: 365,
    }),
  }),
  [PLAN_CODES.PRO]: Object.freeze({
    code: PLAN_CODES.PRO,
    name: "Pro",
    strapline: "Advanced intelligence, reporting and capacity for larger clubs.",
    monthlyPricePence: 24900,
    annualPricePence: null,
    features: Object.freeze(proFeatures),
    limits: Object.freeze({
      teams: 40,
      venues: 3,
      users: 15,
      pitches: 50,
      history_entries: 260,
      history_retention_days: 1095,
    }),
  }),
  [PLAN_CODES.ELITE]: Object.freeze({
    code: PLAN_CODES.ELITE,
    name: "Elite",
    strapline: "Multi-site operations, premium support and bespoke scale.",
    monthlyPricePence: 39900,
    annualPricePence: null,
    features: Object.freeze([
      ...proFeatures,
      ENTITLEMENTS.PREMIUM_SUPPORT,
    ]),
    limits: Object.freeze({
      teams: -1,
      venues: -1,
      users: -1,
      pitches: -1,
      history_entries: -1,
      history_retention_days: -1,
    }),
  }),
});

export const ROUTE_ENTITLEMENTS = Object.freeze({
  dashboard: ENTITLEMENTS.DASHBOARD,
  operations: ENTITLEMENTS.MATCHDAY_SCHEDULING,
  communications: ENTITLEMENTS.COMMUNICATIONS,
  analytics: ENTITLEMENTS.ANALYTICS_CORE,
  reports: ENTITLEMENTS.REPORTS_OPERATIONS,
});

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseLimits(limits = {}) {
  return Object.fromEntries(
    Object.values(LIMIT_KEYS).map((key) => {
      const raw = Number(limits?.[key]);
      return [key, Number.isFinite(raw) ? raw : -1];
    })
  );
}

export function getPlanDefinition(code = PLAN_CODES.CORE) {
  return PLAN_CATALOGUE[String(code || "").toLowerCase()] || PLAN_CATALOGUE[PLAN_CODES.CORE];
}

function parseEntitlementRows(payload, fallback = []) {
  const candidate =
    payload?.entitlements ??
    payload?.effective_entitlements ??
    payload?.effectiveEntitlements ??
    payload?.features;

  if (Array.isArray(candidate)) return candidate;

  if (candidate instanceof Set) return [...candidate];

  if (typeof candidate === "string") {
    const value = candidate.trim();
    if (!value) return [];

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // PostgreSQL text-array and comma-separated fallbacks are handled below.
    }

    const withoutBraces = value.startsWith("{") && value.endsWith("}")
      ? value.slice(1, -1)
      : value;

    return withoutBraces
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }

  return fallback;
}

export function normaliseSubscriptionPayload(payload = {}) {
  const plan = getPlanDefinition(payload.plan_code || payload.planCode);
  const featureRows = parseEntitlementRows(payload, plan.features);
  const features = new Set(featureRows.map((item) => String(item || "").trim()).filter(Boolean));
  const limits = normaliseLimits({ ...plan.limits, ...(payload.limits || {}) });
  const status = String(payload.status || SUBSCRIPTION_STATUSES.TRIALING).toLowerCase();
  const accessState = String(payload.access_state || payload.accessState || "read_only").toLowerCase();

  return Object.freeze({
    clubId: payload.club_id || payload.clubId || "",
    planCode: plan.code,
    planName: payload.plan_name || payload.planName || plan.name,
    status,
    statusLabel: getSubscriptionStatusLabel(status),
    accessState,
    canWrite: accessState === "full",
    isReadOnly: accessState !== "full",
    isInternal: status === SUBSCRIPTION_STATUSES.INTERNAL || Boolean(payload.billing_exempt ?? payload.billingExempt),
    billingInterval: payload.billing_interval || payload.billingInterval || "monthly",
    trialEndsAt: safeDate(payload.trial_ends_at || payload.trialEndsAt),
    graceEndsAt: safeDate(payload.grace_ends_at || payload.graceEndsAt),
    currentPeriodEnd: safeDate(payload.current_period_end || payload.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(payload.cancel_at_period_end ?? payload.cancelAtPeriodEnd),
    billingExempt: Boolean(payload.billing_exempt ?? payload.billingExempt),
    features,
    limits,
    plan,
    message: String(payload.access_message || payload.accessMessage || "").trim(),
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
  if (subscription.features instanceof Set) return subscription.features.has(key);
  if (Array.isArray(subscription.features)) return subscription.features.includes(key);
  return false;
}

export function canUseMatchdayWorkspace(subscription) {
  if (!subscription) return false;
  if (String(subscription.planCode || "").toLowerCase() === PLAN_CODES.LINK) return false;
  return hasEntitlement(subscription, ENTITLEMENTS.MATCHDAY_SCHEDULING);
}

export function getEntitlementLimit(subscription, key, fallback = -1) {
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
  const plans = Object.values(PLAN_CATALOGUE);
  return plans.find((plan) => plan.features.includes(entitlement)) || PLAN_CATALOGUE[PLAN_CODES.ELITE];
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
