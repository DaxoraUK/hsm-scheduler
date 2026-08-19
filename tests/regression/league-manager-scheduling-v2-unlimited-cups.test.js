import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildDivisionFixtureMatrix,
  generateLeagueSchedule,
  getLeagueSchedulePreflight,
  validateLeagueSchedule,
} from "../../src/lib/league/leagueSchedulingEngine.js";
import {
  buildCupOpeningRound,
  buildNextCupRound,
  findCupLeagueConflicts,
  getCupEligibleTeams,
  prepareLeagueRebalanceForCups,
} from "../../src/lib/league/leagueCupEngine.js";
import { normaliseLeagueWorkspace } from "../../src/lib/league/leagueManagerModel.js";

const migration = readFileSync("supabase/migrations/202607130011_league_scheduling_v2_and_cup_manager.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const scheduleUi = readFileSync("src/components/league/LeagueScheduleWorkspace.jsx", "utf8");
const cupUi = readFileSync("src/components/league/LeagueCupWorkspace.jsx", "utf8");
const schedulingEngine = readFileSync("src/lib/league/leagueSchedulingEngine.js", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function weeklyDates(start, count, divisionIds = []) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const rows = [];
  divisionIds.forEach((divisionId) => {
    for (let index = 0; index < count; index += 1) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + (index * 7));
      rows.push({
        id: `${divisionId}-date-${index + 1}`,
        season_id: "season-1",
        division_id: divisionId,
        playing_date: date.toISOString().slice(0, 10),
        default_kick_off: divisionId === "division-2" ? "13:30:00" : "14:00:00",
        status: "available",
      });
    }
  });
  return rows;
}

function createWorkspace() {
  const divisions = [
    { id: "division-1", season_id: "season-1", name: "Premier", sort_order: 1, starts_on: "2026-08-15", ends_on: "2027-05-29", meetings_per_pairing: 2, max_consecutive_home_away: 2 },
    { id: "division-2", season_id: "season-1", name: "Division One", sort_order: 2, starts_on: "2026-08-22", ends_on: "2027-05-29", meetings_per_pairing: 3, default_kick_off: "13:30:00", max_consecutive_home_away: 3 },
  ];
  const teams = divisions.flatMap((division, divisionIndex) => Array.from({ length: 4 }, (_, index) => ({
    id: `d${divisionIndex + 1}-team-${index + 1}`,
    season_id: "season-1",
    division_id: division.id,
    parent_club_id: `d${divisionIndex + 1}-club-${index + 1}`,
    home_venue_id: `d${divisionIndex + 1}-venue-${index + 1}`,
    name: `${division.name} Team ${index + 1}`,
    status: "active",
  })));
  return normaliseLeagueWorkspace({
    league: { id: "league-1", name: "Pilot League" },
    access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
    seasons: [{ id: "season-1", name: "2026/27", starts_on: "2026-08-01", ends_on: "2027-06-30", default_kick_off: "14:00:00", primary_weekday: 6, max_consecutive_home_away: 2, is_current: true, status: "active" }],
    divisions,
    clubs: teams.map((team) => ({ id: team.parent_club_id, name: `${team.name} Club`, status: "active" })),
    venues: teams.map((team) => ({
      id: team.home_venue_id,
      parent_club_id: team.parent_club_id,
      name: `${team.name} Ground`,
      status: "active",
      simultaneous_fixture_limit: 1,
      ground_share_key: "",
    })),
    teams,
    playing_dates: [
      ...weeklyDates("2026-08-15", 32, ["division-1"]),
      ...weeklyDates("2026-08-22", 32, ["division-2"]),
    ],
    blackouts: [],
    fixtures: [],
    cups: [],
    cup_divisions: [],
    cup_team_overrides: [],
    cup_rounds: [],
    cup_ties: [],
  });
}

function maxHomeAwayRun(fixtures, teamId) {
  let side = "";
  let run = 0;
  let maximum = 0;
  [...fixtures].sort((left, right) => left.roundNumber - right.roundNumber).forEach((fixture) => {
    if (fixture.homeTeamId !== teamId && fixture.awayTeamId !== teamId) return;
    const nextSide = fixture.homeTeamId === teamId ? "home" : "away";
    run = nextSide === side ? run + 1 : 1;
    side = nextSide;
    maximum = Math.max(maximum, run);
  });
  return maximum;
}

describe("League Manager scheduling v2 and unlimited cups", () => {
  test("uses league and division settings as the only source of kick-off and date rules", () => {
    const workspace = createWorkspace();
    const preflight = getLeagueSchedulePreflight(workspace, { seasonId: "season-1" });
    const generated = generateLeagueSchedule(workspace, { seasonId: "season-1" });

    expect(preflight.ready).toBe(true);
    expect(generated.errors).toEqual([]);
    expect(generated.summary.divisions).toBe(2);
    expect(generated.entries).toHaveLength(12 + 18);
    expect(generated.entries.every((entry) => entry.scheduledDate)).toBe(true);
    expect(generated.entries.filter((entry) => entry.divisionId === "division-1").every((entry) => entry.scheduledDate >= "2026-08-15" && entry.kickOff === "14:00")).toBe(true);
    expect(generated.entries.filter((entry) => entry.divisionId === "division-2").every((entry) => entry.scheduledDate >= "2026-08-22" && entry.kickOff === "13:30")).toBe(true);
  });

  test("supports three meetings per pairing with stable meeting identities", () => {
    const teams = Array.from({ length: 7 }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}` }));
    const fixtures = buildDivisionFixtureMatrix(teams, { meetings: 3, maxConsecutive: 2 });

    expect(fixtures).toHaveLength(63);
    expect(new Set(fixtures.map((fixture) => fixture.meetingNumber))).toEqual(new Set([1, 2, 3]));
    expect(new Set(fixtures.map((fixture) => `${[fixture.homeTeamId, fixture.awayTeamId].sort().join(":")}:${fixture.meetingNumber}`)).size).toBe(63);
    teams.forEach((team) => expect(maxHomeAwayRun(fixtures, team.id)).toBeLessThanOrEqual(3));
  });

  test("generates all divisions together and produces a publishable conflict-free programme", () => {
    const workspace = createWorkspace();
    const generated = generateLeagueSchedule(workspace, { seasonId: "season-1" });
    const validation = validateLeagueSchedule(workspace, generated.entries, generated.config);

    expect(new Set(generated.entries.map((entry) => entry.divisionId))).toEqual(new Set(["division-1", "division-2"]));
    expect(validation.blockingCount).toBe(0);
    expect(validation.issues.some((item) => ["before-division-start", "after-division-end", "team-double-booking"].includes(item.code))).toBe(false);
  });

  test("allows an unlimited number of cup records and calculates eligibility from divisions plus team overrides", () => {
    const workspace = createWorkspace();
    workspace.cups = Array.from({ length: 8 }, (_, index) => ({ id: `cup-${index + 1}`, seasonId: "season-1", name: `Cup ${index + 1}` }));
    workspace.cupDivisions = [{ id: "cd-1", cupId: "cup-1", divisionId: "division-1" }];
    workspace.cupTeamOverrides = [
      { id: "override-include", cupId: "cup-1", teamId: "d2-team-1", included: true },
      { id: "override-exclude", cupId: "cup-1", teamId: "d1-team-4", included: false },
    ];

    const eligible = getCupEligibleTeams(workspace, "cup-1");
    expect(workspace.cups).toHaveLength(8);
    expect(eligible.map((team) => team.id)).toEqual(expect.arrayContaining(["d1-team-1", "d1-team-2", "d1-team-3", "d2-team-1"]));
    expect(eligible.map((team) => team.id)).not.toContain("d1-team-4");
  });

  test("creates cup draws with byes, advances winners and honours final settings", () => {
    const workspace = createWorkspace();
    const teams = workspace.teams.slice(0, 5);
    const cup = { id: "cup-1", seasonId: "season-1", name: "League Cup", drawMode: "random", sameClubAvoidUntilRound: 2, finalDate: "2027-05-15", finalVenueId: "d1-venue-1" };
    const opening = buildCupOpeningRound(teams, cup, { scheduledDate: "2026-09-05", kickOff: "14:00" });

    expect(opening.errors).toEqual([]);
    expect(opening.summary.byes).toBe(3);
    expect(opening.ties.filter((tie) => tie.status === "bye")).toHaveLength(3);

    const completed = opening.ties.map((tie) => ({ ...tie, winnerTeamId: tie.winnerTeamId || tie.homeTeamId, winnerParentClubId: "club", winnerVenueId: "d1-venue-1" }));
    const next = buildNextCupRound(completed, cup, { scheduledDate: "2026-10-03", kickOff: "14:00" });
    expect(next.errors).toEqual([]);
    expect(next.ties.every((tie) => tie.kickOff === "14:00")).toBe(true);
  });

  test("postponed cup ties stop reserving resources and only conflicting unlocked league fixtures are displaced", () => {
    const leagueEntries = [
      { id: "league-1", seasonId: "season-1", divisionId: "division-1", homeTeamId: "d1-team-1", awayTeamId: "d1-team-2", venueId: "d1-venue-1", scheduledDate: "2026-09-05", kickOff: "14:00", locked: false },
      { id: "league-2", seasonId: "season-1", divisionId: "division-1", homeTeamId: "d1-team-3", awayTeamId: "d1-team-4", venueId: "d1-venue-3", scheduledDate: "2026-09-05", kickOff: "14:00", locked: true },
    ];
    const activeCupTie = { id: "tie-1", seasonId: "season-1", homeTeamId: "d1-team-1", awayTeamId: "d2-team-1", venueId: "d1-venue-1", scheduledDate: "2026-09-05", kickOff: "14:00", status: "scheduled" };
    const postponedCupTie = { ...activeCupTie, id: "tie-2", status: "postponed" };

    expect(findCupLeagueConflicts(leagueEntries, [postponedCupTie])).toHaveLength(0);
    const rebalance = prepareLeagueRebalanceForCups(leagueEntries, [activeCupTie]);
    expect(rebalance.movedCount).toBe(1);
    expect(rebalance.baseEntries.find((entry) => entry.id === "league-1")).toEqual(expect.objectContaining({ scheduledDate: "", placementStatus: "unplaced" }));
    expect(rebalance.baseEntries.find((entry) => entry.id === "league-2")?.scheduledDate).toBe("2026-09-05");
  });

  test("adds server-enforced v2 rules, unlimited cup storage and secure rescheduling functions", () => {
    for (const table of ["league_cups", "league_cup_divisions", "league_cup_team_overrides", "league_cup_rounds", "league_cup_ties"]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("meetings_per_pairing");
    expect(migration).toContain("default_kick_off");
    expect(migration).not.toContain("default_kick_off time not null default '15:00'");
    expect(migration).toContain("synchronise_league_season_calendar");
    expect(migration).toContain("save_league_cup_round_draw");
    expect(migration).toContain("update_league_cup_tie");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("tie.status not in ('cancelled', 'void', 'bye', 'postponed')");
    expect(migration).toContain("v_round_number");
    expect(migration).not.toContain("cup_round.round_number = round_number");
    expect(supabase).toContain('rpc/upsert_league_cup');
    expect(supabase).toContain('rpc/save_league_cup_round_draw');
    expect(supabase).toContain('rpc/update_league_cup_tie');
  });

  test("exposes the complete settings-driven league and unlimited cup operator workflow", () => {
    expect(leaguePage).toContain('"cups", "Cups"');
    expect(leaguePage).toContain("League default kick-off");
    expect(leaguePage).toContain("Meetings per pairing");
    expect(scheduleUi).toContain("Generate full league programme");
    expect(scheduleUi).toContain("No week or date selection is required");
    expect(scheduleUi).toContain("Meeting {entry.meetingNumber || 1}");
    expect(cupUi).toContain("Unlimited competitions");
    expect(cupUi).toContain("Generate opening draw");
    expect(cupUi).toContain("Generate next round");
    expect(cupUi).toContain("Team progressing");
    expect(cupUi).toContain("Rebalance league around cups");
    expect(cupUi).toContain('status === "postponed"');
    expect(schedulingEngine).not.toContain('|| "15:00"');
  });
});
