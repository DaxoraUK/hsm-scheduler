import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202608240001_fix_client_event_resolution_ambiguity.sql", "utf8");

describe("client event resolution ambiguity repair", () => {
  it("copies the RPC input into an unambiguous local value", () => {
    expect(migration).toContain("next_resolution_note text := left(coalesce(resolution_note, ''), 2000)");
    expect(migration).toContain("update public.platform_client_events as client_event");
    expect(migration).toContain("resolution_note = next_resolution_note");
    expect(migration).toContain("where client_event.id = target_event_id");
  });

  it("retains the protected support permission boundary", () => {
    expect(migration).toContain("perform private.require_platform_staff('support')");
    expect(migration).toContain("grant execute on function public.platform_resolve_client_event(uuid, text) to authenticated");
  });
});
