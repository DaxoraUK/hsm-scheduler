import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607030003_customer_onboarding.sql", import.meta.url),
  "utf8"
);

describe("customer onboarding migration", () => {
  test("does not force existing live clubs back through onboarding", () => {
    expect(migration).toContain("from public.clubs club");
    expect(migration).toContain("'complete'");
    expect(migration).toContain("false");
    expect(migration).toContain("on conflict (club_id) do nothing");
  });

  test("new clubs receive a required pending onboarding record", () => {
    expect(migration).toContain("private.create_club_onboarding_record");
    expect(migration).toContain("after insert on public.clubs");
    expect(migration).toContain("'pending'");
    expect(migration).toContain("true");
  });

  test("progress and completion are guarded RPC-only operations", () => {
    expect(migration).toContain("public.start_club_onboarding");
    expect(migration).toContain("public.save_club_onboarding");
    expect(migration).toContain("public.complete_club_onboarding");
    expect(migration).toContain("public.can_manage_club(target_club_id)");
    expect(migration).toContain("revoke all on public.club_onboarding from anon, authenticated");
  });

  test("completion saves configuration and resources in one transaction", () => {
    expect(migration).toContain("perform public.save_club_configuration");
    expect(migration).toContain("public.replace_club_collection(target_club_id, 'team_config'");
    expect(migration).toContain("public.replace_club_collection(target_club_id, 'pitches'");
    expect(migration).toContain("'onboarding.complete'");
    expect(migration.trim().startsWith("-- Daxora Ground Control")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });

  test("RLS permits club-scoped reads but no direct browser writes", () => {
    expect(migration).toContain("alter table public.club_onboarding force row level security");
    expect(migration).toContain("using (public.can_read_club(club_id))");
    expect(migration).not.toMatch(/create policy[\s\S]{0,160}for (insert|update|delete)/i);
  });
});
