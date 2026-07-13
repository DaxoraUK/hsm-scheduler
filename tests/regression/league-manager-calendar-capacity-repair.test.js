import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  generateLeagueSchedule,
  getLeagueSchedulePreflight,
  validateLeagueSchedule,
} from "../../src/lib/league/leagueSchedulingEngine.js";
import { normaliseLeagueWorkspace } from "../../src/lib/league/leagueManagerModel.js";

const migration = readFileSync("supabase/migrations/202607130009_generate_league_playing_date_calendar.sql", "utf8");
const workspaceUi = readFileSync("src/components/league/LeagueScheduleWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function workspaceWithDates(dateCount = 1) {
  const teams = Array.from({ length: 12 }, (_, index) => ({
    id: `team-${index + 1}`,
    season_id: "season-1",
    division_id: "division-1",
    parent_club_id: `club-${index + 1}`,
    home_venue_id: index < 2 ? `venue-${index + 1}` : `venue-${index + 1}`,
    name: `Team ${index + 1}`,
    status: "active",
  }));

  return normaliseLeagueWorkspace({
    league: { id: "league-1", name: "Test League" },
    access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
    seasons: [{ id: "season-1", name: "2026/27", starts_on: "2026-08-01", ends_on: "2027-06-30", is_current: true, status: "active" }],
    divisions: [{ id: "division-1", season_id: "season-1", name: "Premier Division", sort_order: 1 }],
    clubs: teams.map((team, index) => ({ id: `club-${index + 1}`, name: team.name, status: "active" })),
    venues: teams.map((team, index) => ({
      id: `venue-${index + 1}`,
      parent_club_id: `club-${index + 1}`,
      name: index === 0 ? "Shared Ground #1" : index === 1 ? "Shared Ground #2" : `${team.name} Ground`,
      status: "active",
      ground_share_key: index < 2 ? "SHARED-GROUND" : "",
      simultaneous_fixture_limit: 1,
    })),
    teams,
    blackouts: [],
    playing_dates: Array.from({ length: dateCount }, (_, index) => ({
      id: `date-${index + 1}`,
      season_id: "season-1",
      playing_date: new Date(Date.UTC(2026, 7, 1 + (index * 7))).toISOString().slice(0, 10),
      default_kick_off: "15:00:00",
      status: "available",
    })),
    fixtures: [],
  });
}

describe("League Manager season calendar and ground capacity repair", () => {
  test("detects that one playing date cannot support a 12-team home-and-away programme", () => {
    const workspace = workspaceWithDates(1);
    const preflight = getLeagueSchedulePreflight(workspace, {
      seasonId: "season-1",
      divisionIds: ["division-1"],
      meetings: 2,
    });

    expect(preflight.ready).toBe(false);
    expect(preflight.totalFixtures).toBe(132);
    expect(preflight.minimumDates).toBe(22);
    expect(preflight.divisions[0]).toEqual(expect.objectContaining({
      availableDates: 1,
      requiredRounds: 22,
      shortfall: 21,
    }));
  });

  test("accepts a complete weekly calendar and allocates the full division", () => {
    const workspace = workspaceWithDates(48);
    const preflight = getLeagueSchedulePreflight(workspace, {
      seasonId: "season-1",
      divisionIds: ["division-1"],
      meetings: 2,
    });
    const generated = generateLeagueSchedule(workspace, {
      seasonId: "season-1",
      divisionIds: ["division-1"],
      meetings: 2,
    });

    expect(preflight.ready).toBe(true);
    expect(generated.summary).toEqual(expect.objectContaining({ placed: 132, unplaced: 0 }));
  });

  test("adds the capacities of separate pitches in the same ground-share group", () => {
    const workspace = workspaceWithDates(1);
    const date = workspace.playingDates[0].playingDate;
    const entries = [
      { clientKey: "a", seasonId: "season-1", divisionId: "division-1", homeTeamId: "team-1", awayTeamId: "team-3", venueId: "venue-1", scheduledDate: date, kickOff: "15:00", roundNumber: 1 },
      { clientKey: "b", seasonId: "season-1", divisionId: "division-1", homeTeamId: "team-2", awayTeamId: "team-4", venueId: "venue-2", scheduledDate: date, kickOff: "15:00", roundNumber: 1 },
    ];
    const validation = validateLeagueSchedule(workspace, entries, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 1 });

    expect(validation.issues.some((item) => item.code === "ground-capacity-conflict")).toBe(false);
    expect(validation.issues.some((item) => item.code === "venue-capacity-conflict")).toBe(false);
  });

  test("provides a secure bulk calendar RPC and operator-facing recovery flow", () => {
    expect(migration).toContain("public.generate_league_playing_date_calendar");
    expect(migration).toContain("public.can_operate_league");
    expect(migration).toContain("generate_series");
    expect(migration).toContain("private.write_league_audit");
    expect(supabase).toContain('rpc/generate_league_playing_date_calendar');
    expect(workspaceUi).toContain("Generate weekly dates");
    expect(workspaceUi).toContain("Season calendar is incomplete");
    expect(workspaceUi).toContain("Rebuild unresolved only");
    expect(workspaceUi).toContain("fixtures are unplaced");
  });
});
