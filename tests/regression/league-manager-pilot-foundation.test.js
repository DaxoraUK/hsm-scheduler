import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getLeagueReadiness,
  normaliseLeagueAccess,
  normaliseLeagueWorkspace,
  parseLeagueFixtureCsv,
  parseLeagueStructureCsv,
  serialiseLeagueEntity,
} from "../../src/lib/league/leagueManagerModel.js";

const migration = readFileSync("supabase/migrations/202607130005_league_manager_pilot_foundation.sql", "utf8");
const appCore = readFileSync("src/AppCore.jsx", "utf8");
const productShell = readFileSync("src/layout/ProductShell.jsx", "utf8");
const page = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

const workspace = normaliseLeagueWorkspace({
  league: { id: "league-1", name: "Test League", country_code: "GB-ENG" },
  access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
  seasons: [{ id: "season-1", name: "2026/27", is_current: true, status: "active" }],
  divisions: [{ id: "division-1", season_id: "season-1", name: "Premier Division" }],
  clubs: [
    { id: "club-1", name: "Alpha FC", status: "active" },
    { id: "club-2", name: "Beta FC", status: "active" },
  ],
  venues: [
    { id: "venue-1", parent_club_id: "club-1", name: "Alpha Ground", status: "active" },
    { id: "venue-2", parent_club_id: "club-2", name: "Beta Ground", status: "active" },
  ],
  teams: [
    { id: "team-1", season_id: "season-1", division_id: "division-1", parent_club_id: "club-1", home_venue_id: "venue-1", name: "Alpha FC" },
    { id: "team-2", season_id: "season-1", division_id: "division-1", parent_club_id: "club-2", home_venue_id: "venue-2", name: "Beta FC" },
  ],
  blackouts: [],
  playing_dates: [{ id: "date-1", season_id: "season-1", playing_date: "2026-08-15", default_kick_off: "15:00:00", status: "available" }],
  fixtures: [],
});

describe("League Manager pilot foundation", () => {
  test("keeps League Manager separate from club subscription packages", () => {
    expect(productShell).toContain('["league", "League Manager", Trophy, null]');
    expect(productShell).toContain("leagueAvailable");
    expect(appCore).toContain('mainPage === "league"');
    expect(appCore).toContain("useLeagueAccess");
    expect(appCore).toContain("leagueOnly");
  });

  test("creates a secure relational league model with server-only mutations", () => {
    for (const table of [
      "leagues",
      "league_memberships",
      "league_seasons",
      "league_divisions",
      "league_parent_clubs",
      "league_venues",
      "league_teams",
      "league_blackout_dates",
      "league_playing_dates",
      "league_fixtures",
      "league_audit_events",
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("force row level security");
    expect(migration).toContain("revoke all on table");
    expect(migration).toContain("public.can_view_league");
    expect(migration).toContain("public.can_manage_league");
    expect(migration).toContain("public.can_operate_league");
    expect(migration).toContain("private.write_league_audit");
  });

  test("exposes only guarded League Manager RPCs to the browser client", () => {
    expect(supabase).toContain('rpc/list_accessible_leagues');
    expect(supabase).toContain('rpc/platform_create_league_pilot');
    expect(supabase).toContain('rpc/get_league_workspace');
    expect(supabase).toContain('rpc/upsert_league_entity');
    expect(supabase).toContain('rpc/delete_league_entity');
    expect(supabase).toContain('rpc/import_league_structure');
    expect(supabase).toContain('rpc/import_league_fixtures');
    expect(supabase).toContain('rpc/create_league_invitation');
    expect(supabase).toContain('rpc/accept_league_invitation');
  });

  test("normalises league access and workspace rows without leaking database naming into the UI", () => {
    expect(normaliseLeagueAccess({ league_id: "league-1", league_name: "Test League", access_role: "fixtures", read_only: false })).toEqual(expect.objectContaining({
      leagueId: "league-1",
      name: "Test League",
      role: "fixtures",
      readOnly: false,
    }));
    expect(workspace.teams[0]).toEqual(expect.objectContaining({
      seasonId: "season-1",
      divisionId: "division-1",
      parentClubId: "club-1",
      homeVenueId: "venue-1",
    }));
  });

  test("reports readiness only when real structure, teams and venues are connected", () => {
    const readiness = getLeagueReadiness(workspace);
    expect(readiness.readyForScheduling).toBe(true);
    expect(readiness.percentage).toBe(100);
    expect(readiness.totals).toEqual(expect.objectContaining({ divisions: 1, clubs: 2, teams: 2, venues: 2, playingDates: 1 }));

    const incomplete = getLeagueReadiness({ ...workspace, venues: [], teams: workspace.teams.map((team) => ({ ...team, homeVenueId: "" })) });
    expect(incomplete.readyForScheduling).toBe(false);
    expect(incomplete.percentage).toBeLessThan(100);
  });

  test("validates a bulk setup CSV before the atomic structure import", () => {
    const valid = parseLeagueStructureCsv(
      "division,parent_club,team,home_venue,postcode,ground_share_key\nPremier Division,Alpha FC,Alpha FC,Alpha Ground,BL1 1AA,GROUND-1",
    );
    expect(valid.errors).toEqual([]);
    expect(valid.records).toEqual([expect.objectContaining({
      division: "Premier Division",
      parent_club: "Alpha FC",
      team: "Alpha FC",
      home_venue: "Alpha Ground",
      postcode: "BL1 1AA",
      ground_share_key: "GROUND-1",
    })]);

    const invalid = parseLeagueStructureCsv("division,parent_club,team,home_venue\nPremier Division,Alpha FC,,Alpha Ground");
    expect(invalid.records).toHaveLength(0);
    expect(invalid.errors.join(" ")).toContain("team is required");
    expect(migration).toContain("public.import_league_structure");
    expect(migration).toContain("public.import_league_fixtures");
  });

  test("validates fixture CSV names before returning records for import", () => {
    const valid = parseLeagueFixtureCsv(
      "division,home_team,away_team,date,kick_off,venue,external_ref\nPremier Division,Alpha FC,Beta FC,2026-08-15,15:00,Alpha Ground,FIX-1",
      workspace,
    );
    expect(valid.errors).toEqual([]);
    expect(valid.records).toHaveLength(1);
    expect(valid.records[0]).toEqual(expect.objectContaining({
      season_id: "season-1",
      division_id: "division-1",
      home_team_id: "team-1",
      away_team_id: "team-2",
      venue_id: "venue-1",
      source: "csv",
    }));

    const invalid = parseLeagueFixtureCsv(
      "home_team,away_team\nMissing FC,Beta FC",
      workspace,
    );
    expect(invalid.records).toHaveLength(0);
    expect(invalid.errors.join(" ")).toContain("Missing FC");
  });

  test("serialises edited client records into the guarded database contract", () => {
    expect(serialiseLeagueEntity("team", {
      id: "team-1",
      seasonId: "season-1",
      divisionId: "division-1",
      parentClubId: "club-1",
      homeVenueId: "venue-1",
      name: "Alpha FC",
      shortName: "Alpha",
    })).toEqual(expect.objectContaining({
      id: "team-1",
      season_id: "season-1",
      division_id: "division-1",
      parent_club_id: "club-1",
      home_venue_id: "venue-1",
      short_name: "Alpha",
    }));
  });

  test("includes the complete pilot onboarding surface and hands off to the scheduling workspace", () => {
    expect(page).toContain("League structure");
    expect(page).toContain("Venues & availability");
    expect(page).toContain("Fixture CSV import");
    expect(page).toContain("Bulk league setup");
    expect(page).toContain("Playing-date calendar");
    expect(page).toContain("Postponed bank");
    expect(page).toContain("Parent club registry");
    expect(page).toContain("Ground-share group");
    expect(page).toContain("Schedule builder");
    expect(page).toContain("Available now:");
  });
});
