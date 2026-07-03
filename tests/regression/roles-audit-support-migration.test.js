import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607030002_roles_audit_support.sql", import.meta.url),
  "utf8"
);

const baseMigration = readFileSync(
  new URL("../../supabase/migrations/202607030001_multi_club_rls.sql", import.meta.url),
  "utf8"
);

describe("roles, audit and support migration", () => {
  test("keeps membership writes behind guarded RPCs", () => {
    expect(migration).toContain("create or replace function public.update_club_member_role");
    expect(migration).toContain("create or replace function public.remove_club_member");
    expect(migration).toContain("create or replace function public.transfer_club_ownership");
    expect(migration).toContain("Only the club owner can manage administrator access");
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.club_memberships\s+for (insert|update|delete)/i);
  });

  test("support access is read-only, time-limited and separately attributed", () => {
    expect(migration).toContain("expires_at <= starts_at + interval '4 hours'");
    expect(migration).toContain("create or replace function public.has_active_support_access");
    expect(migration).toContain("create or replace function public.end_own_support_session");
    expect(migration).toContain("'support.workspace.open'");
    expect(migration).toContain("support_session_id uuid references public.support_access_sessions");
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.support_access_sessions\s+for (insert|update|delete)/i);
  });

  test("privileged events are written by a private security-definer function", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("create or replace function private.write_audit_event");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("revoke all on schema private from public, anon, authenticated");
  });

  test("support reads use can_read_club while write policies remain membership-role based", () => {
    expect(migration).toContain("public.can_read_club(club_id)");
    expect(baseMigration).toContain("with check (public.can_manage_club(club_id))");
    expect(baseMigration).toContain("with check (public.can_operate_club(club_id))");
    expect(migration).not.toMatch(/for (insert|update|delete)[\s\S]{0,160}can_read_club/i);
  });
  test("operational writes are RPC-only and create audit events in the same transaction", () => {
    expect(migration).toContain("create or replace function public.save_matchweek_history");
    expect(migration).toContain("create or replace function public.delete_matchweek_history");
    expect(migration).toContain("create or replace function public.save_test_fixtures");
    expect(migration).toMatch(/revoke insert, update, delete on[\s\S]+public\.history[\s\S]+from authenticated;/i);
    expect(migration).not.toContain("grant execute on function public.record_audit_event");
    expect(migration).toContain("revoke select, insert, update, delete on public.audit_events from authenticated");
    expect(migration).toContain("Each supported mutation above writes its own server-side audit event");
  });

  test("support helper RPCs expose only the signed-in support identity", () => {
    expect(migration).toContain("create or replace function public.get_active_support_session(target_club_id uuid)");
    expect(migration).toContain("session_row.support_user_id = auth.uid()");
    expect(migration).not.toContain("target_user_id uuid default auth.uid()");
  });

  test("ownership transfer records the owner role before the actor is demoted", () => {
    const auditPosition = migration.indexOf("'membership.ownership.transfer'");
    const demotionPosition = migration.indexOf("set role = 'admin'", auditPosition);
    expect(auditPosition).toBeGreaterThan(-1);
    expect(demotionPosition).toBeGreaterThan(auditPosition);
  });

});
