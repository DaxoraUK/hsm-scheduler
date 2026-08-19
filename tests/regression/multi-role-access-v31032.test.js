import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createWorkspaceAccess, WORKSPACE_PERMISSIONS, WORKSPACE_ROLES } from "../../src/lib/security/permissions.js";

const migration = readFileSync("supabase/migrations/202608190001_multi_role_access_architecture.sql", "utf8");
const accessPanel = readFileSync("src/components/Settings/AccessSecurityPanel.jsx", "utf8");

describe("Daxora Ground Control v3.10.32 multi-role access architecture", () => {
  it("combines multiple roles without replacing the primary membership role", () => {
    const access = createWorkspaceAccess({
      role: WORKSPACE_ROLES.VIEWER,
      roles: [
        { role_code: WORKSPACE_ROLES.COACH, scope_type: "team", scope_id: "u14" },
        { role_code: WORKSPACE_ROLES.FIXTURE_OFFICER, scope_type: "club", scope_id: null },
      ],
    });

    expect(access.roles).toEqual(expect.arrayContaining([WORKSPACE_ROLES.VIEWER, WORKSPACE_ROLES.COACH, WORKSPACE_ROLES.FIXTURE_OFFICER]));
    expect(access.isCoach).toBe(true);
    expect(access.canRead).toBe(true);
    expect(access.canOperate).toBe(true);
    expect(access.canManageMembers).toBe(false);
  });

  it("persists role scope and protects role mutations through Supabase RPCs", () => {
    expect(migration).toContain("create table if not exists public.club_member_roles");
    expect(migration).toContain("scope_type text not null default 'club'");
    expect(migration).toContain("create or replace function public.add_club_member_role");
    expect(migration).toContain("create or replace function public.list_accessible_workspaces()");
    expect(migration).toContain("'roles', deduplicated.roles");
    expect(migration).toContain("create or replace function public.remove_club_member_role");
    expect(migration).toContain("public.can_manage_club(target_club_id)");
    expect(migration).toContain("create or replace function public.can_operate_club(target_club_id uuid)");
    expect(migration).toContain("fixture_officer");
    expect(accessPanel).toContain("DB.addClubMemberRole");
    expect(accessPanel).toContain("DB.removeClubMemberRole");
  });

  it("keeps the commercial permission ceiling separate from role assignment", () => {
    const access = createWorkspaceAccess({ role: WORKSPACE_ROLES.VIEWER, roles: [{ role_code: WORKSPACE_ROLES.COACH }] });
    expect(access.roles).toContain(WORKSPACE_ROLES.COACH);
    expect(access.canRead).toBe(true);
    expect(access.canManageMembers).toBe(false);
    expect(WORKSPACE_PERMISSIONS.MANAGE_MEMBERS).toBe("manage_members");
  });
});
