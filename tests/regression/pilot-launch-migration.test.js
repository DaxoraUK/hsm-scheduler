import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = path.resolve("supabase/migrations/202607030007_pilot_launch_readiness.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const repository = fs.readFileSync(path.resolve("src/lib/supabase.js"), "utf8");


describe("pilot and launch readiness migration", () => {
  test("creates protected launch, pilot and telemetry tables", () => {
    for (const table of ["platform_launch_gates", "platform_pilot_clubs", "platform_client_events"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
  });

  test("keeps profile changes self-service but platform controls restricted", () => {
    expect(migration).toContain("create or replace function public.update_my_profile");
    expect(migration).toContain("perform private.require_platform_staff('admin')");
    expect(migration).toContain("perform private.require_platform_staff('support')");
    expect(migration).toContain("update auth.users");
  });

  test("records sanitised authenticated telemetry and exposes no direct table writes", () => {
    expect(migration).toContain("create or replace function public.record_client_event");
    expect(migration).toContain("safe_context");
    expect(migration).toContain("grant execute on function public.record_client_event");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+public\.platform_client_events/i);
  });

  test("repository uses RPCs for profiles, pilots, gates and incident resolution", () => {
    for (const rpc of [
      "rpc/update_my_profile",
      "rpc/record_client_event",
      "rpc/platform_get_pilot_launch_readiness",
      "rpc/platform_update_launch_gate",
      "rpc/platform_upsert_pilot",
      "rpc/platform_resolve_client_event",
    ]) {
      expect(repository).toContain(rpc);
    }
  });
});
