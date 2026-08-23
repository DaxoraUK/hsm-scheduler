import { canOpenPage } from "../subscriptions/entitlements.js";

export const CLUB_COMMAND_PAGE = "executive";
export const COMMUNICATIONS_PAGE = "communications";

export function canOpenClubCommand(workspaceAccess = null) {
  return Boolean(workspaceAccess?.canViewAudit && !workspaceAccess?.isSupport);
}

export function canOpenWorkspacePage(subscription, page, workspaceAccess = null) {
  const normalisedPage = String(page || "").toLowerCase();
  if (!canOpenPage(subscription, normalisedPage)) return false;
  if (normalisedPage === CLUB_COMMAND_PAGE) return canOpenClubCommand(workspaceAccess);
  if (normalisedPage === COMMUNICATIONS_PAGE) return Boolean(workspaceAccess?.canCommunicate);
  return true;
}
