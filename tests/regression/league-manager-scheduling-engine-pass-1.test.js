import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildDivisionFixtureMatrix,
  compareLeagueScheduleVersions,
  generateLeagueSchedule,
  leagueScheduleToCsv,
  serialiseScheduleEntries,
  validateLeagueSchedule,
} from "../../src/lib/league/leagueSchedulingEngine.js";
import { normaliseLeagueWorkspace } from "../../src/lib/league/leagueManagerModel.js";

const migration = readFileSync("supabase/migrations/202607130006_league_manager_scheduling_engine_pass_1.sql", "utf8");
const page = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const scheduleWorkspace = readFileSync("src/components/league/LeagueScheduleWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function createWorkspace({ sharedGround = false } = {}) {
  const teams = ["Alpha", "Bravo", "Charlie", "Delta"].map((name, index) => ({
    id: `team-${index + 1}`,
    season_id: "season-1",
    division_id: "division-1",
    parent_club_id: `club-${index + 1}`,
    home_venue_id: `venue-${index + 1}`,
    name: `${name} FC`,
    status: "active",
  }));
  const dates = Array.from({ length: 8 }, (_, index) => {
    const day = 15 + (index * 7);
    const date = new Date(Date.UTC(2026, 7, day));
    return {
      id: `date-${index + 1}`,
      season_id: "season-1",
      playing_date: date.toISOString().slice(0, 10),
      default_kick_off: "15:00:00",
      status: "available",
    };
  });

  return normaliseLeagueWorkspace({
    league: { id: "league-1", name: "Test League", slug: "test-league" },
    access: { role: "owner", can_manage: true, can_operate: true, read_only: false },
    seasons: [{ id: "season-1", name: "2026/27", starts_on: "2026-08-01", ends_on: "2027-06-30", is_current: true, status: "active" }],
    divisions: [{ id: "division-1", season_id: "season-1", name: "Premier Division", sort_order: 1 }],
    clubs: teams.map((team, index) => ({ id: `club-${index + 1}`, name: team.name, status: "active" })),
    venues: teams.map((team, index) => ({
      id: `venue-${index + 1}`,
      parent_club_id: `club-${index + 1}`,
      name: `${team.name} Ground`,
      status: "active",
      ground_share_key: sharedGround && index < 2 ? "SHARED-1" : "",
      simultaneous_fixture_limit: 1,
    })),
    teams,
    blackouts: [],
    playing_dates: dates,
    fixtures: [],
  });
}

describe("League Manager scheduling engine pass 1", () => {
  test("builds balanced single and double round-robin matrices", () => {
    const teams = Array.from({ length: 6 }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}` }));
    const single = buildDivisionFixtureMatrix(teams, { meetings: 1 });
    const double = buildDivisionFixtureMatrix(teams, { meetings: 2 });

    expect(single).toHaveLength(15);
    expect(double).toHaveLength(30);
    expect(new Set(double.map((fixture) => `${fixture.homeTeamId}:${fixture.awayTeamId}`))).toHaveLength(30);

    teams.forEach((team) => {
      const singleHome = single.filter((fixture) => fixture.homeTeamId === team.id).length;
      const singleAway = single.filter((fixture) => fixture.awayTeamId === team.id).length;
      const doubleHome = double.filter((fixture) => fixture.homeTeamId === team.id).length;
      const doubleAway = double.filter((fixture) => fixture.awayTeamId === team.id).length;
      expect(Math.abs(singleHome - singleAway)).toBeLessThanOrEqual(1);
      expect(doubleHome).toBe(doubleAway);
    });
  });

  test("handles odd-numbered divisions without creating a bye fixture", () => {
    const teams = Array.from({ length: 5 }, (_, index) => ({ id: `team-${index + 1}`, name: `Team ${index + 1}` }));
    const matrix = buildDivisionFixtureMatrix(teams, { meetings: 1 });
    expect(matrix).toHaveLength(10);
    expect(matrix.every((fixture) => fixture.homeTeamId && fixture.awayTeamId)).toBe(true);
    expect(new Set(matrix.map((fixture) => [fixture.homeTeamId, fixture.awayTeamId].sort().join(":"))).size).toBe(10);
  });

  test("allocates a complete home-and-away programme across valid playing dates", () => {
    const workspace = createWorkspace();
    const result = generateLeagueSchedule(workspace, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 2 });
    const validation = validateLeagueSchedule(workspace, result.entries, result.config);

    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(12);
    expect(result.summary).toEqual(expect.objectContaining({ placed: 12, unplaced: 0 }));
    expect(validation.valid).toBe(true);
    expect(validation.blockingCount).toBe(0);
  });

  test("enforces blackouts, team dates and ground-share capacity with explained unresolved fixtures", () => {
    const workspace = createWorkspace({ sharedGround: true });
    workspace.playingDates = workspace.playingDates.slice(0, 2);
    workspace.blackouts = [{
      id: "blackout-1",
      leagueId: "league-1",
      seasonId: "season-1",
      scopeType: "team",
      scopeId: "team-1",
      startsOn: workspace.playingDates[0].playingDate,
      endsOn: workspace.playingDates[1].playingDate,
      reason: "Club unavailable",
    }];

    const result = generateLeagueSchedule(workspace, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 2 });
    expect(result.summary.unplaced).toBeGreaterThan(0);
    expect(result.entries.filter((entry) => !entry.scheduledDate).every((entry) => entry.unresolvedReason.length > 10)).toBe(true);

    const validation = validateLeagueSchedule(workspace, result.entries, result.config);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((item) => item.code === "unplaced-fixture")).toBe(true);
  });

  test("preserves locked official fixtures and rebuilds only unresolved entries", () => {
    const workspace = createWorkspace();
    workspace.fixtures = [{
      id: "fixture-locked",
      seasonId: "season-1",
      divisionId: "division-1",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
      venueId: "venue-1",
      scheduledDate: workspace.playingDates[3].playingDate,
      kickOff: "14:00",
      status: "scheduled",
      locked: true,
    }];
    const generated = generateLeagueSchedule(workspace, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 2 });
    const locked = generated.entries.find((entry) => entry.sourceFixtureId === "fixture-locked");
    expect(locked).toEqual(expect.objectContaining({ scheduledDate: workspace.playingDates[3].playingDate, kickOff: "14:00", locked: true }));

    const edited = generated.entries.map((entry, index) => index === 1 ? { ...entry, scheduledDate: "", kickOff: "", placementStatus: "unplaced" } : entry);
    const rebuilt = generateLeagueSchedule(workspace, {
      seasonId: "season-1",
      divisionIds: ["division-1"],
      meetings: 2,
      baseEntries: edited,
      preservePlacedBaseEntries: true,
    });
    expect(rebuilt.entries.find((entry) => entry.sourceFixtureId === "fixture-locked")?.scheduledDate).toBe(workspace.playingDates[3].playingDate);
    expect(rebuilt.summary.placed).toBe(12);
  });

  test("detects manual team and shared-ground collisions before publication", () => {
    const workspace = createWorkspace({ sharedGround: true });
    const generated = generateLeagueSchedule(workspace, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 1 });
    const [first, second, ...rest] = generated.entries;
    const conflicted = [
      first,
      { ...second, scheduledDate: first.scheduledDate, kickOff: first.kickOff, venueId: "venue-2" },
      ...rest,
    ];
    const validation = validateLeagueSchedule(workspace, conflicted, generated.config);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((item) => ["team-double-booking", "ground-capacity-conflict"].includes(item.code))).toBe(true);
  });

  test("compares versions and creates a readable league export", () => {
    const workspace = createWorkspace();
    const generated = generateLeagueSchedule(workspace, { seasonId: "season-1", divisionIds: ["division-1"], meetings: 1 });
    const moved = generated.entries.map((entry, index) => index === 0 ? { ...entry, scheduledDate: workspace.playingDates[7].playingDate } : entry);
    const comparison = compareLeagueScheduleVersions(generated.entries, moved);
    expect(comparison.moved).toBe(1);
    expect(comparison.unchanged).toBe(generated.entries.length - 1);

    const csv = leagueScheduleToCsv(moved, workspace, { name: "Pilot draft", versionNumber: 1 });
    expect(csv).toContain("schedule_version,division,round,date");
    expect(csv).toContain("Pilot draft");
    expect(csv).toContain("Alpha FC");
    expect(serialiseScheduleEntries(moved)[0]).toEqual(expect.objectContaining({ home_team_id: expect.any(String), placement_status: "placed" }));
  });

  test("adds secure versioned persistence, server validation and publication RPCs", () => {
    for (const table of ["league_schedule_versions", "league_schedule_entries"]) expect(migration).toContain(`public.${table}`);
    expect(migration).toContain("force row level security");
    expect(migration).toContain("private.league_schedule_validation");
    expect(migration).toContain("public.save_league_schedule_draft");
    expect(migration).toContain("public.validate_league_schedule_version");
    expect(migration).toContain("public.publish_league_schedule_version");
    expect(migration).toContain("public.clone_league_schedule_version");
    expect(migration).toContain("A venue or ground-share group exceeds its simultaneous fixture limit");

    expect(supabase).toContain('rpc/save_league_schedule_draft');
    expect(supabase).toContain('rpc/update_league_schedule_entry');
    expect(supabase).toContain('rpc/validate_league_schedule_version');
    expect(supabase).toContain('rpc/publish_league_schedule_version');
    expect(supabase).toContain('rpc/clone_league_schedule_version');
  });

  test("exposes the complete pilot scheduling workflow without mixing it into club plans", () => {
    expect(page).toContain('"schedule", "Schedule builder"');
    expect(page).toContain("Simultaneous fixtures");
    expect(scheduleWorkspace).toContain("Generate draft");
    expect(scheduleWorkspace).toContain("Rebuild unresolved only");
    expect(scheduleWorkspace).toContain("Compare versions");
    expect(scheduleWorkspace).toContain("Restore as new draft");
    expect(scheduleWorkspace).toContain("Publish schedule");
    expect(scheduleWorkspace).toContain("Validated schedule CSV downloaded");
  });
});
