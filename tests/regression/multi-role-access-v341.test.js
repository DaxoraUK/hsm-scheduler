import { describe, expect, test } from "vitest";
import {
  CLUB_ROLE_CODES,
  MANAGEABLE_ADDITIONAL_ROLES,
  canAssignAdditionalRole,
  createWorkspaceAccess,
  getEffectiveRoleCodes,
  getRoleLabel,
} from "../../src/lib/security/permissions.js";

describe("Daxora Ground Control v3.10.41 multi-role access architecture", () => {
  test("supports multiple functional roles without replacing the primary membership role", () => {
    const access = createWorkspaceAccess({
      role: "viewer",
      roleAssignments: [
        { role: CLUB_ROLE_CODES.SECRETARY, scopeType: "club", status: "active" },
        { role: CLUB_ROLE_CODES.FIXTURE_OFFICER, scopeType: "club", status: "active" },
        { role: CLUB_ROLE_CODES.COACH, scopeType: "team", scopeId: "u14", status: "active" },
      ],
    });

    expect(access.role).toBe("viewer");
    expect(access.effectiveRoles).toEqual(expect.arrayContaining([
      "viewer",
      "club_secretary",
      "fixture_officer",
    ]));
    expect(access.canManageSettings).toBe(true);
    expect(access.canOperate).toBe(true);
    expect(access.isCoach).toBe(true);
    expect(access.isCoachOnly).toBe(false);
  });

  test("applies team-scoped roles only when the active context matches", () => {
    const membership = {
      role: "viewer",
      roleAssignments: [
        { role: "coach", scopeType: "team", scopeId: "u14", status: "active" },
      ],
    };

    expect(getEffectiveRoleCodes(membership)).toEqual(["viewer"]);
    expect(getEffectiveRoleCodes(membership, { teamId: "u13" })).toEqual(["viewer"]);
    expect(getEffectiveRoleCodes(membership, { teamId: "u14" })).toEqual(["viewer", "coach"]);
  });

  test("owner and administrator can assign functional roles; lower roles cannot", () => {
    expect(canAssignAdditionalRole("owner", "coach")).toBe(true);
    expect(canAssignAdditionalRole("admin", "fixture_officer")).toBe(true);
    expect(canAssignAdditionalRole("scheduler", "coach")).toBe(false);
    expect(canAssignAdditionalRole("viewer", "coach")).toBe(false);
    expect(MANAGEABLE_ADDITIONAL_ROLES).toContain("club_secretary");
  });

  test("role labels are human-facing and stable", () => {
    expect(getRoleLabel("club_secretary")).toBe("Club Secretary");
    expect(getRoleLabel("fixture_officer")).toBe("Fixture Officer");
    expect(getRoleLabel("coach")).toBe("Team Coach");
  });
});
