import { describe, expect, test } from "vitest";
import { DAXORA_PRODUCT_CODES, getDaxoraProducts } from "../../src/lib/platform/products.js";
import {
  ENTITLEMENTS,
  PLAN_CODES,
  PRODUCT_ENTITLEMENTS,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";

function product(products, code) { return products.find((item) => item.code === code); }

describe("Daxora platform product launcher", () => {
  test("keeps Ground Control available and does not expose restricted workspaces", () => {
    const products = getDaxoraProducts({ subscription: normaliseSubscriptionPayload({ plan_code: PLAN_CODES.CORE, access_state: "full" }) });
    expect(product(products, DAXORA_PRODUCT_CODES.GROUND_CONTROL)).toMatchObject({ state: "available", canOpen: true, productEntitled: true, entitlementSource: "club_subscription", active: false });
    expect(product(products, DAXORA_PRODUCT_CODES.LEAGUE_MANAGER)).toMatchObject({ state: "unavailable", canOpen: false, productEntitled: false, entitlementSource: "league_membership" });
    expect(product(products, DAXORA_PRODUCT_CODES.PLATFORM_ADMIN)).toBeUndefined();
  });

  test("treats explicit product entitlements as an additional subscription boundary", () => {
    const subscription = normaliseSubscriptionPayload({
      plan_code: PLAN_CODES.PRO,
      access_state: "full",
      product_entitlements: [PRODUCT_ENTITLEMENTS.GROUND_CONTROL],
    });
    const products = getDaxoraProducts({
      subscription,
      workspaceAccess: { role: "admin", canManageSettings: true },
    });
    expect(product(products, DAXORA_PRODUCT_CODES.GROUND_CONTROL)).toMatchObject({ state: "available", canOpen: true });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "upgrade", canOpen: false });
  });

  test("does not let a product grant bypass its underlying feature entitlement", () => {
    const subscription = normaliseSubscriptionPayload({
      plan_code: PLAN_CODES.CORE,
      access_state: "full",
      product_entitlements: [PRODUCT_ENTITLEMENTS.GROUND_CONTROL, PRODUCT_ENTITLEMENTS.COACH_HUB],
    });
    const products = getDaxoraProducts({
      subscription,
      workspaceAccess: { role: "admin", canManageSettings: true },
    });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "upgrade", canOpen: false });
  });

  test("derives product visibility from subscription and authenticated memberships", () => {
    const products = getDaxoraProducts({ subscription: { planName: "Pro", features: [ENTITLEMENTS.COACH_HUB] }, leagueAvailable: true, platformStaff: true, activeProduct: DAXORA_PRODUCT_CODES.LEAGUE_MANAGER });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "managed", canOpen: false });
    expect(product(products, DAXORA_PRODUCT_CODES.LEAGUE_MANAGER)).toMatchObject({ state: "available", canOpen: true, productEntitled: true, entitlementSource: "league_membership", active: true });
    expect(product(products, DAXORA_PRODUCT_CODES.PLATFORM_ADMIN)).toMatchObject({ state: "available", canOpen: true, productEntitled: true, entitlementSource: "platform_role" });
  });

  test("labels Daxora Pay honestly until its secure product boundary exists", () => {
    expect(product(getDaxoraProducts(), DAXORA_PRODUCT_CODES.DAXORA_PAY)).toMatchObject({ state: "coming_soon", canOpen: false });
  });

  test("routes authorised club managers to Coach Hub administration", () => {
    const products = getDaxoraProducts({
      subscription: { planName: "Pro", features: [ENTITLEMENTS.COACH_HUB] },
      workspaceAccess: { role: "admin", canManageSettings: true },
    });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "available", canOpen: true, target: "coach_admin" });
  });

  test("opens a multi-role team manager's own Coach Hub rather than the admin panel", () => {
    const products = getDaxoraProducts({
      subscription: normaliseSubscriptionPayload({ plan_code: PLAN_CODES.PRO, access_state: "full" }),
      workspaceAccess: { role: "owner", canManageSettings: true, isCoach: true },
      coachUser: true,
    });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "available", canOpen: true, target: "coach" });
    expect(product(products, DAXORA_PRODUCT_CODES.GROUND_CONTROL)).toMatchObject({ state: "available", canOpen: true, target: "dashboard" });
  });

  test("keeps a genuinely coach-only account out of Ground Control", () => {
    const products = getDaxoraProducts({
      subscription: normaliseSubscriptionPayload({ plan_code: PLAN_CODES.PRO, access_state: "full" }),
      workspaceAccess: { role: "coach", isCoach: true, isCoachOnly: true },
      coachUser: true,
      coachOnly: true,
    });
    expect(product(products, DAXORA_PRODUCT_CODES.GROUND_CONTROL)).toMatchObject({ state: "unavailable", canOpen: false });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "available", canOpen: true, target: "coach" });
  });
});
