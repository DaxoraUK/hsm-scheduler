export const WORKSPACE_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  SCHEDULER: "scheduler",
  VIEWER: "viewer",
  COACH: "coach",
  SUPPORT: "support",
  FIXTURE_OFFICER: "fixture_officer",
  OPERATIONS_OFFICER: "operations_officer",
});

export const CLUB_ROLE_CODES = Object.freeze({
  CHAIR: "chair",
  SECRETARY: "club_secretary",
  FIXTURE_OFFICER: "fixture_officer",
  OPERATIONS_OFFICER: "operations_officer",
  TREASURER: "treasurer",
  WELFARE_OFFICER: "welfare_officer",
  COMMUNICATIONS_OFFICER: "communications_officer",
  COACH: "coach",
  TEAM_MANAGER: "team_manager",
  VOLUNTEER: "volunteer",
});

export const WORKSPACE_PERMISSIONS = Object.freeze({
  READ_WORKSPACE: "read_workspace",
  OPERATE_MATCHDAYS: "operate_matchdays",
  PUBLISH_MATCHWEEKS: "publish_matchweeks",
  SEND_COMMUNICATIONS: "send_communications",
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
  coach: "Team Coach",
  support: "Daxora Support",
  chair: "Chair / Director",
  club_secretary: "Club Secretary",
  fixture_officer: "Fixture Officer",
  operations_officer: "Operations Officer",
  treasurer: "Treasurer / Finance",
  welfare_officer: "Welfare / Safeguarding",
  communications_officer: "Communications Officer",
  team_manager: "Team Manager",
  volunteer: "Volunteer",
});

const ROLE_DESCRIPTIONS = Object.freeze({
  owner: "Full control, including ownership transfer and time-limited support access.",
  admin: "Manages club settings, users and day-to-day operations, but cannot transfer ownership.",
  scheduler: "Builds and publishes matchdays without access to club administration.",
  viewer: "Can review the workspace but cannot change or publish anything.",
  coach: "Team-scoped Coach Hub access for calendar, requests, messages and contact preferences.",
  support: "Time-limited, visibly read-only support access using the support agent's own account.",
  chair: "Club-wide leadership visibility without automatically granting operational administration.",
  club_secretary: "Club-wide administration, coordination and audit visibility.",
  fixture_officer: "Coordinates fixtures and matchday changes across the club.",
  operations_officer: "Runs day-to-day club operations and matchday workflows.",
  treasurer: "Reviews club operational information relevant to finance and evidence.",
  welfare_officer: "Reviews club information relevant to safeguarding and people oversight.",
  communications_officer: "Coordinates club communications without operational administration.",
  team_manager: "Team-scoped operational support for the teams assigned to the manager.",
  volunteer: "Club information access for assigned volunteer responsibilities.",
});

const ADDITIONAL_ROLE_PERMISSIONS = Object.freeze({
  chair: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.VIEW_AUDIT,
  ]),
  club_secretary: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.MANAGE_SETTINGS,
    WORKSPACE_PERMISSIONS.VIEW_AUDIT,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  fixture_officer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  operations_officer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  treasurer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.VIEW_AUDIT,
  ]),
  welfare_officer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.VIEW_AUDIT,
  ]),
  communications_officer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  coach: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
  ]),
  team_manager: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
  ]),
  volunteer: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
  ]),
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
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  scheduler: new Set([
    WORKSPACE_PERMISSIONS.READ_WORKSPACE,
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
  ]),
  viewer: new Set([WORKSPACE_PERMISSIONS.READ_WORKSPACE]),
  coach: new Set([]),
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

function normaliseRoleAssignments(membership = {}) {
  const assignments = Array.isArray(membership?.roleAssignments)
    ? membership.roleAssignments
    : Array.isArray(membership?.roles)
      ? membership.roles
      : [];

  return assignments
    .map((assignment) => ({
      role: String(assignment?.role || assignment?.role_code || "").toLowerCase(),
      scopeType: String(assignment?.scopeType || assignment?.scope_type || "club").toLowerCase(),
      scopeId: assignment?.scopeId || assignment?.scope_id || null,
      status: assignment?.status || "active",
    }))
    .filter((assignment) => assignment.role && assignment.status === "active");
}

function roleAssignmentApplies(assignment, context = {}) {
  if (assignment.scopeType === "club") return true;
  if (assignment.scopeType === "team") return Boolean(context.teamId && assignment.scopeId === context.teamId);
  if (assignment.scopeType === "site") return Boolean(context.siteId && assignment.scopeId === context.siteId);
  return false;
}

export function getEffectiveRoleCodes(membership = null, context = {}) {
  const primaryRole = getWorkspaceRole(membership);
  const additionalRoles = normaliseRoleAssignments(membership)
    .filter((assignment) => roleAssignmentApplies(assignment, context))
    .map((assignment) => assignment.role);
  return [...new Set([primaryRole, ...additionalRoles])];
}

export function roleHasPermission(role, permission) {
  const safeRole = String(role || "").toLowerCase();
  return Boolean(
    ROLE_PERMISSIONS[safeRole]?.has(permission)
    || ADDITIONAL_ROLE_PERMISSIONS[safeRole]?.has(permission)
  );
}

export function createWorkspaceAccess(membership = null, context = {}) {
  const role = getWorkspaceRole(membership);
  const roleAssignments = normaliseRoleAssignments(membership);
  const roles = [...new Set([role, ...roleAssignments.map((assignment) => assignment.role)])];
  const effectiveRoles = getEffectiveRoleCodes(membership, context);
  const accessMode = membership?.accessMode === "support"
    ? "support"
    : membership?.accessMode === "coach"
      ? "coach"
      : "membership";
  const has = (permission) => effectiveRoles.some((effectiveRole) => roleHasPermission(effectiveRole, permission));
  const isSupport = accessMode === "support";
  const hasWriteCapability = [
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
    WORKSPACE_PERMISSIONS.MANAGE_SETTINGS,
    WORKSPACE_PERMISSIONS.MANAGE_MEMBERS,
    WORKSPACE_PERMISSIONS.MANAGE_SUPPORT,
    WORKSPACE_PERMISSIONS.TRANSFER_OWNERSHIP,
  ].some(has);
  const legacyCoachAssignment = Array.isArray(membership?.roles)
    && roleAssignments.some((assignment) => assignment.role === WORKSPACE_ROLES.COACH);
  const hasClubOperationalAuthority = [
    WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS,
    WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS,
    WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS,
    WORKSPACE_PERMISSIONS.MANAGE_SETTINGS,
    WORKSPACE_PERMISSIONS.MANAGE_MEMBERS,
  ].some(has);
  const hasCoachRole = accessMode === "coach"
    || effectiveRoles.includes(WORKSPACE_ROLES.COACH)
    || effectiveRoles.includes(CLUB_ROLE_CODES.COACH)
    || roles.includes(WORKSPACE_ROLES.COACH)
    || roles.includes(CLUB_ROLE_CODES.COACH)
    || roles.includes(CLUB_ROLE_CODES.TEAM_MANAGER)
    || legacyCoachAssignment;

  return Object.freeze({
    role,
    roleLabel: getRoleLabel(role),
    roles,
    effectiveRoles,
    roleAssignments,
    accessMode,
    isSupport,
    isCoach: hasCoachRole,
    isCoachOnly: hasCoachRole && !hasClubOperationalAuthority,
    isReadOnly: isSupport || !hasWriteCapability,
    canRead: has(WORKSPACE_PERMISSIONS.READ_WORKSPACE),
    canOperate: !isSupport && has(WORKSPACE_PERMISSIONS.OPERATE_MATCHDAYS),
    canPublish: !isSupport && has(WORKSPACE_PERMISSIONS.PUBLISH_MATCHWEEKS),
    canCommunicate: !isSupport && has(WORKSPACE_PERMISSIONS.SEND_COMMUNICATIONS),
    canManageSettings: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SETTINGS),
    canManageMembers: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_MEMBERS),
    canViewAudit: !isSupport && has(WORKSPACE_PERMISSIONS.VIEW_AUDIT),
    canManageSupport: !isSupport && has(WORKSPACE_PERMISSIONS.MANAGE_SUPPORT),
    canTransferOwnership: !isSupport && has(WORKSPACE_PERMISSIONS.TRANSFER_OWNERSHIP),
    hasRole: (requestedRole) => effectiveRoles.includes(String(requestedRole || "").toLowerCase()),
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

export function canAssignAdditionalRole(actorRole, targetRole) {
  const actor = String(actorRole || "").toLowerCase();
  const target = String(targetRole || "").toLowerCase();
  if (!MANAGEABLE_ADDITIONAL_ROLES.includes(target)) return false;
  return actor === WORKSPACE_ROLES.OWNER || actor === WORKSPACE_ROLES.ADMIN;
}

export const MANAGEABLE_MEMBER_ROLES = Object.freeze([
  WORKSPACE_ROLES.ADMIN,
  WORKSPACE_ROLES.SCHEDULER,
  WORKSPACE_ROLES.VIEWER,
]);

export const MANAGEABLE_ADDITIONAL_ROLES = Object.freeze([
  CLUB_ROLE_CODES.CHAIR,
  CLUB_ROLE_CODES.SECRETARY,
  CLUB_ROLE_CODES.FIXTURE_OFFICER,
  CLUB_ROLE_CODES.OPERATIONS_OFFICER,
  CLUB_ROLE_CODES.TREASURER,
  CLUB_ROLE_CODES.WELFARE_OFFICER,
  CLUB_ROLE_CODES.COMMUNICATIONS_OFFICER,
  CLUB_ROLE_CODES.COACH,
  CLUB_ROLE_CODES.TEAM_MANAGER,
  CLUB_ROLE_CODES.VOLUNTEER,
]);
