import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607030005_admin_support_tooling.sql", import.meta.url),
  "utf8"
);

describe("Daxora admin and support tooling migration", () => {
  test("separates platform administrators from support operators", () => {
    expect(migration).toContain("platform_role in ('support', 'admin')");
    expect(migration).toContain("private.require_platform_staff(required_role text default 'support')");
    expect(migration).toContain("perform private.require_platform_staff('admin')");
    expect(migration).toContain("Daxora platform administrator access required");
  });

  test("creates support cases and platform activity under forced RLS", () => {
    expect(migration).toContain("create table if not exists public.platform_support_cases");
    expect(migration).toContain("create table if not exists public.platform_support_case_notes");
    expect(migration).toContain("create table if not exists public.platform_activity_events");
    expect(migration).toContain("alter table public.platform_support_cases force row level security");
    expect(migration).toContain("alter table public.platform_activity_events force row level security");
    expect(migration).toContain("revoke all on table public.platform_support_cases from public, anon, authenticated");
  });

  test("exposes only guarded RPCs to authenticated browser sessions", () => {
    for (const rpc of [
      "get_platform_operator_context",
      "platform_list_clubs",
      "platform_get_club_detail",
      "platform_update_club_status",
      "platform_list_support_cases",
      "platform_get_support_case",
      "platform_create_support_case",
      "platform_update_support_case",
      "platform_list_activity",
    ]) {
      expect(migration).toContain(`public.${rpc}`);
    }
    expect(migration).toContain("grant execute on function public.get_platform_operator_context() to authenticated");
  });

  test("keeps subscription and club suspension changes administrator-only and audited", () => {
    expect(migration).toMatch(/platform_update_club_status[\s\S]*?require_platform_staff\('admin'\)/);
    expect(migration).toMatch(/platform_set_club_subscription[\s\S]*?require_platform_staff\('admin'\)/);
    expect(migration).toContain("club.platform_status.update");
    expect(migration).toContain("subscription.assignment.update");
    expect(migration).toContain("A status-change reason is required");
    expect(migration).toContain("A plan-change reason is required");
  });

  test("does not create an operational-data bypass or expose privileged credentials", () => {
    expect(migration).toContain("does not expose service-role credentials");
    expect(migration).toContain("owner-approved support sessions");
    expect(migration).not.toContain("service_role_key");
    expect(migration).not.toMatch(/create policy[\s\S]{0,200}platform_support_staff[\s\S]{0,200}for all/i);
  });

  test("uses the Link product architecture and is transactional", () => {
    expect(migration).not.toContain("Club Link");
    expect(migration.trim().startsWith("-- Daxora Ground Control")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
