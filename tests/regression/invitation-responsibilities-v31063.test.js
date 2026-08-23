import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/components/Settings/AccessSecurityPanel.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202608230002_invitation_responsibilities.sql", "utf8");

describe("scoped responsibilities on club invitations", () => {
  test("collects initial scoped responsibilities in the invitation UI", () => {
    expect(panel).toContain("Initial responsibilities");
    expect(panel).toContain("inviteResponsibilities");
    expect(panel).toContain("responsibilities: inviteResponsibilities");
    expect(panel).toContain("activated automatically when the invited person joins");
  });

  test("validates, stores and applies invitation responsibilities atomically", () => {
    expect(migration).toContain("add column if not exists responsibilities jsonb");
    expect(migration).toContain("jsonb_array_length(safe_responsibilities) > 20");
    expect(migration).toContain("insert into public.club_member_roles");
    expect(migration).toContain("invitation.responsibilities");
    expect(migration).toContain("membership.invitation.accept");
  });

  test("preserves the role assignment key with a stable club-wide scope", () => {
    expect(migration).toContain("alter column scope_id set default '__club__'");
    expect(migration).not.toContain("drop constraint if exists club_member_roles_pkey");
  });
});
