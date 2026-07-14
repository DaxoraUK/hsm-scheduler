import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assessLeaguePlayerEligibility,
  leagueEligibilityExceptionsToCsv,
  leagueRegistrationsToCsv,
  normaliseLeagueRegistrationData,
  playerAgeOn,
} from "../../src/lib/league/leagueRegistrationEngine.js";
import { buildLeagueCommandCentre } from "../../src/lib/league/leagueCommandCentre.js";

const migration = readFileSync("supabase/migrations/202607140008_league_registrations_eligibility_player_administration.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const registrationWorkspace = readFileSync("src/components/league/LeagueRegistrationsWorkspace.jsx", "utf8");
const clubPortal = readFileSync("src/components/league/LeagueClubPortalPage.jsx", "utf8");
const clubPanel = readFileSync("src/components/league/LeagueClubRegistrationsPanel.jsx", "utf8");
const commandCentre = readFileSync("src/components/league/LeagueCommandCentreWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function registrationPayload() {
  return {
    access: { role: "registrations", can_view: true, can_manage: true, can_submit: true },
    players: [
      { id: "player-1", first_name: "Alex", last_name: "Morgan", date_of_birth: "2010-05-20", status: "active" },
      { id: "player-2", first_name: "Alex", last_name: "Morgan", date_of_birth: "2010-05-20", status: "active" },
      { id: "player-3", first_name: "Jamie", last_name: "Taylor", date_of_birth: "2009-02-12", status: "active" },
    ],
    registrations: [
      {
        id: "reg-1",
        season_id: "season-1",
        player_id: "player-1",
        parent_club_id: "club-1",
        team_id: "team-1",
        player_name: "Alex Morgan",
        club_name: "Alpha FC",
        team_name: "Alpha U18",
        season_name: "2026/27",
        registration_type: "new",
        status: "approved",
        submitted_at: "2026-07-01T12:00:00Z",
        effective_from: "2026-07-01",
        effective_to: "2027-06-30",
      },
      {
        id: "reg-2",
        season_id: "season-1",
        player_id: "player-3",
        parent_club_id: "club-2",
        team_id: "team-2",
        player_name: "Jamie Taylor",
        club_name: "Bravo FC",
        team_name: "Bravo U18",
        season_name: "2026/27",
        registration_type: "renewal",
        status: "correction_required",
        correction_notes: "Proof of date of birth required",
      },
    ],
    transfers: [{ id: "transfer-1", player_id: "player-3", status: "submitted", from_club_name: "Bravo FC", to_club_name: "Charlie FC" }],
    dispensations: [{ id: "disp-1", player_id: "player-3", team_id: "team-2", player_name: "Jamie Taylor", team_name: "Bravo U18", rule_type: "maximum_age", status: "submitted", reason: "Education year exception" }],
    team_sheets: [{ id: "sheet-1", validation_status: "failed", status: "submitted", fixture_label: "Alpha v Bravo" }],
    team_sheet_players: [],
    rules: [],
    fixtures: [],
    sanctions: [],
  };
}

function eligibilityContext(overrides = {}) {
  const player = { id: "player-1", dateOfBirth: "2010-05-20" };
  const registration = {
    id: "reg-1",
    playerId: "player-1",
    teamId: "team-1",
    status: "approved",
    submittedAt: "2026-07-01T12:00:00Z",
    effectiveFrom: "2026-07-01",
    effectiveTo: "2027-06-30",
  };
  return {
    player,
    registration,
    team: { id: "team-1" },
    fixture: {
      id: "fixture-1",
      seasonId: "season-1",
      divisionId: "division-1",
      competitionType: "league",
      scheduledDate: "2026-09-05",
    },
    rules: [],
    dispensations: [],
    sanctions: [],
    appearances: [],
    ...overrides,
  };
}

describe("League Operations v3.7 registrations, eligibility and player administration", () => {
  test("normalises registration records and builds actionable reporting totals", () => {
    const data = normaliseLeagueRegistrationData(registrationPayload());

    expect(data.access).toEqual(expect.objectContaining({ role: "registrations", canManage: true, canSubmit: true }));
    expect(data.players[0]).toEqual(expect.objectContaining({ displayName: "Alex Morgan", dateOfBirth: "2010-05-20" }));
    expect(data.registrations[0]).toEqual(expect.objectContaining({ teamName: "Alpha U18", status: "approved" }));
    expect(data.summary).toEqual(expect.objectContaining({
      status: "action_required",
      activePlayers: 3,
      approvedRegistrations: 1,
      correctionRequired: 1,
      pendingTransfers: 1,
      openDispensations: 1,
      invalidTeamSheets: 1,
      duplicateWarnings: 2,
    }));
    expect(leagueRegistrationsToCsv(data)).toContain("Alex Morgan,2010-05-20,Alpha FC,Alpha U18");
    expect(leagueEligibilityExceptionsToCsv(data)).toContain("Jamie Taylor,Bravo U18,maximum_age,submitted");
    expect(playerAgeOn("2010-05-20", "2026-05-19")).toBe(15);
    expect(playerAgeOn("2010-05-20", "2026-05-20")).toBe(16);
  });

  test("enforces registration, age, suspension and cup-tied controls with dispensations", () => {
    expect(assessLeaguePlayerEligibility(eligibilityContext())).toEqual(expect.objectContaining({ status: "eligible", eligible: true }));

    const expired = assessLeaguePlayerEligibility(eligibilityContext({
      registration: { ...eligibilityContext().registration, effectiveTo: "2026-08-31" },
    }));
    expect(expired.reasons.map((row) => row.code)).toContain("REGISTRATION_EXPIRED");

    const suspended = assessLeaguePlayerEligibility(eligibilityContext({
      sanctions: [{ subjectType: "person", subjectId: "player-1", status: "active", startsOn: "2026-08-01", endsOn: "2026-10-01" }],
    }));
    expect(suspended.reasons.map((row) => row.code)).toContain("ACTIVE_SUSPENSION");

    const ageRule = { id: "rule-age", active: true, ruleType: "maximum_age", name: "Under-16 rule", severity: "block", config: { age: 15 } };
    const tooOld = assessLeaguePlayerEligibility(eligibilityContext({ rules: [ageRule] }));
    expect(tooOld.reasons.map((row) => row.code)).toContain("RULE_MAXIMUM_AGE");

    const dispensed = assessLeaguePlayerEligibility(eligibilityContext({
      rules: [ageRule],
      dispensations: [{ status: "approved", playerId: "player-1", teamId: "team-1", ruleType: "maximum_age", startsOn: "2026-08-01", endsOn: "2027-06-30" }],
    }));
    expect(dispensed.eligible).toBe(true);

    const cupTied = assessLeaguePlayerEligibility(eligibilityContext({
      fixture: { ...eligibilityContext().fixture, competitionType: "cup", competitionId: "cup-1" },
      rules: [{ id: "rule-cup", active: true, ruleType: "cup_tied", name: "Cup-tied", severity: "block", config: {} }],
      appearances: [{ playerId: "player-1", teamId: "team-2", competitionType: "cup", competitionId: "cup-1", status: "verified" }],
    }));
    expect(cupTied.reasons.map((row) => row.code)).toContain("RULE_CUP_TIED");
  });

  test("places registration exceptions into the registration-secretary command picture", () => {
    const registrations = normaliseLeagueRegistrationData(registrationPayload());
    const command = buildLeagueCommandCentre({
      role: "registrations",
      workspace: { fixtures: [], divisions: [], teams: [], venues: [], cupTies: [] },
      operations: { requirements: [], assignments: [], postponements: [] },
      clubOperations: { publications: [], acknowledgements: [], changeRequests: [] },
      results: { submissions: [], publishedFixtures: [], results: [] },
      discipline: {},
      registrations,
      readiness: { percentage: 100, checks: [] },
      today: "2026-07-14",
    });

    expect(command.roleFocus?.label).toBe("Registration secretary focus");
    expect(command.status).toBe("action_required");
    expect(command.counts).toEqual(expect.objectContaining({
      pendingRegistrations: 0,
      registrationCorrections: 1,
      pendingTransfers: 1,
      openEligibilityExceptions: 1,
      invalidTeamSheets: 1,
    }));
    expect(command.actions.slice(0, 2).map((row) => row.id)).toEqual([
      "registration-corrections",
      "registration-team-sheets",
    ]);
  });

  test("adds secure operator, club portal, role, team-sheet and Supabase contracts", () => {
    [
      "league_players",
      "league_player_registrations",
      "league_registration_documents",
      "league_transfer_requests",
      "league_eligibility_rules",
      "league_eligibility_dispensations",
      "league_team_sheets",
      "league_team_sheet_players",
      "can_view_league_registrations",
      "can_manage_league_registrations",
      "get_league_registration_data",
      "get_league_club_registration_data",
      "submit_league_player_registration",
      "review_league_player_registration",
      "submit_league_transfer_request",
      "review_league_transfer_request",
      "submit_league_eligibility_dispensation",
      "review_league_eligibility_dispensation",
      "save_league_team_sheet",
    ].forEach((contract) => expect(migration).toContain(contract));
    expect(migration).toContain("alter table public.league_players enable row level security");
    expect(migration).toContain("alter table public.league_player_registrations force row level security");
    expect(migration).toContain("'registrations'");

    expect(leaguePage).toContain('"registrations", "Registrations & eligibility"');
    expect(leaguePage).toContain('value="registrations"');
    expect(leaguePage).toContain("canViewRegistrations");
    expect(registrationWorkspace).toContain("Registrations and eligibility");
    expect(registrationWorkspace).toContain("Registration reporting pack");
    expect(registrationWorkspace).toContain("useUnsavedChangesGuard");
    expect(clubPortal).toContain('["registrations", "Registrations", UserRoundCheck]');
    expect(clubPanel).toContain("Submit team sheet");
    expect(clubPanel).toContain("Request dispensation");
    expect(commandCentre).toContain("getLeagueRegistrationData");
    expect(commandCentre).toContain("get_league_registration_data");

    [
      "getLeagueRegistrationData",
      "getLeagueClubRegistrationData",
      "submitLeaguePlayerRegistration",
      "reviewLeaguePlayerRegistration",
      "resubmitLeaguePlayerRegistration",
      "addLeagueRegistrationDocument",
      "submitLeagueTransferRequest",
      "reviewLeagueTransferRequest",
      "upsertLeagueEligibilityRule",
      "submitLeagueEligibilityDispensation",
      "reviewLeagueEligibilityDispensation",
      "saveLeagueTeamSheet",
    ].forEach((name) => expect(supabase).toContain(name));
  });
});
