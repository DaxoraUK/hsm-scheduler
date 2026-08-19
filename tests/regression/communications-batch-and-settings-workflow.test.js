import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../supabase/migrations/202607110005_fix_communication_batch_identifier_ambiguity.sql");
const dispatch = read("../../api/communications/dispatch.js");
const teams = read("../../src/components/Settings/TeamSettingsPanel.jsx");
const pitches = read("../../src/components/Settings/PitchSettingsPanel.jsx");
const primitives = read("../../src/components/Settings/SettingsPrimitives.jsx");

describe("communications reservation and registry settings workflow", () => {
  test("removes every delivery-batch identifier collision from the reservation function", () => {
    expect(migration).toContain("#variable_conflict error");
    expect(migration).toContain("v_batch_id uuid");
    expect(migration).toContain("v_delivery_id uuid");
    expect(migration).toContain("on conflict on constraint communication_delivery_batches_club_id_request_key_key");
    expect(migration).toContain("on conflict on constraint communication_batch_items_pkey");
    expect(migration).toContain("where batch_item_row.batch_id = v_batch_id");
    expect(migration).not.toMatch(/\bbatch_id uuid;/);
    expect(migration).not.toMatch(/\bdelivery_id uuid;/);
    expect(migration).not.toContain("on conflict (batch_id, delivery_id)");
  });

  test("does not expose raw PostgreSQL ambiguity errors to club users", () => {
    expect(dispatch).toContain("COMMUNICATION_DATABASE_MIGRATION_REQUIRED");
    expect(dispatch).toContain("Apply the newest Supabase migration and retry");
  });

  test("uses searchable master-detail editors instead of rendering every team and pitch form", () => {
    expect(teams).toContain("Find a team or coach");
    expect(teams).toContain("selectedTeam");
    expect(teams).toContain("filteredTeams.map");
    expect(teams).not.toContain("teamCfg.map((team, index) =>");

    expect(pitches).toContain("Find a pitch, site or format");
    expect(pitches).toContain("selectedPitch");
    expect(pitches).toContain("filteredPitches.map");
    expect(pitches).not.toContain("{sortPitches(pitchCfg).map((pitch");
  });

  test("keeps the save control accessible while editing long settings registries", () => {
    expect(teams).toMatch(/<SaveBar\s+sticky/);
    expect(pitches).toMatch(/<SaveBar\s+sticky/);
    expect(primitives).toContain("sticky top-24 z-30");
    expect(primitives).toContain('aria-live="polite"');
  });
});
