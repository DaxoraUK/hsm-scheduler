import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202607130008_fix_schedule_draft_all_identifier_ambiguities.sql",
  "utf8",
);

describe("League Manager schedule draft complete identifier fix", () => {
  test("keeps the browser RPC signature stable", () => {
    expect(migration).toContain("public.save_league_schedule_draft(");
    expect(migration).toContain("parent_version_id uuid default null");
    expect(migration).toContain("draft_source text default 'generated'");
  });

  test("uses collision-proof local names for every schedule entry identifier", () => {
    for (const variableName of [
      "v_parent_version_id",
      "v_division_id",
      "v_home_team_id",
      "v_away_team_id",
      "v_venue_id",
      "v_source_fixture_id",
      "v_scheduled_date",
      "v_kick_off",
    ]) {
      expect(migration).toContain(variableName);
    }

    expect(migration).not.toMatch(/^\s{2}(division_id|home_team_id|away_team_id|venue_id|source_fixture_id|scheduled_date|kick_off)\s+[^,\n;]+;/m);
  });

  test("qualifies all lookup columns that previously collided with variables", () => {
    expect(migration).toContain("parent_version.id = v_parent_version_id");
    expect(migration).toContain("selected_division.id = v_division_id");
    expect(migration).toContain("home_team.id = v_home_team_id");
    expect(migration).toContain("away_team.id = v_away_team_id");
    expect(migration).toContain("source_fixture.id = v_source_fixture_id");
    expect(migration).not.toContain("division_row.id = division_id");
    expect(migration).not.toContain("where id = source_fixture_id");
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
