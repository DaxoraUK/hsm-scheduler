import { describe, expect, test } from "vitest";
import {
  applySubscriptionAccess,
  canOpenPage,
  ENTITLEMENTS,
  getEntitlementLimit,
  hasEntitlement,
  LIMIT_KEYS,
  normaliseSubscriptionPayload,
  PLAN_CATALOGUE,
  getUpgradePlanForEntitlement,
} from "../../src/lib/subscriptions/entitlements.js";
import { createWorkspaceAccess } from "../../src/lib/security/permissions.js";

describe("plan entitlement model", () => {
  test("the entry plan is named Link everywhere in the catalogue", () => {
    expect(PLAN_CATALOGUE.link.name).toBe("Link");
    expect(PLAN_CATALOGUE.link.name).not.toContain("Club");
    expect(PLAN_CATALOGUE.link.monthlyPricePence).toBe(2900);
    expect(PLAN_CATALOGUE.link.annualPricePence).toBe(29000);
  });

  test("Link keeps league communications but not the Core matchday workspace", () => {
    const link = normaliseSubscriptionPayload({
      plan_code: "link",
      status: "active",
      access_state: "full",
      entitlements: PLAN_CATALOGUE.link.features,
      limits: PLAN_CATALOGUE.link.limits,
    });
    expect(hasEntitlement(link, ENTITLEMENTS.LEAGUE_LINK)).toBe(true);
    expect(hasEntitlement(link, ENTITLEMENTS.COMMUNICATIONS)).toBe(true);
    expect(hasEntitlement(link, ENTITLEMENTS.MATCHDAY_SCHEDULING)).toBe(false);
    expect(canOpenPage(link, "operations")).toBe(false);
    expect(canOpenPage(link, "communications")).toBe(true);
    expect(getEntitlementLimit(link, LIMIT_KEYS.TEAMS)).toBe(4);
  });

  test("Core opens current operational routes while advanced analytics remains Pro", () => {
    const core = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      entitlements: PLAN_CATALOGUE.core.features,
      limits: PLAN_CATALOGUE.core.limits,
    });
    expect(canOpenPage(core, "operations")).toBe(true);
    expect(canOpenPage(core, "analytics")).toBe(true);
    expect(canOpenPage(core, "reports")).toBe(true);
    expect(hasEntitlement(core, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(false);
    expect(hasEntitlement(core, ENTITLEMENTS.MULTI_VENUE)).toBe(false);
  });

  test("Pro enables advanced operations, reporting, analytics and integrations", () => {
    const pro = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "pro",
      status: "active",
      access_state: "full",
      entitlements: PLAN_CATALOGUE.pro.features,
      limits: PLAN_CATALOGUE.pro.limits,
    });

    expect(hasEntitlement(pro, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(true);
    expect(hasEntitlement(pro, ENTITLEMENTS.MULTI_VENUE)).toBe(true);
    expect(getUpgradePlanForEntitlement(ENTITLEMENTS.OPERATIONS_ADVANCED).code).toBe("pro");
  });

  test("page gates fall back to the authoritative package when effective features are stale", () => {
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

    expect(hasEntitlement(serialisedElite, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(hasEntitlement(serialisedElite, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(true);
    expect(hasEntitlement(serialisedPro, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(hasEntitlement(serialisedPro, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(true);
    expect(hasEntitlement({ planCode: "core", features: [] }, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(false);
  });

  test("the selected package remains authoritative over a stale restricted server list", () => {
    const eliteWithRestrictedFeatures = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "elite",
      status: "active",
      access_state: "full",
      entitlements: [ENTITLEMENTS.DASHBOARD],
      limits: {},
    });

    expect(hasEntitlement(eliteWithRestrictedFeatures, ENTITLEMENTS.DASHBOARD)).toBe(true);
    expect(hasEntitlement(eliteWithRestrictedFeatures, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(true);
  });

  test("internal billing-exempt Elite workspaces always receive the complete Elite matrix", () => {
    const internalElite = normaliseSubscriptionPayload({
      club_id: "club-test",
      plan_code: "elite",
      status: "internal",
      billing_exempt: true,
      access_state: "full",
      entitlements: PLAN_CATALOGUE.core.features,
      limits: {},
    });

    expect(hasEntitlement(internalElite, ENTITLEMENTS.OPERATIONS_ADVANCED)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.REPORTS_ADVANCED)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.ANALYTICS_ADVANCED)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.ADVANCED_INTEGRATIONS)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.MULTI_VENUE)).toBe(true);
    expect(hasEntitlement(internalElite, ENTITLEMENTS.PREMIUM_SUPPORT)).toBe(true);
  });

  test("a suspended subscription removes mutation rights without removing owner administration", () => {
    const roleAccess = createWorkspaceAccess({ role: "owner" });
    const subscription = normaliseSubscriptionPayload({
      plan_code: "elite",
      status: "suspended",
      access_state: "read_only",
      entitlements: PLAN_CATALOGUE.elite.features,
      limits: PLAN_CATALOGUE.elite.limits,
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
    expect(applySubscriptionAccess(roleAccess, subscription).canManageSubscription).toBe(false);
  });
});
