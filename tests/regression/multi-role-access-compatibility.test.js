import { describe, expect, test } from "vitest";
import { createWorkspaceAccess, WORKSPACE_ROLES } from "../../src/lib/security/permissions.js";

describe("multi-role access compatibility", () => {
  test("keeps the established roles field alongside effectiveRoles", () => {
    const access = createWorkspaceAccess({
      role: WORKSPACE_ROLES.VIEWER,
      roles: [
        { role_code: WORKSPACE_ROLES.COACH, scope_type: "team", scope_id: "u14" },
        { role_code: WORKSPACE_ROLES.FIXTURE_OFFICER, scope_type: "club" },
      ],
    });

    expect(access.roles).toEqual(expect.arrayContaining([
      WORKSPACE_ROLES.VIEWER,
      WORKSPACE_ROLES.COACH,
      WORKSPACE_ROLES.FIXTURE_OFFICER,
    ]));
    expect(access.effectiveRoles).not.toContain(WORKSPACE_ROLES.COACH);
    expect(access.isCoach).toBe(true);
    expect(access.isCoachOnly).toBe(false);
    expect(access.canOperate).toBe(true);
  });

  test("treats a team manager as Coach Hub eligible without removing owner authority", () => {
    const access = createWorkspaceAccess({
      role: WORKSPACE_ROLES.OWNER,
      roleAssignments: [{ role: "team_manager", scopeType: "team", scopeId: "u14" }],
    });
    expect(access.isCoach).toBe(true);
    expect(access.isCoachOnly).toBe(false);
    expect(access.canManageSettings).toBe(true);
  });
});
