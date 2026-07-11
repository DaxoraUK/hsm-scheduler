import { describe, expect, test } from "vitest";
import {
  ENTITLEMENTS,
  LIMIT_KEYS,
  PLAN_CATALOGUE,
  getEntitlementLimit,
  hasEntitlement,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";

describe("subscription package authority", () => {
  test("Elite stays Elite when a stale Core effective list is returned", () => {
    const subscription = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "elite",
      status: "active",
      access_state: "full",
      entitlements: PLAN_CATALOGUE.core.features,
      plan_entitlements: PLAN_CATALOGUE.core.features,
      entitlement_overrides: { analytics_advanced: false },
      limits: PLAN_CATALOGUE.core.limits,
      plan_limits: PLAN_CATALOGUE.elite.limits,
      limit_overrides: {},
    });

    expect(hasEntitlement(subscription, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(
      true,
    );
    expect(hasEntitlement(subscription, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(
      true,
    );
    expect(hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(
      true,
    );
    expect(
      hasEntitlement(subscription, ENTITLEMENTS.ADVANCED_INTEGRATIONS),
    ).toBe(false);
    expect(getEntitlementLimit(subscription, LIMIT_KEYS.TEAMS)).toBe(-1);
  });

  test("explicit true overrides can add a controlled extra without removing package rights", () => {
    const subscription = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "core",
      status: "active",
      access_state: "full",
      entitlement_overrides: { analytics_advanced: true },
      plan_limits: PLAN_CATALOGUE.core.limits,
      limit_overrides: { teams: 30 },
    });

    expect(hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(
      true,
    );
    expect(hasEntitlement(subscription, ENTITLEMENTS.MATCHDAY_SCHEDULING)).toBe(
      true,
    );
    expect(getEntitlementLimit(subscription, LIMIT_KEYS.TEAMS)).toBe(30);
  });
});
