import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608230005_shared_matchday_locks.sql", "utf8");
const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");
const command = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");
const database = readFileSync("src/lib/supabase.js", "utf8");

describe("shared matchday schedule locks", () => {
  it("stores one club-wide lock and protects changes with publish authority", () => {
    expect(migration).toContain("create table if not exists public.matchday_locks");
    expect(migration).toContain("public.can_publish_club_matchweek(target_club_id)");
    expect(migration).toContain("public.record_audit_event");
    expect(migration).toContain("revoke all on table public.matchday_locks from public, anon, authenticated");
  });

  it("reads and writes the shared state through authenticated RPCs", () => {
    expect(database).toContain('"rpc/get_matchday_lock"');
    expect(database).toContain('"rpc/set_matchday_lock"');
    expect(page).toContain("DB.getMatchdayLock");
    expect(page).toContain("DB.setMatchdayLock");
  });

  it("keeps viewers read-only and reports an in-progress shared update", () => {
    expect(page).toContain("props.workspaceAccess?.canPublish !== false");
    expect(command).toContain("!canToggleLock");
    expect(command).toContain('lockBusy ? "Updating…"');
  });
});
