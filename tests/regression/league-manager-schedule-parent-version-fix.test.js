import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202607130007_fix_schedule_parent_version_ambiguity.sql",
  "utf8",
);

describe("League Manager schedule draft parent-version fix", () => {
  test("keeps the RPC contract stable while removing the ambiguous SQL reference", () => {
    expect(migration).toContain("public.save_league_schedule_draft(");
    expect(migration).toContain("parent_version_id uuid default null");
    expect(migration).toContain("safe_parent_version_id uuid := parent_version_id;");
    expect(migration).toContain("where version_row.id = safe_parent_version_id");
    expect(migration).toContain("safe_parent_version_id,");
    expect(migration).toContain("next_version_number");
    expect(migration).toMatch(/values\s*\([\s\S]*safe_parent_version_id,[\s\S]*next_version_number/);
    expect(migration).not.toContain("where id = parent_version_id");
  });

  test("preserves authenticated-only execution", () => {
    expect(migration).toContain(
      "revoke all on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.save_league_schedule_draft(uuid, uuid, text, jsonb, jsonb, uuid, text) to authenticated;",
    );
  });
});
