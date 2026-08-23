import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608230008_fix_member_role_rpc_ambiguity.sql", "utf8");

describe("member-role RPC ambiguity repair", () => {
  test("targets the named primary-key constraint instead of ambiguous column parameters", () => {
    expect(migration).toContain("on conflict on constraint club_member_roles_pkey");
    expect(migration).not.toContain("on conflict (club_id, user_id, role_code, scope_type, scope_id)");
  });

  test("qualifies role removal columns and preserves authenticated-only execution", () => {
    expect(migration).toContain("update public.club_member_roles as member_role");
    expect(migration).toContain("member_role.role_code = safe_role");
    expect(migration).toContain("grant execute on function public.add_club_member_role");
    expect(migration).toContain("grant execute on function public.remove_club_member_role");
  });
});
