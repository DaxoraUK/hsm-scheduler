import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildDivisionFixtureMatrix,
  validateLeagueSchedule,
} from "../../src/lib/league/leagueSchedulingEngine.js";
import { normaliseLeagueWorkspace } from "../../src/lib/league/leagueManagerModel.js";
import {
  buildLeagueCommandSearchIndex,
  searchLeagueCommandIndex,
} from "../../src/lib/league/leagueCommandSearch.js";

const migration = readFileSync("supabase/migrations/202607140006_league_schedule_assurance_and_v352_ux.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const scheduleWorkspace = readFileSync("src/components/league/LeagueScheduleWorkspace.jsx", "utf8");
const fixtureWorkspace = readFileSync("src/components/league/LeagueFixtureCommandWorkspace.jsx", "utf8");
const resultsWorkspace = readFileSync("src/components/league/LeagueResultsWorkspace.jsx", "utf8");

function homeAwayCounts(fixtures, teamId) {
  return {
    home: fixtures.filter((fixture) => fixture.homeTeamId === teamId).length,
    away: fixtures.filter((fixture) => fixture.awayTeamId === teamId).length,
  };
}

function createAssuranceWorkspace() {
  const teams = ["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => ({
    id: `team-${index + 1}`,
    season_id: "season-1",
    division_id: "division-1",
    parent_club_id: `club-${index + 1}`,
    home_venue_id: `venue-${index + 1}`,
    name: `${name} FC`,
    status: "active",
  }));
  const playingDates = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7, 15 + (index * 7)));
    return {
      id: `date-${index + 1}`,
      season_id: "season-1",
      division_id: "division-1",
      playing_date: date.toISOString().slice(0, 10),
      default_kick_off: "15:00:00",
      status: "available",
    };
  });
  return normaliseLeagueWorkspace({
    league: { id: "league-1", name: "Assurance League" },
    access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
    seasons: [{
      id: "season-1",
      name: "2026/27",
      starts_on: "2026-08-01",
      ends_on: "2027-06-30",
      default_kick_off: "15:00:00",
      primary_weekday: 6,
      is_current: true,
      status: "active",
    }],
    divisions: [{
      id: "division-1",
      season_id: "season-1",
      name: "Premier Division",
      sort_order: 1,
      meetings_per_pairing: 3,
      extra_home_rotation_offset: 0,
      max_consecutive_home_away: 3,
    }],
    clubs: teams.map((team, index) => ({ id: `club-${index + 1}`, name: `${team.name} Club`, status: "active" })),
    venues: teams.map((team, index) => ({
      id: `venue-${index + 1}`,
      parent_club_id: `club-${index + 1}`,
      name: `${team.name} Ground`,
      status: "active",
      simultaneous_fixture_limit: 1,
    })),
    teams,
    playing_dates: playingDates,
    blackouts: [],
    fixtures: [],
  });
}

function completeEntries(workspace, meetings = 3, rotationSeed = 0) {
  const matrix = buildDivisionFixtureMatrix(workspace.teams, { meetings, maxConsecutive: 3, rotationSeed });
  return matrix.map((fixture) => ({
    ...fixture,
    id: `entry-${fixture.meetingNumber}-${fixture.roundNumber}-${fixture.homeTeamId}-${fixture.awayTeamId}`,
    seasonId: "season-1",
    divisionId: "division-1",
    venueId: workspace.teams.find((team) => team.id === fixture.homeTeamId)?.homeVenueId,
    scheduledDate: workspace.playingDates[fixture.roundNumber - 1].playingDate,
    kickOff: "15:00",
    placementStatus: "placed",
  }));
}

describe("League Manager v3.5.2 real rules and schedule assurance", () => {
  test("supports one to four meetings with exact totals and balanced home allocation", () => {
    for (const teamCount of [5, 6, 9, 10]) {
      const teams = Array.from({ length: teamCount }, (_, index) => ({ id: `team-${index + 1}` }));
      for (const meetings of [1, 2, 3, 4]) {
        const fixtures = buildDivisionFixtureMatrix(teams, { meetings, maxConsecutive: 3 });
        expect(fixtures).toHaveLength((teamCount * (teamCount - 1) * meetings) / 2);
        teams.forEach((team) => {
          const counts = homeAwayCounts(fixtures, team.id);
          expect(counts.home + counts.away).toBe((teamCount - 1) * meetings);
          expect(Math.abs(counts.home - counts.away)).toBe(((teamCount - 1) * meetings) % 2);
        });
      }
    }
  });

  test("inverts the extra third-meeting host between season rotation seeds", () => {
    const teams = Array.from({ length: 7 }, (_, index) => ({ id: `team-${index + 1}` }));
    const firstSeason = buildDivisionFixtureMatrix(teams, { meetings: 3, maxConsecutive: 3, rotationSeed: 0 });
    const nextSeason = buildDivisionFixtureMatrix(teams, { meetings: 3, maxConsecutive: 3, rotationSeed: 1 });
    const pairKey = (fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join(":");
    const nextThirdMeetings = new Map(nextSeason.filter((fixture) => fixture.meetingNumber === 3).map((fixture) => [pairKey(fixture), fixture]));

    firstSeason.filter((fixture) => fixture.meetingNumber === 3).forEach((fixture) => {
      const inverted = nextThirdMeetings.get(pairKey(fixture));
      expect(inverted.homeTeamId).toBe(fixture.awayTeamId);
      expect(inverted.awayTeamId).toBe(fixture.homeTeamId);
    });
  });

  test("detects missing, unexpected and incorrect team totals before publication", () => {
    const workspace = createAssuranceWorkspace();
    const complete = completeEntries(workspace);
    expect(validateLeagueSchedule(workspace, complete, { seasonId: "season-1", divisionIds: ["division-1"] }).valid).toBe(true);

    const missing = complete.slice(1);
    const missingValidation = validateLeagueSchedule(workspace, missing, { seasonId: "season-1", divisionIds: ["division-1"] });
    expect(missingValidation.valid).toBe(false);
    expect(missingValidation.issues.some((item) => item.code === "missing-required-fixtures")).toBe(true);
    expect(missingValidation.issues.some((item) => item.code === "team-fixture-total-mismatch")).toBe(true);

    const unexpected = [
      ...complete,
      { ...complete[0], id: "unexpected-entry", meetingNumber: 4, roundNumber: 10, scheduledDate: workspace.playingDates[9].playingDate },
    ];
    const unexpectedValidation = validateLeagueSchedule(workspace, unexpected, { seasonId: "season-1", divisionIds: ["division-1"] });
    expect(unexpectedValidation.valid).toBe(false);
    expect(unexpectedValidation.issues.some((item) => item.code === "unexpected-fixture")).toBe(true);
  });

  test("searches league clubs, teams, venues, fixtures and officials with navigation targets", () => {
    const workspace = createAssuranceWorkspace();
    workspace.fixtures = [{
      id: "fixture-1",
      divisionId: "division-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      venueId: "venue-1",
      scheduledDate: "2026-09-05",
    }];
    const index = buildLeagueCommandSearchIndex(workspace, {
      officials: [{ id: "official-1", name: "Jamie Referee", grade: "Level 5", status: "active" }],
    });

    expect(searchLeagueCommandIndex(index, "Alpha")[0]).toEqual(expect.objectContaining({ type: "Team", tab: "structure", child: "team" }));
    expect(searchLeagueCommandIndex(index, "Ground").some((item) => item.type === "Venue")).toBe(true);
    expect(searchLeagueCommandIndex(index, "Alpha Bravo")[0]).toEqual(expect.objectContaining({ type: "Fixture", tab: "fixtures" }));
    expect(searchLeagueCommandIndex(index, "Jamie")[0]).toEqual(expect.objectContaining({ type: "Official", tab: "officials", child: "pool" }));
  });

  test("adds server-enforced structure assurance and the v3.5.2 operator safeguards", () => {
    expect(migration).toContain("extra_home_rotation_offset");
    expect(migration).toContain("private.league_schedule_structure_assurance");
    expect(migration).toContain("private.league_schedule_combined_validation");
    expect(migration).toContain("pairing-meeting-count-mismatch");
    expect(migration).toContain("team-fixture-total-mismatch");
    expect(migration).toContain("home-allocation-mismatch");
    expect(migration).toContain("validation := private.league_schedule_combined_validation");
    expect(leaguePage).toContain("LeagueCommandSearch");
    expect(leaguePage).toContain("Odd-meeting home cycle");
    expect(leaguePage).toContain("useUnsavedChangesGuard");
    expect(scheduleWorkspace).toContain("Competition-format assurance");
    expect(scheduleWorkspace).toContain("usePersistedWorkspaceState");
    expect(fixtureWorkspace).toContain("usePersistedWorkspaceState");
    expect(resultsWorkspace).toContain("usePersistedWorkspaceState");
  });
});
