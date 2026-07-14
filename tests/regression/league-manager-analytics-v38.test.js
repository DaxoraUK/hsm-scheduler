import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildLeagueAnalyticsModel,
  buildLeagueSnapshotTrend,
  leagueAnalyticsSnapshotPayload,
  leagueAnalyticsToCsv,
  leagueAnalyticsToHtml,
  leagueBoardPackHtml,
  normaliseLeagueReportConfiguration,
} from "../../src/lib/league/leagueAnalyticsEngine.js";

const migration = readFileSync("supabase/migrations/202607140009_league_analytics_reports.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const analyticsWorkspace = readFileSync("src/components/league/LeagueAnalyticsWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

function fixture(id, targetId, date, homeTeamId, awayTeamId) {
  return {
    id,
    publicationFixtureId: id,
    publicationId: "publication-1",
    targetType: "schedule_entry",
    targetId,
    seasonId: "season-1",
    divisionId: "division-1",
    competitionId: "division-1",
    competitionType: "league",
    homeTeamId,
    awayTeamId,
    meetingNumber: 1,
    scheduledDate: date,
    status: "scheduled",
  };
}

function analyticsInput() {
  const firstFixture = fixture("published-1", "schedule-1", "2026-07-10", "team-1", "team-2");
  const secondFixture = fixture("published-2", "schedule-2", "2026-07-20", "team-2", "team-1");
  return {
    workspace: {
      league: { id: "league-1", name: "Lancashire Test League" },
      access: { role: "owner", canManage: true },
      seasons: [{ id: "season-1", name: "2026/27", isCurrent: true }],
      divisions: [{ id: "division-1", seasonId: "season-1", name: "Premier Division", sortOrder: 1, winPoints: 3, drawPoints: 1, lossPoints: 0 }],
      clubs: [{ id: "club-1", name: "Alpha FC", status: "active" }, { id: "club-2", name: "Bravo FC", status: "active" }],
      teams: [
        { id: "team-1", name: "Alpha First", parentClubId: "club-1", divisionId: "division-1", seasonId: "season-1", status: "active" },
        { id: "team-2", name: "Bravo First", parentClubId: "club-2", divisionId: "division-1", seasonId: "season-1", status: "active" },
      ],
      venues: [{ id: "venue-1", name: "Alpha Ground", status: "active" }],
      cups: [],
    },
    operations: {
      officials: [{ id: "official-1", name: "Ref One", grade: "Level 5", status: "active" }],
      requirements: [{ id: "requirement-1", scopeType: "league", refereeCount: 1, assistantCount: 1, fourthOfficialCount: 0, observerCount: 0 }],
      assignments: [{ id: "assignment-1", targetType: "schedule_entry", targetId: "schedule-1", officialId: "official-1", role: "referee", status: "confirmed" }],
      postponements: [],
    },
    clubOperations: {
      acknowledgements: [
        { id: "ack-1", parentClubId: "club-1", status: "received" },
        { id: "ack-2", parentClubId: "club-2", status: "pending" },
      ],
      changeRequests: [{ id: "change-1", parentClubId: "club-2", status: "submitted" }],
      publications: [{ id: "publication-1" }],
    },
    results: {
      publishedFixtures: [firstFixture, secondFixture],
      results: [{ ...firstFixture, id: "result-1", outcomeType: "played", homeScore: 2, awayScore: 1, status: "verified" }],
      submissions: [],
      adjustments: [],
    },
    discipline: {
      access: { canView: true },
      summary: { openCases: 1, overdueResponses: 0, activeSanctions: 1, unpaidFines: 1, overdueFines: 0, totalFinePence: 2500 },
      clubScorecards: [{ id: "club-2", label: "Bravo FC", openCases: 1, overdueResponses: 0, activeSanctions: 1, unpaidFines: 1, finePence: 2500 }],
      cases: [{}],
    },
    registrations: {
      access: { canView: true },
      summary: { pendingRegistrations: 1, correctionRequired: 1, pendingTransfers: 0, invalidTeamSheets: 1 },
      registrations: [
        { id: "registration-1", parentClubId: "club-1", status: "approved" },
        { id: "registration-2", parentClubId: "club-2", status: "correction_required" },
      ],
      teamSheets: [{ id: "sheet-1", parentClubId: "club-2", validationStatus: "invalid" }],
    },
    reportConfiguration: {
      access: { role: "owner", can_manage: true },
      definitions: [],
      snapshots: [],
    },
    today: "2026-07-14",
  };
}

describe("League Operations v3.8 analytics and reports", () => {
  test("builds traceable executive, competition, club and official measures", () => {
    const model = buildLeagueAnalyticsModel(analyticsInput());

    expect(model.executive).toEqual(expect.objectContaining({
      fixtureTotal: 2,
      fixturesDue: 1,
      completedResults: 1,
      missingResults: 0,
      fixtureCompletionRate: 100,
      officialCoverageRate: 25,
      officialGaps: 3,
      acknowledgementRate: 50,
      openChangeRequests: 1,
      openDisciplineCases: 1,
      outstandingFinePence: 2500,
      approvedRegistrations: 1,
      pendingRegistrations: 1,
      invalidTeamSheets: 1,
    }));
    expect(model.competitionRows[0]).toEqual(expect.objectContaining({
      name: "Premier Division",
      teams: 2,
      fixtures: 2,
      completed: 1,
      completionRate: 100,
      averageGoals: 3,
      leader: "Alpha First",
    }));
    expect(model.clubRows.find((row) => row.id === "club-2")).toEqual(expect.objectContaining({
      acknowledgementRate: 0,
      openChanges: 1,
      registrationIssues: 1,
      invalidTeamSheets: 1,
      openDisciplineCases: 1,
      unpaidFines: 1,
    }));
    expect(model.officialRows[0]).toEqual(expect.objectContaining({ name: "Ref One", appointments: 1, confirmed: 1, confirmationRate: 100 }));
    expect(model.fundingEvidence.map((row) => row.metric)).toContain("Published fixtures");
  });

  test("creates governed exports, snapshots and trend rows", () => {
    const model = buildLeagueAnalyticsModel(analyticsInput());
    const clubCsv = leagueAnalyticsToCsv(model, "clubs");
    const evidenceCsv = leagueAnalyticsToCsv(model, "funding_evidence");
    const governanceCsv = leagueAnalyticsToCsv(model, "governance");
    const officialsHtml = leagueAnalyticsToHtml(model, "officials");
    const html = leagueBoardPackHtml(model);
    const snapshot = leagueAnalyticsSnapshotPayload(model, "executive");
    const configuration = normaliseLeagueReportConfiguration({
      access: { role: "owner", can_manage: true },
      definitions: [{ id: "definition-1", report_type: "executive", cadence: "monthly", recipients: ["chair@example.test"] }],
      snapshots: [{ id: "snapshot-1", report_type: "executive", created_at: "2026-07-01T10:00:00Z", snapshot: { executive: { fixtureCompletionRate: 75, officialCoverageRate: 80, acknowledgementRate: 70, missingResults: 4 } } }],
    });
    const trend = buildLeagueSnapshotTrend(configuration.snapshots, model);

    expect(clubCsv).toContain("Bravo FC");
    expect(clubCsv).toContain("Operational score");
    expect(evidenceCsv).toContain("Evidence source");
    expect(governanceCsv).toContain("Pending registrations");
    expect(officialsHtml).toContain("Lancashire Test League match officials report");
    expect(html).toContain("Lancashire Test League executive report");
    expect(html).toContain("Evidence note");
    expect(snapshot.executive.fixtureCompletionRate).toBe(100);
    expect(configuration.access.canManage).toBe(true);
    expect(configuration.definitions[0]).toEqual(expect.objectContaining({ reportType: "executive", cadence: "monthly" }));
    expect(trend).toHaveLength(2);
    expect(trend[0].fixtureCompletionRate).toBe(75);
    expect(trend[1].label).toBe("Now");
  });

  test("adds the reporting workspace, persistence, security and database contracts", () => {
    [
      "league_report_definitions",
      "league_report_snapshots",
      "get_league_report_configuration",
      "upsert_league_report_definition",
      "delete_league_report_definition",
      "capture_league_report_snapshot",
      "league_report_definitions_read",
      "league_report_snapshots_read",
      "public.can_manage_league",
      "public.can_view_league",
      "Report snapshot is too large",
      "league.report_snapshot_captured",
    ].forEach((contract) => expect(migration).toContain(contract));
    expect(migration).toContain("alter table public.league_report_definitions enable row level security");
    expect(migration).toContain("alter table public.league_report_snapshots enable row level security");

    expect(leaguePage).toContain('"analytics", "Analytics & reports"');
    expect(leaguePage).toContain("LeagueAnalyticsWorkspace");
    expect(analyticsWorkspace).toContain("Analytics and reports");
    expect(analyticsWorkspace).toContain("Club operational scorecards");
    expect(analyticsWorkspace).toContain("Funding evidence dataset");
    expect(analyticsWorkspace).toContain("Automatic email delivery requires a later delivery-worker integration");
    expect(analyticsWorkspace).toContain("usePersistedWorkspaceState");

    [
      "getLeagueReportConfiguration",
      "upsertLeagueReportDefinition",
      "deleteLeagueReportDefinition",
      "captureLeagueReportSnapshot",
    ].forEach((name) => expect(supabase).toContain(name));
  });
});
