export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "owner",
  CHAIR: "chair",
  ADMIN: "admin",
  SECRETARY: "club_secretary",
  SCHEDULER: "scheduler",
  FIXTURE_OFFICER: "fixture_officer",
  OPERATIONS_OFFICER: "operations_officer",
  TREASURER: "treasurer",
  WELFARE_OFFICER: "welfare_officer",
  COMMUNICATIONS_OFFICER: "communications_officer",
  COACH: "coach",
  TEAM_MANAGER: "team_manager",
  VOLUNTEER: "volunteer",
  VIEWER: "viewer",
  SUPPORT: "support",
});

export const ROLE_SCOPE_TYPES = Object.freeze({ CLUB: "club", TEAM: "team", SITE: "site" });

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
  owner: "Club Owner", chair: "Chair / Director", admin: "Club Administrator",
  club_secretary: "Club Secretary", scheduler: "Scheduler", fixture_officer: "Fixture / Operations Officer",
  operations_officer: "Operations Officer", treasurer: "Treasurer / Finance Officer",
  welfare_officer: "Welfare / Safeguarding Officer", communications_officer: "Communications Officer",
  coach: "Team Coach", team_manager: "Team Manager", volunteer: "Volunteer", viewer: "Viewer", support: "Daxora Support",
});

const ROLE_DESCRIPTIONS = Object.freeze({
  owner: "Full control of the club workspace.", chair: "Club leadership and executive oversight.",
  admin: "Club administration, users and day-to-day control.", club_secretary: "Club administration, coordination and records.",
  scheduler: "Builds and publishes matchdays.", fixture_officer: "Owns fixtures, postponements and scheduling coordination.",
  operations_officer: "Runs operational and matchday workflows.", treasurer: "Finance-focused club responsibilities.",
  welfare_officer: "Welfare, safeguarding and compliance responsibilities.", communications_officer: "Club communications and audience coordination.",
  coach: "Team-scoped Coach Hub access.", team_manager: "Team administration and communications.",
  volunteer: "Assigned operational support without administrative control.", viewer: "Read-only club workspace access.",
  support: "Time-limited, visibly read-only Daxora support access.",
});

const ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(Object.values(WORKSPACE_PERMISSIONS)),
  chair: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.VIEW_AUDIT]),
  admin: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS, WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS, WORKSPACE_PERMISSIONS.MANAGE_SETTINGS, WORKSPACE_PERMISSIONS.MANAGE_MEMBERS, WORKSPACE_PERMISSIONS.VIEW_AUDIT]),
  club_secretary: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS, WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS, WORKSPACE_PERMISSIONS.MANAGE_SETTINGS, WORKSPACE_PERMISSIONS.MANAGE_MEMBERS, WORKSPACE_PERMISSIONS.VIEW_AUDIT]),
  scheduler: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS, WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS]),
  fixture_officer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS, WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS]),
  operations_officer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE, WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS, WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS]),
  treasurer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  welfare_officer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  communications_officer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  coach: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  team_manager: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  volunteer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  viewer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  support: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
});

export const MANAGEABLE_MEMBER_ROLES = Object.freeze([
  WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.CHAIR, WORKSPACE_ROLES.SECRETARY, WORKSPACE_ROLES.SCHEDULER,
  WORKSPACE_ROLES.FIXTURE_OFFICER, WORKSPACE_ROLES.OPERATIONS_OFFICER, WORKSPACE_ROLES.TREASURER,
  WORKSPACE_ROLES.WELFARE_OFFICER, WORKSPACE_ROLES.COMMUNICATIONS_OFFICER, WORKSPACE_ROLES.COACH,
  WORKSPACE_ROLES.TEAM_MANAGER, WORKSPACE_ROLES.VOLUNTEER, WORKSPACE_ROLES.VIEWER,
]);

function normaliseRole(role) {
  const value = String(role || WORKSPACE_ROLES.VIEWER).trim().toLowerCase();
  return ROLE_PERMISSIONS[value] ? value : WORKSPACE_ROLES.VIEWER;
}

export function getWorkspaceRoles(membership = null) {
  const legacy = membership?.role ? [membership.role] : [];
  const assigned = Array.isArray(membership?.roles) ? membership.roles : [];
  const combined = [...legacy, ...assigned]
    .map((item) => typeof item === "string" ? item : item?.roleCode || item?.role_code || item?.role)
    .map(normaliseRole);
  return [...new Set(combined.length ? combined : [WORKSPACE_ROLES.VIEWER])];
}

export function getWorkspaceRole(membership = null) {
  if (membership?.accessMode === "support") return WORKSPACE_ROLES.SUPPORT;
  const priority = [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.CHAIR, WORKSPACE_ROLES.SECRETARY, WORKSPACE_ROLES.SCHEDULER, WORKSPACE_ROLES.FIXTURE_OFFICER, WORKSPACE_ROLES.OPERATIONS_OFFICER, WORKSPACE_ROLES.TEAM_MANAGER, WORKSPACE_ROLES.COACH, WORKSPACE_ROLES.TREASURER, WORKSPACE_ROLES.WELFARE_OFFICER, WORKSPACE_ROLES.COMMUNICATIONS_OFFICER, WORKSPACE_ROLES.VOLUNTEER, WORKSPACE_ROLES.VIEWER];
  const roles = getWorkspaceRoles(membership);
  return priority.find((role) => roles.includes(role)) || WORKSPACE_ROLES.VIEWER;
}

export function getRoleLabel(role = WORKSPACE_ROLES.VIEWER) { return ROLE_LABELS[normaliseRole(role)] || "Club Member"; }
export function getRoleDescription(role = WORKSPACE_ROLES.VIEWER) { return ROLE_DESCRIPTIONS[normaliseRole(role)] || ROLE_DESCRIPTIONS.viewer; }
export function roleHasPermission(role, permission) { return Boolean(ROLE_PERMISSIONS[normaliseRole(role)]?.has(permission)); }

export function createWorkspaceAccess(membership = null) {
  const roles = getWorkspaceRoles(membership);
  const role = getWorkspaceRole(membership);
  const accessMode = membership?.accessMode === "support" ? "support" : membership?.accessMode === "coach" ? "coach" : "membership";
  const has = (permission) => roles.some((item) => roleHasPermission(item, permission));
  const isSupport = accessMode === "support";
  return Object.freeze({
    role, roles, roleLabels: roles.map(getRoleLabel), accessMode, isSupport,
    isCoach: accessMode === "coach" || roles.includes(WORKSPACE_ROLES.COACH) || roles.includes(WORKSPACE_ROLES.TEAM_MANAGER),
    isReadOnly: isSupport || !has(WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS),
    canRead: has(WORKSPACE_PERMISSIONS.READ_WORKSPACE), canOperate: !isSupport && has(WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS),
    canPublish: !isSupport && has(WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS), canManageSettings: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SETTINGS),
    canManageMembers: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_MEMBERS), canViewAudit: !isSupport && has(WORKSPACE_PERMISSIONS.VIEW_AUDIT),
    canManageSupport: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SUPPORT), canTransferOwnership: !isSupport && has(WORKSPACE_PERMISSIONS.TRANSFER_OWNERSHIP),
    supportSessionId: membership?.supportSessionId || null, supportExpiresAt: membership?.supportExpiresAt || null,
  });
}

export function canAssignRole(actorRole, targetRole) {
  const actor = normaliseRole(actorRole); const target = normaliseRole(targetRole);
  if (!MANAGEABLE_MEMBER_ROLES.includes(target)) return false;
  if (actor === WORKSPACE_ROLES.OWNER) return true;
  if (actor === WORKSPACE_ROLES.ADMIN || actor === WORKSPACE_ROLES.SECRETARY) return ![WORKSPACE_ROLES.ADMIN, WORKSPACE_ROLES.CHAIR, WORKSPACE_ROLES.SECRETARY].includes(target);
  return false;
}

export function getRoleScopeLabel(scope = {}) {
  const type = scope?.scopeType || scope?.scope_type || ROLE_SCOPE_TYPES.CLUB;
  if (type === ROLE_SCOPE_TYPES.TEAM) return scope?.scopeName || "Team";
  if (type === ROLE_SCOPE_TYPES.SITE) return scope?.scopeName || "Site";
  return "Entire club";
}
