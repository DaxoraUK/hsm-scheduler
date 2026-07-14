import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  isSecureLeagueDocumentUrl,
  leagueDisciplineCasesToCsv,
  leagueDisciplineScorecardsToCsv,
  normaliseLeagueDisciplineData,
} from "../../src/lib/league/leagueDisciplineEngine.js";
import { buildLeagueCommandCentre } from "../../src/lib/league/leagueCommandCentre.js";

const migration = readFileSync("supabase/migrations/202607140007_league_discipline_compliance_case_management.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const disciplineWorkspace = readFileSync("src/components/league/LeagueDisciplineWorkspace.jsx", "utf8");
const clubPortal = readFileSync("src/components/league/LeagueClubPortalPage.jsx", "utf8");
const clubPanel = readFileSync("src/components/league/LeagueClubDisciplinePanel.jsx", "utf8");
const commandCentre = readFileSync("src/components/league/LeagueCommandCentreWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function disciplinePayload() {
  return {
    access: { role: "discipline", can_manage: true, can_view: true },
    cases: [
      {
        id: "case-1",
        league_id: "league-1",
        case_reference: "DISC-2026-001",
        title: "Misconduct after fixture",
        status: "awaiting_club_response",
        priority: "high",
        respondent_club_id: "club-1",
        respondent_club_name: "Alpha FC",
        response_due_on: "2026-07-10",
        club_response_required: true,
      },
      {
        id: "case-2",
        league_id: "league-1",
        case_reference: "DISC-2026-002",
        title: "Eligibility review",
        status: "hearing_scheduled",
        priority: "normal",
        respondent_club_id: "club-2",
        respondent_club_name: "Bravo FC",
        hearing_on: "2026-07-20T19:00:00Z",
      },
    ],
    charges: [{ id: "charge-1", case_id: "case-1", title: "Improper conduct", status: "alleged" }],
    events: [{ id: "event-1", case_id: "case-1", title: "Case opened", created_at: "2026-07-09T10:00:00Z" }],
    sanctions: [
      {
        id: "sanction-1",
        case_id: "case-1",
        sanction_type: "fine",
        subject_type: "club",
        subject_id: "club-1",
        subject_label: "Alpha FC",
        status: "unpaid",
        amount_pence: 7500,
        payment_due_on: "2026-07-12",
      },
      {
        id: "sanction-2",
        case_id: "case-2",
        sanction_type: "points_deduction",
        subject_type: "team",
        subject_id: "team-2",
        subject_label: "Bravo First",
        status: "active",
        points_delta: -3,
      },
    ],
    appeals: [{ id: "appeal-1", case_id: "case-2", status: "submitted", grounds: "Procedural fairness" }],
    documents: [{ id: "document-1", case_id: "case-1", title: "Referee report", document_url: "https://example.test/report" }],
  };
}

describe("League Operations v3.6 discipline, compliance and case management", () => {
  test("normalises secure case records and produces actionable discipline reporting", () => {
    const data = normaliseLeagueDisciplineData(disciplinePayload());

    expect(data.access).toEqual(expect.objectContaining({ role: "discipline", canManage: true }));
    expect(data.cases[0]).toEqual(expect.objectContaining({ caseReference: "DISC-2026-001", respondentClubName: "Alpha FC" }));
    expect(data.summary).toEqual(expect.objectContaining({
      status: "action_required",
      openCases: 2,
      overdueResponses: 1,
      activeSanctions: 2,
      unpaidFines: 1,
      overdueFines: 1,
      openAppeals: 1,
      totalFinePence: 7500,
    }));
    expect(data.clubScorecards.find((row) => row.label === "Alpha FC")).toEqual(expect.objectContaining({
      openCases: 1,
      overdueResponses: 1,
      unpaidFines: 1,
      finePence: 7500,
    }));

    expect(leagueDisciplineCasesToCsv(data)).toContain("DISC-2026-001");
    expect(leagueDisciplineCasesToCsv(data)).toContain("75.00");
    expect(leagueDisciplineScorecardsToCsv(data)).toContain("Alpha FC,1,1,1,1,75.00");
    expect(isSecureLeagueDocumentUrl("https://files.example.test/evidence.pdf")).toBe(true);
    expect(isSecureLeagueDocumentUrl("javascript:alert(1)")).toBe(false);
  });

  test("places discipline deadlines and appeals into the role-focused command picture", () => {
    const discipline = normaliseLeagueDisciplineData(disciplinePayload());
    const command = buildLeagueCommandCentre({
      role: "discipline",
      workspace: { fixtures: [], divisions: [], teams: [], venues: [], cupTies: [] },
      operations: { requirements: [], assignments: [], postponements: [] },
      clubOperations: { publications: [], acknowledgements: [], changeRequests: [] },
      results: { submissions: [], publishedFixtures: [], results: [] },
      discipline,
      readiness: { percentage: 100, checks: [] },
      today: "2026-07-14",
    });

    expect(command.roleFocus?.label).toBe("Discipline officer focus");
    expect(command.status).toBe("action_required");
    expect(command.counts).toEqual(expect.objectContaining({
      openDisciplineCases: 2,
      overdueDisciplineResponses: 1,
      overdueDisciplineFines: 1,
      disciplineHearings: 1,
      disciplineAppeals: 1,
    }));
    expect(command.actions.slice(0, 3).map((row) => row.id)).toEqual([
      "discipline-overdue-responses",
      "discipline-overdue-fines",
      "discipline-hearings",
    ]);
  });

  test("adds the operator, club portal, role security, sanctions and reporting contracts", () => {
    expect(migration).toContain("league_discipline_cases");
    expect(migration).toContain("league_case_charges");
    expect(migration).toContain("league_case_events");
    expect(migration).toContain("league_case_documents");
    expect(migration).toContain("league_case_sanctions");
    expect(migration).toContain("league_case_appeals");
    expect(migration).toContain("can_view_league_discipline");
    expect(migration).toContain("can_manage_league_discipline");
    expect(migration).toContain("document_url ~* '^https?://'");
    expect(migration).toContain("get_league_discipline_data");
    expect(migration).toContain("get_league_club_discipline_data");
    expect(migration).toContain("submit_league_case_response");
    expect(migration).toContain("submit_league_case_appeal");
    expect(migration).toContain("review_league_case_appeal");
    expect(migration).toContain("league_table_adjustments");

    expect(leaguePage).toContain('"discipline", "Discipline & compliance"');
    expect(leaguePage).toContain('value="discipline"');
    expect(leaguePage).toContain("canViewDiscipline");
    expect(disciplineWorkspace).toContain("Discipline and compliance");
    expect(disciplineWorkspace).toContain("Club compliance scorecard");
    expect(disciplineWorkspace).toContain("useUnsavedChangesGuard");
    expect(clubPortal).toContain('["discipline", "Discipline", ShieldAlert]');
    expect(clubPanel).toContain("Submit appeal");
    expect(clubPanel).toContain("Acknowledge decision");
    expect(commandCentre).toContain("getLeagueDisciplineData");
    expect(commandCentre).toContain("PGRST202");

    [
      "getLeagueDisciplineData",
      "getLeagueClubDisciplineData",
      "upsertLeagueDisciplineCase",
      "updateLeagueDisciplineCaseStatus",
      "addLeagueCaseEvent",
      "upsertLeagueCaseCharge",
      "upsertLeagueCaseSanction",
      "addLeagueCaseDocument",
      "submitLeagueCaseResponse",
      "submitLeagueCaseAppeal",
      "reviewLeagueCaseAppeal",
    ].forEach((name) => expect(supabase).toContain(name));
  });
});
