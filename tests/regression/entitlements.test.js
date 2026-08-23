import { describe, expect, test } from "vitest";
import {
  applySubscriptionAccess,
  canOpenPage,
  ENTITLEMENTS,
  getAssignablePlans,
  getEntitlementLimit,
  getLaunchPlans,
  getUpgradePlanForEntitlement,
  hasEntitlement,
  hasProductEntitlement,
  LIMIT_KEYS,
  normaliseSubscriptionPayload,
  PLAN_CATALOGUE,
  PRODUCT_ENTITLEMENTS,
} from "../../src/lib/subscriptions/entitlements.js";
import { createWorkspaceAccess } from "../../src/lib/security/permissions.js";

describe("plan entitlement model", () => {
  test("holds Link outside the launch and assignment catalogues", () => {
    expect(PLAN_CATALOGUE.link.name).toBe("Link");
    expect(PLAN_CATALOGUE.link.monthlyPricePence).toBe(2900);
    expect(PLAN_CATALOGUE.link.launchStatus).toBe("held");
    expect(getLaunchPlans().map((plan) => plan.code)).toEqual([
      "core",
      "pro",
      "elite",
    ]);
    expect(getAssignablePlans().map((plan) => plan.code)).toEqual([
      "core",
      "pro",
      "elite",
    ]);
    expect(
      getAssignablePlans({ includeCode: "link" }).map((plan) => plan.code),
    ).toContain("link");
  });

  test("Link keeps its future league connection but not the matchday workspace or export", () => {
    const link = normaliseSubscriptionPayload({
      plan_code: "link",
      status: "active",
      access_state: "full",
      limits: PLAN_CATALOGUE.link.limits,
    });
    expect(hasEntitlement(link, ENTITLEMENTS.LEAGUE_LINK)).toBe(true);
    expect(hasEntitlement(link, ENTITLEMENTS.COMMUNICATIONS)).toBe(true);
    expect(hasEntitlement(link, ENTITLEMENTS.MATCHDAY_SCHEDULING)).toBe(false);
    expect(hasEntitlement(link, ENTITLEMENTS.DATA_EXPORT)).toBe(false);
    expect(canOpenPage(link, "operations")).toBe(false);
    expect(getEntitlementLimit(link, LIMIT_KEYS.TEAMS)).toBe(4);
  });

  test("Core includes day scheduling and operational evidence but not cross-day Pro surfaces", () => {
    const core = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      limits: PLAN_CATALOGUE.core.limits,
    });
    expect(canOpenPage(core, "operations")).toBe(true);
    expect(canOpenPage(core, "analytics")).toBe(true);
    expect(canOpenPage(core, "reports")).toBe(true);
    expect(hasEntitlement(core, ENTITLEMENTS.DATA_EXPORT)).toBe(true);
    expect(hasEntitlement(core, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.MULTI_VENUE)).toBe(false);
    expect(hasProductEntitlement(core, PRODUCT_ENTITLEMENTS.GROUND_CONTROL, ENTITLEMENTS.DASHBOARD)).toBe(true);
    expect(hasProductEntitlement(core, PRODUCT_ENTITLEMENTS.COACH_HUB, ENTITLEMENTS.COACH_HUB)).toBe(false);
  });

  test("explicit product entitlements can narrow but never expand package features", () => {
    const pro = normaliseSubscriptionPayload({
      plan_code: "pro",
      status: "active",
      access_state: "full",
      product_entitlements: { ground_control: true, coach_hub: false, unknown_product: true },
    });
    expect([...pro.productEntitlements]).toEqual([PRODUCT_ENTITLEMENTS.GROUND_CONTROL]);
    expect(hasProductEntitlement(pro, PRODUCT_ENTITLEMENTS.GROUND_CONTROL, ENTITLEMENTS.DASHBOARD)).toBe(true);
    expect(hasProductEntitlement(pro, PRODUCT_ENTITLEMENTS.COACH_HUB, ENTITLEMENTS.COACH_HUB)).toBe(false);

    const core = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      product_entitlements: [PRODUCT_ENTITLEMENTS.COACH_HUB],
    });
    expect(hasProductEntitlement(core, PRODUCT_ENTITLEMENTS.COACH_HUB, ENTITLEMENTS.COACH_HUB)).toBe(false);
  });

  test("Pro enables delivered advanced operations, reporting, analytics and multi-venue capability", () => {
    const pro = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "pro",
      status: "active",
      access_state: "full",
      limits: PLAN_CATALOGUE.pro.limits,
    });

    expect(hasEntitlement(pro, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.MULTI_VENUE)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(false);
    expect(hasEntitlement(pro, ENTITLEMENTS.PRIORITY_SUPPORT)).toBe(false);
    expect(
      getUpgradePlanForEntitlement(ENTITLEMENTS.OPERATIONS_ADVANCED).code,
    ).toBe("pro");
  });

  test("page gates fall back to the authoritative package when effective rows are stale", () => {
    const serialisedElite = {
      planCode: "elite",
      plan: PLAN_CATALOGUE.elite,
      features: [],
    };
    const serialisedPro = {
      planCode: "pro",
      plan: PLAN_CATALOGUE.pro,
      features: [],
    };

    expect(
      hasEntitlement(serialisedElite, ENTITLEMENTS.ANALYTICS_ADVANCED),
    ).toBe(true);
    expect(
      hasEntitlement(serialisedElite, ENTITLEMENTS.ADVANCED_INTEGRATIONS),
    ).toBe(false);
    expect(hasEntitlement(serialisedPro, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(
      true,
    );
    expect(
      hasEntitlement(serialisedPro, ENTITLEMENTS.ADVANCED_INTEGRATIONS),
    ).toBe(false);
    expect(
      hasEntitlement(
        { planCode: "core", features: [] },
        ENTITLEMENTS.ANALYTICS_ADVANCED,
      ),
    ).toBe(false);
  });

  test("unknown plans fail closed", () => {
    const unknown = normaliseSubscriptionPayload({
      plan_code: "future_unknown_plan",
      status: "active",
      access_state: "full",
    });
    expect(unknown.planCode).toBe("unverified");
    expect(unknown.isReadOnly).toBe(true);
    expect(hasEntitlement(unknown, ENTITLEMENTS.DASHBOARD)).toBe(false);
    expect(getEntitlementLimit(unknown, LIMIT_KEYS.TEAMS)).toBe(0);
  });

  test("internal billing-exempt Elite receives the delivered Elite organisation matrix and contracted starting band", () => {
    const internalElite = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "elite",
      status: "internal",
      billing_exempt: true,
      access_state: "full",
      plan_limits: PLAN_CATALOGUE.elite.limits,
    });

    expect(
      hasEntitlement(internalElite, ENTITLEMENTS.OPERATIONS_ADVANCED),
    ).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(
      true,
    );
    expect(hasEntitlement(internalElite, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(
      true,
    );
    expect(hasEntitlement(internalElite, ENTITLEMENTS.MULTI_VENUE)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.PREMIUM_SUPPORT)).toBe(
      false,
    );
    expect(hasEntitlement(internalElite, ENTITLEMENTS.ORGANISATION_COMMAND)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.EXECUTIVE_REPORTING)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.GOVERNANCE_CONTROLS)).toBe(true);
    expect(getEntitlementLimit(internalElite, LIMIT_KEYS.TEAMS)).toBe(60);
  });

  test("a suspended subscription removes mutation rights without removing owner administration", () => {
    const roleAccess = createWorkspaceAccess({ role: "owner" });
    const subscription = normaliseSubscriptionPayload({
      plan_code: "elite",
      status: "suspended",
      access_state: "read_only",
    });
    const access = applySubscriptionAccess(roleAccess, subscription);
    expect(access.isReadOnly).toBe(true);
    expect(access.canOperate).toBe(false);
    expect(access.canPublish).toBe(false);
    expect(access.canManageSettings).toBe(true);
    expect(access.canManageSubscription).toBe(true);
  });

  test("administrators cannot manage the commercial subscription", () => {
    const roleAccess = createWorkspaceAccess({ role: "admin" });
    const subscription = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
    });
    expect(
      applySubscriptionAccess(roleAccess, subscription).canManageSubscription,
    ).toBe(false);
  });
});
