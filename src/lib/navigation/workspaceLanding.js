import { canOpenWorkspacePage } from "./workspacePageAccess.js";

export const LAST_WORKSPACE_PAGE_KEY = "lastWorkspacePage";

const REMEMBERABLE_PAGES = Object.freeze([
  "dashboard",
  "executive",
  "operations",
  "planner",
  "communications",
  "analytics",
  "reports",
  "settings",
]);

function hasRole(workspaceAccess, role) {
  return Array.isArray(workspaceAccess?.effectiveRoles)
    && workspaceAccess.effectiveRoles.includes(role);
}

export function isRememberableWorkspacePage(page) {
  return REMEMBERABLE_PAGES.includes(String(page || "").toLowerCase());
}

export function canLandOnWorkspacePage(subscription, page, workspaceAccess = null) {
  const normalisedPage = String(page || "").toLowerCase();
  return isRememberableWorkspacePage(normalisedPage)
    && canOpenWorkspacePage(subscription, normalisedPage, workspaceAccess);
}

export function resolveWorkspaceLanding({
  workspaceAccess = null,
  subscription = null,
  rememberedPage = "",
} = {}) {
  const remembered = String(rememberedPage || "").toLowerCase();
  if (canLandOnWorkspacePage(subscription, remembered, workspaceAccess)) return remembered;

  const candidates = [];

  if (hasRole(workspaceAccess, "treasurer")) candidates.push("analytics");
  if (
    hasRole(workspaceAccess, "chair")
    || hasRole(workspaceAccess, "club_secretary")
    || hasRole(workspaceAccess, "welfare_officer")
  ) candidates.push("executive");
  if (workspaceAccess?.canOperate) candidates.push("operations");
  if (workspaceAccess?.canCommunicate) candidates.push("communications");
  candidates.push("dashboard", "reports", "analytics");

  return candidates.find((page) => canLandOnWorkspacePage(subscription, page, workspaceAccess)) || "dashboard";
}
