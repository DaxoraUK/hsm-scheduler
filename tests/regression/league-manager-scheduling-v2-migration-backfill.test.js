import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202607130011_league_scheduling_v2_and_cup_manager.sql",
  "utf8",
);

describe("League Manager scheduling v2 migration backfill", () => {
  test("removes the legacy directional uniqueness constraint by its actual columns", () => {
    expect(migration).toContain("pg_catalog.pg_constraint");
    expect(migration).toContain("array['version_id', 'home_team_id', 'away_team_id']::text[]");
    expect(migration).toContain("drop constraint %I");
    expect(migration).not.toContain(
      "drop constraint if exists league_schedule_entries_version_id_home_team_id_away_team_id_key",
    );
  });

  test("assigns deterministic meeting numbers before creating the unordered-pair index", () => {
    const scheduleBackfill = migration.indexOf("with ranked_schedule_entries as");
    const scheduleUpdate = migration.indexOf("update public.league_schedule_entries schedule_entry");
    const uniqueIndex = migration.indexOf(
      "create unique index if not exists league_schedule_entries_unique_league_meeting_idx",
    );

    expect(scheduleBackfill).toBeGreaterThan(-1);
    expect(scheduleUpdate).toBeGreaterThan(scheduleBackfill);
    expect(uniqueIndex).toBeGreaterThan(scheduleUpdate);
    expect(migration).toContain("row_number() over (");
    expect(migration).toContain("schedule_entry.round_number");
    expect(migration).toContain("schedule_entry.scheduled_date nulls last");
  });

  test("backfills the published fixture registry without deleting schedule data", () => {
    expect(migration).toContain("with ranked_league_fixtures as");
    expect(migration).toContain("update public.league_fixtures fixture_value");
    expect(migration).toContain("v2 supports at most four meetings per pairing");
    expect(migration).not.toMatch(/delete\s+from\s+public\.league_schedule_entries/i);
    expect(migration).not.toMatch(/truncate\s+(table\s+)?public\.league_schedule_entries/i);
  });
});
