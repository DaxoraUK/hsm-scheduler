import {
  getEntitlementLimit,
  isUnlimitedLimit,
  LIMIT_KEYS,
} from "./entitlements.js";

const LABELS = Object.freeze({
  [LIMIT_KEYS.TEAMS]: "active teams",
  [LIMIT_KEYS.PITCHES]: "active pitches",
  [LIMIT_KEYS.VENUES]: "venues",
  [LIMIT_KEYS.USERS]: "workspace users",
});

export function getVenueCount(club = {}) {
  const sites = Array.isArray(club?.sites) ? club.sites : [];
  return Math.max(1, sites.length || (club?.venue ? 1 : 0));
}

export function evaluatePlanCompliance(subscription, usage = {}) {
  const checks = [
    [LIMIT_KEYS.TEAMS, Number(usage.teams) || 0],
    [LIMIT_KEYS.PITCHES, Number(usage.pitches) || 0],
    [LIMIT_KEYS.VENUES, Number(usage.venues) || 0],
    [LIMIT_KEYS.USERS, Number(usage.users) || 0],
  ].map(([key, current]) => {
    const limit = getEntitlementLimit(subscription, key, 0);
    const over = !isUnlimitedLimit(limit) && current > limit;
    return Object.freeze({
      key,
      label: LABELS[key] || key,
      current,
      limit,
      over,
      excess: over ? current - limit : 0,
    });
  });

  const overages = checks.filter((item) => item.over);
  return Object.freeze({
    compliant: overages.length === 0,
    operationalBlocked: overages.some((item) =>
      [LIMIT_KEYS.TEAMS, LIMIT_KEYS.PITCHES, LIMIT_KEYS.VENUES].includes(item.key),
    ),
    checks: Object.freeze(checks),
    overages: Object.freeze(overages),
  });
}

export function formatPlanOverage(compliance) {
  const first = compliance?.overages?.[0];
  if (!first) return "Workspace is within its plan limits.";
  const limit = first.limit < 0 ? "unlimited" : first.limit;
  return `${first.current} ${first.label} are configured; the plan allows ${limit}.`;
}
