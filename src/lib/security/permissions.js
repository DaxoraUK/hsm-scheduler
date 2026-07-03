export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  SCHEDULER: "scheduler",
  VIEWER: "viewer",
  SUPPORT: "support",
});

export const WORKSPACE_PERMISSIONS = Object.freeze({
  READ_WORKSPACE: "read_workspace",
  OPERATE_MATCHDAYS: "operate_matchdays",
  PUBLISH_MATCHWEEKS: "publish_matchweeks",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_MEMBERS: "manage_members",
  VIEW_AUDIT: "view_audit",
  MANAGE_SUPPORT: "manage_support",
  TRANSFER_OWNERSHIP: "transfer_ownership",
});

const ROLE_LABELS = Object.freeze({
  owner: "Club Owner",
  admin: "Club Administrator",
  scheduler: "Scheduler",
  viewer: "Viewer",
  support: "Daxora Support",
});

const ROLE_DESCRIPTIONS = Object.freeze({
  owner: "Full control, including ownership transfer and time-limited support access.",
  admin: "Manages club settings, users and day-to-day operations, but cannot transfer ownership.",
  scheduler: "Builds and publishes matchdays without access to club administration.",
  viewer: "Can review the workspace but cannot change or publish anything.",
  support: "Time-limited, visibly read-only support access using the support agent's own account.",
});

const ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(Object.values(WORKSPACE_PERMISSIONS)),
  admin: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.MANAGE_SETTINGS,
    WORKSPACE_PERMISSIONS.MANAGE_MEMBERS,
    WORKSPACE_PERMISSIONS.VIEW_AUDIT,
  ]),
  scheduler: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
  ]),
  viewer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  support: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
});

export function getWorkspaceRole(membership = null) {
  if (membership?.accessMode === "support") return WORKSPACE_ROLES.SUPPORT;
  const role = String(membership?.role || WORKSPACE_ROLES.VIEWER).toLowerCase();
  return ROLE_PERMISSIONS[role] ? role : WORKSPACE_ROLES.VIEWER;
}

export function getRoleLabel(role = WORKSPACE_ROLES.VIEWER) {
  return ROLE_LABELS[String(role || "").toLowerCase()] || "Club Member";
}

export function getRoleDescription(role = WORKSPACE_ROLES.VIEWER) {
  return ROLE_DESCRIPTIONS[String(role || "").toLowerCase()] || ROLE_DESCRIPTIONS.viewer;
}

export function roleHasPermission(role, permission) {
  return Boolean(ROLE_PERMISSIONS[String(role || "").toLowerCase()]?.has(permission));
}

export function createWorkspaceAccess(membership = null) {
  const role = getWorkspaceRole(membership);
  const accessMode = membership?.accessMode === "support" ? "support" : "membership";
  const has = (permission) => roleHasPermission(role, permission);
  const isSupport = accessMode === "support";

  return Object.freeze({
    role,
    roleLabel: getRoleLabel(role),
    accessMode,
    isSupport,
    isReadOnly: isSupport || !has(WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS),
    canRead: has(WORKSPACE_PERMISSIONS.READ_WORKSPACE),
    canOperate: !isSupport && has(WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS),
    canPublish: !isSupport && has(WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS),
    canManageSettings: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SETTINGS),
    canManageMembers: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_MEMBERS),
    canViewAudit: !isSupport && has(WORKSPACE_PERMISSIONS.VIEW_AUDIT),
    canManageSupport: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SUPPORT),
    canTransferOwnership: !isSupport && has(WORKSPACE_PERMISSIONS.TRANSFER_OWNERSHIP),
    supportSessionId: membership?.supportSessionId || null,
    supportExpiresAt: membership?.supportExpiresAt || null,
  });
}

export function canAssignRole(actorRole, targetRole) {
  const actor = String(actorRole || "").toLowerCase();
  const target = String(targetRole || "").toLowerCase();
  if (!["admin", "scheduler", "viewer"].includes(target)) return false;
  if (actor === WORKSPACE_ROLES.OWNER) return true;
  return actor === WORKSPACE_ROLES.ADMIN && ["scheduler", "viewer"].includes(target);
}

export const MANAGEABLE_MEMBER_ROLES = Object.freeze([
  WORKSPACE_ROLES.ADMIN,
  WORKSPACE_ROLES.SCHEDULER,
  WORKSPACE_ROLES.VIEWER,
]);
