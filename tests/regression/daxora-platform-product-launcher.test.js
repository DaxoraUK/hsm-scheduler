import { describe, expect, test } from "vitest";
import { DAXORA_PRODUCT_CODES, getDaxoraProducts } from "../../src/lib/platform/products.js";
import { ENTITLEMENTS } from "../../src/lib/subscriptions/entitlements.js";

function product(products, code) { return products.find((item) => item.code === code); }

describe("Daxora platform product launcher", () => {
  test("keeps Ground Control available and does not expose restricted workspaces", () => {
    const products = getDaxoraProducts({ subscription: { planName: "Core", features: [] } });
    expect(product(products, DAXORA_PRODUCT_CODES.GROUND_CONTROL)).toMatchObject({ state: "available", canOpen: true, active: false });
    expect(product(products, DAXORA_PRODUCT_CODES.LEAGUE_MANAGER)).toMatchObject({ state: "unavailable", canOpen: false });
    expect(product(products, DAXORA_PRODUCT_CODES.PLATFORM_ADMIN)).toBeUndefined();
  });

  test("derives product visibility from subscription and authenticated memberships", () => {
    const products = getDaxoraProducts({ subscription: { planName: "Pro", features: [ENTITLEMENTS.COACH_HUB] }, leagueAvailable: true, platformStaff: true, activeProduct: DAXORA_PRODUCT_CODES.LEAGUE_MANAGER });
    expect(product(products, DAXORA_PRODUCT_CODES.COACH_HUB)).toMatchObject({ state: "managed", canOpen: false });
    expect(product(products, DAXORA_PRODUCT_CODES.LEAGUE_MANAGER)).toMatchObject({ state: "available", canOpen: true, active: true });
    expect(product(products, DAXORA_PRODUCT_CODES.PLATFORM_ADMIN)).toMatchObject({ state: "available", canOpen: true });
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
});
