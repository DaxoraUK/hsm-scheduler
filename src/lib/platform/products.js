import { ENTITLEMENTS, hasEntitlement } from "../subscriptions/entitlements.js";

export const DAXORA_PRODUCT_CODES = Object.freeze({
  GROUND_CONTROL: "ground_control",
  COACH_HUB: "coach_hub",
  LEAGUE_MANAGER: "league_manager",
  DAXORA_PAY: "daxora_pay",
  PLATFORM_ADMIN: "platform_admin",
});

const PRODUCT_DEFINITIONS = Object.freeze([
  Object.freeze({ code: DAXORA_PRODUCT_CODES.GROUND_CONTROL, name: "Ground Control", description: "Fixtures, facilities, people and matchday operations.", accent: "emerald" }),
  Object.freeze({ code: DAXORA_PRODUCT_CODES.COACH_HUB, name: "Coach Hub", description: "Team requests, conversations and coach-facing actions.", accent: "sky" }),
  Object.freeze({ code: DAXORA_PRODUCT_CODES.LEAGUE_MANAGER, name: "League Manager", description: "League fixtures, competitions, clubs and officials.", accent: "violet" }),
  Object.freeze({ code: DAXORA_PRODUCT_CODES.DAXORA_PAY, name: "Daxora Pay", description: "Memberships, collections, arrears and reconciliation.", accent: "amber" }),
  Object.freeze({ code: DAXORA_PRODUCT_CODES.PLATFORM_ADMIN, name: "Daxora Admin", description: "Platform subscriptions, support and governance.", accent: "slate" }),
]);

export function getDaxoraProducts({ subscription = null, workspaceAccess = null, clubAvailable = true, coachUser = false, coachOnly = false, leagueAvailable = false, platformStaff = false, activeProduct = "" } = {}) {
  return PRODUCT_DEFINITIONS.map((product) => {
    let state = "unavailable";
    let detail = "Not included for this account";
    let target = null;

    if (product.code === DAXORA_PRODUCT_CODES.GROUND_CONTROL) {
      state = clubAvailable && !coachOnly ? "available" : "unavailable";
      detail = coachOnly ? "Your role opens Coach Hub" : subscription?.planName ? `${subscription.planName} workspace` : clubAvailable ? "Club operations" : "Club membership required";
      target = state === "available" ? "dashboard" : null;
    } else if (product.code === DAXORA_PRODUCT_CODES.COACH_HUB) {
      const included = hasEntitlement(subscription, ENTITLEMENTS.COACH_HUB);
      const canManage = Boolean(workspaceAccess?.canManageSettings);
      state = included && (coachUser || canManage) ? "available" : included ? "managed" : "upgrade";
      detail = coachUser && included ? "Your team workspace" : canManage && included ? "Manage coaches and team access" : included ? "Available to authorised coaches" : "Available with Pro or Elite";
      target = coachUser && included ? "coach" : canManage && included ? "coach_admin" : null;
    } else if (product.code === DAXORA_PRODUCT_CODES.LEAGUE_MANAGER) {
      state = leagueAvailable ? "available" : "unavailable";
      detail = leagueAvailable ? "League access confirmed" : "League membership required";
      target = leagueAvailable ? "league" : null;
    } else if (product.code === DAXORA_PRODUCT_CODES.DAXORA_PAY) {
      state = "coming_soon";
      detail = "In development";
    } else if (product.code === DAXORA_PRODUCT_CODES.PLATFORM_ADMIN) {
      state = platformStaff ? "available" : "hidden";
      detail = "Platform staff only";
      target = platformStaff ? "platform" : null;
    }

    return { ...product, state, detail, target, active: product.code === activeProduct, visible: state !== "hidden", canOpen: state === "available" && Boolean(target), role: workspaceAccess?.role || "viewer" };
  }).filter((product) => product.visible);
}
