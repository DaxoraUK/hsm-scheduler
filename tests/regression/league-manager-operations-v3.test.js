import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildLeagueOperationalFixtures,
  getFixtureOfficialRequirement,
  getLeagueOfficialCoverage,
  getRequiredOfficialRoles,
  normaliseLeagueOperationsData,
  suggestLeagueOfficialAssignments,
} from "../../src/lib/league/leagueOperationsEngine.js";

const fixtureCommand = readFileSync("src/components/league/LeagueFixtureCommandWorkspace.jsx", "utf8");
const officialsUi = readFileSync("src/components/league/LeagueOfficialsWorkspace.jsx", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const responseApi = readFileSync("api/league/official-response.js", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");
const migration = readFileSync("supabase/migrations/202607140001_league_operations_fixture_command_and_officials.sql", "utf8");

function workspace() {
  return {
    league: { id: "league-1", slug: "pilot" },
    divisions: [{ id: "prem", name: "Premier Division" }, { id: "d1", name: "Division One" }],
    cups: [{ id: "cup-1", name: "League Cup" }],
    cupTies: [],
    clubs: [
      { id: "club-a", name: "Club A" },
      { id: "club-b", name: "Club B" },
      { id: "club-c", name: "Club C" },
      { id: "club-d", name: "Club D" },
    ],
    teams: [
      { id: "a", name: "A", parentClubId: "club-a" },
      { id: "b", name: "B", parentClubId: "club-b" },
      { id: "c", name: "C", parentClubId: "club-c" },
      { id: "d", name: "D", parentClubId: "club-d" },
    ],
    venues: [
      { id: "venue-1", name: "Ground 1", postcode: "BL1 1AA" },
      { id: "venue-2", name: "Ground 2", postcode: "M1 1AA" },
    ],
  };
}

function schedule() {
  return {
    entries: [
      { id: "fixture-1", divisionId: "prem", scheduledDate: "2026-08-15", kickOff: "14:00", venueId: "venue-1", homeTeamId: "a", awayTeamId: "b", placementStatus: "placed", status: "scheduled" },
      { id: "fixture-2", divisionId: "d1", scheduledDate: "2026-08-15", kickOff: "14:00", venueId: "venue-2", homeTeamId: "c", awayTeamId: "d", placementStatus: "placed", status: "scheduled" },
    ],
  };
}

function officials() {
  return [
    { id: "senior", name: "Senior Ref", status: "active", grade: "Level 4", canReferee: true, canAssistant: true, maxAppointmentsPerDay: 1, maxAppointmentsPerWeek: 2, homePostcode: "BL2 2AA" },
    { id: "assistant-one", name: "Assistant One", status: "active", grade: "Level 4", canReferee: false, canAssistant: true, maxAppointmentsPerDay: 1, maxAppointmentsPerWeek: 2, homePostcode: "BL3 3AA" },
    { id: "assistant-two", name: "Assistant Two", status: "active", grade: "Level 4", canReferee: false, canAssistant: true, maxAppointmentsPerDay: 1, maxAppointmentsPerWeek: 2, homePostcode: "BL4 4AA" },
    { id: "second-ref", name: "Second Ref", status: "active", grade: "Level 5", canReferee: true, canAssistant: false, maxAppointmentsPerDay: 1, maxAppointmentsPerWeek: 2, homePostcode: "M2 2AA" },
  ];
}

describe("League Operations v3 fixture command and match officials", () => {
  test("normalises server operations and keeps map coordinates numeric", () => {
    const result = normaliseLeagueOperationsData({
      access: { can_manage_officials: true, can_operate: true },
      officials: [{ id: "official-1", can_referee: true, max_appointments_per_day: 2 }],
      venue_positions: [{ id: "venue-1", latitude: "53.58", longitude: "-2.43" }],
    });
    expect(result.access.canManageOfficials).toBe(true);
    expect(result.officials[0]).toEqual(expect.objectContaining({ canReferee: true, maxAppointmentsPerDay: 2 }));
    expect(result.venuePositions[0]).toEqual(expect.objectContaining({ latitude: 53.58, longitude: -2.43 }));
  });

  test("lets Premier Division require a referee and two assistants without hard-coding the division name", () => {
    const fixtures = buildLeagueOperationalFixtures(workspace(), schedule());
    const requirements = [
      { scopeType: "league", scopeId: "", refereeCount: 1, assistantCount: 0 },
      { scopeType: "division", scopeId: "prem", refereeCount: 1, assistantCount: 2, minimumGrade: "Level 4" },
    ];
    const premier = fixtures.find((fixture) => fixture.divisionId === "prem");
    const divisionOne = fixtures.find((fixture) => fixture.divisionId === "d1");
    expect(getRequiredOfficialRoles(getFixtureOfficialRequirement(premier, requirements))).toEqual(["referee", "assistant_1", "assistant_2"]);
    expect(getRequiredOfficialRoles(getFixtureOfficialRequirement(divisionOne, requirements))).toEqual(["referee"]);
  });

  test("suggests a complete matchday while enforcing grade, availability, conflicts and no double appointments", () => {
    const fixtures = buildLeagueOperationalFixtures(workspace(), schedule());
    const requirements = [
      { scopeType: "league", scopeId: "", refereeCount: 1, assistantCount: 0, minimumGrade: "Level 5" },
      { scopeType: "division", scopeId: "prem", refereeCount: 1, assistantCount: 2, minimumGrade: "Level 4" },
    ];
    const result = suggestLeagueOfficialAssignments({
      fixtures,
      officials: officials(),
      requirements,
      availability: [{ officialId: "second-ref", availableOn: "2026-08-15", availabilityStatus: "available" }],
      conflicts: [{ officialId: "senior", parentClubId: "club-c" }],
      assignments: [],
      workspace: workspace(),
    });
    const premierRows = result.suggestions.filter((row) => row.targetId === "fixture-1");
    expect(premierRows).toHaveLength(3);
    expect(premierRows.find((row) => row.role === "referee")?.officialId).toBe("senior");
    expect(new Set(premierRows.map((row) => row.officialId)).size).toBe(3);
    expect(result.suggestions.find((row) => row.targetId === "fixture-2" && row.role === "referee")?.officialId).toBe("second-ref");
    expect(result.unresolved).toEqual([]);
  });

  test("reports missing assistants and accepted appointments through one coverage model", () => {
    const fixtures = buildLeagueOperationalFixtures(workspace(), schedule());
    const requirements = [{ scopeType: "division", scopeId: "prem", refereeCount: 1, assistantCount: 2 }];
    const assignments = [{ targetType: "schedule_entry", targetId: "fixture-1", role: "referee", officialId: "senior", status: "accepted" }];
    const coverage = getLeagueOfficialCoverage(fixtures, requirements, assignments);
    expect(coverage.required).toBe(4);
    expect(coverage.filled).toBe(1);
    expect(coverage.missing).toHaveLength(3);
  });

  test("ships the five-view Fixture Command and full officials operator workflow", () => {
    for (const label of ["Calendar", "Season grid", "Venue map", "Fixture list", "Exceptions"]) expect(fixtureCommand).toContain(label);
    for (const label of ["Official pool", "Requirements", "Appointments", "Availability & conflicts", "Postponements", "Reports"]) expect(officialsUi).toContain(label);
    expect(officialsUi).toContain("Suggest all officials");
    expect(officialsUi).toContain("Save appointment board");
    expect(officialsUi).toContain('"assistant_1"');
    expect(officialsUi).toContain('"assistant_2"');
    expect(officialsUi).toContain('"fourth_official"');
    expect(officialsUi).toContain('"observer"');
    expect(leaguePage).toContain('"command", "Fixture Command"');
    expect(leaguePage).toContain('"officials", "Match officials"');
  });

  test("uses a secure server model, atomic appointment save and anonymous accept-or-decline response", () => {
    for (const table of ["league_officials", "league_official_availability", "league_official_conflicts", "league_official_requirements", "league_official_assignments", "league_postponement_requests"]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("private.league_official_response_tokens");
    expect(migration).toContain("bulk_upsert_league_official_assignments");
    expect(migration).toContain("can_manage_league_officials");
    expect(migration).toContain("Selected official is unavailable on this date");
    expect(migration).toContain("Selected official has a declared club or team conflict");
    expect(migration).toContain("Official weekly appointment limit would be exceeded");
    expect(migration).toContain("Selected official does not meet the competition minimum grade");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("to anon, authenticated");
    expect(supabase).toContain('rpc/get_league_operations_data');
    expect(supabase).toContain('rpc/bulk_upsert_league_official_assignments');
    expect(responseApi).toContain("Accept appointment");
    expect(responseApi).toContain("Decline appointment");
    expect(responseApi).toContain("respond_to_league_official_assignment");
  });
});
