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

  it("uses authenticated revisioned scheduling-state RPCs rather than a shared lock", () => {
    expect(database).toContain('"rpc/load_matchday_scheduling_state"');
    expect(database).toContain('"rpc/save_matchday_scheduling_state"');
    expect(page).not.toContain("DB.getMatchdayLock");
    expect(page).not.toContain("DB.setMatchdayLock");
  });

  it("keeps users without scheduling capability blocked without restoring an approval lock", () => {
    expect(command).toContain("!canOperate");
    expect(command).toContain("!canPublish");
    expect(command).not.toContain("canToggleLock");
  });
});
