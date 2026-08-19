import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  leagueAnalyticsModelFromSnapshot,
  leagueAnalyticsSnapshotAgeHours,
  leagueAnalyticsSnapshotPayload,
  leagueAnalyticsToExcelXml,
  normaliseLeagueReportConfiguration,
} from "../../src/lib/league/leagueAnalyticsEngine.js";

const migration = readFileSync("supabase/migrations/202607140010_daxora_reporting_delivery_notifications.sql", "utf8");
const analyticsWorkspace = readFileSync("src/components/league/LeagueAnalyticsWorkspace.jsx", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const supabaseSource = readFileSync("src/lib/supabase.js", "utf8");
const notificationBell = readFileSync("src/components/system/DaxoraNotificationBell.jsx", "utf8");
const notificationPreferences = readFileSync("src/components/system/DaxoraNotificationPreferences.jsx", "utf8");
const notificationLibrary = readFileSync("src/lib/notifications/daxoraNotifications.js", "utf8");
const browserPush = readFileSync("src/lib/notifications/browserPush.js", "utf8");
const serviceWorker = readFileSync("public/daxora-sw.js", "utf8");
const dailyAutomation = readFileSync("api/automation/daily.js", "utf8");
const reportDeliveryApi = readFileSync("api/league/report-delivery.js", "utf8");
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

function analyticsModel() {
  return {
    generatedAt: "2026-07-14T18:00:00.000Z",
    league: { id: "league-1", name: "Daxora Test League" },
    season: { id: "season-1", name: "2026/27" },
    filters: { seasonId: "season-1" },
    dataCoverage: { fixtures: true, results: true, officials: true, clubs: true, discipline: true, registrations: true },
    executive: { fixtureCompletionRate: 92, completedResults: 120, fixturesDue: 130, missingResults: 10, officialCoverageRate: 88, acknowledgementRate: 94 },
    competitionRows: [{ id: "division-1", name: "Premier Division", teams: 14, fixtures: 182, due: 130, completed: 120, missing: 10, postponed: 4, completionRate: 92, averageGoals: 3.1, leader: "Alpha FC", leaderPoints: 48 }],
    clubRows: [{ id: "club-1", name: "Alpha FC", teams: 2, operationalScore: 91, resultCompletionRate: 100, acknowledgementRate: 100, openChanges: 0, registrationIssues: 0, invalidTeamSheets: 0, openDisciplineCases: 0, unpaidFines: 0, finePence: 0 }],
    officialMetrics: { activeOfficials: 31, coverageRate: 88, filledSlots: 220, requiredSlots: 250, gaps: 30, confirmationRate: 96, assignments: 220 },
    officialRows: [{ id: "official-1", name: "Referee One", grade: "Level 5", appointments: 8, confirmed: 8, confirmationRate: 100, referee: 6, assistant: 2 }],
    disciplineSummary: { openCases: 2, overdueResponses: 0, activeSanctions: 1, unpaidFines: 1, overdueFines: 0, totalFinePence: 2500 },
    registrationSummary: { approvedRegistrations: 380, pendingRegistrations: 4, correctionRequired: 1, pendingTransfers: 2, invalidTeamSheets: 0 },
    fundingEvidence: [{ id: "fixtures", category: "Participation", metric: "Published fixtures", value: 182, unit: "fixtures", evidenceSource: "Fixture register", interpretation: "League delivery activity." }],
  };
}

describe("Daxora v3.8.2 analytics delivery and reporting automation", () => {
  test("creates a multi-sheet Excel workbook and reconstructs governed snapshots", () => {
    const model = analyticsModel();
    const snapshot = leagueAnalyticsSnapshotPayload(model, "executive");
    const restored = leagueAnalyticsModelFromSnapshot(snapshot);
    const workbook = leagueAnalyticsToExcelXml(restored, "executive");

    expect(restored.league.name).toBe("Daxora Test League");
    expect(restored.competitionRows[0].name).toBe("Premier Division");
    expect(workbook).toContain('<?mso-application progid="Excel.Sheet"?>');
    ["Executive", "Competitions", "Club scorecards", "Officials", "Governance", "Funding evidence"].forEach((sheet) => {
      expect(workbook).toContain(`ss:Name="${sheet}"`);
    });
    expect(leagueAnalyticsSnapshotAgeHours({ generatedAt: "2026-07-14T12:00:00.000Z" }, new Date("2026-07-14T18:00:00.000Z").getTime())).toBe(6);
  });

  test("normalises distribution lists, delivery runs and schedule controls", () => {
    const configuration = normaliseLeagueReportConfiguration({
      access: { role: "owner", can_manage: true },
      definitions: [{ id: "definition-1", name: "Board pack", delivery_format: "xls", distribution_list_id: "list-1", freshness_hours: 12, send_email: true, archive_runs: true }],
      distribution_lists: [{ id: "list-1", name: "Board", recipients: ["chair@example.test"] }],
      runs: [{ id: "run-1", definition_name: "Board pack", report_type: "executive", delivery_format: "xls", status: "failed", recipient_count: 1, error_code: "EMAIL_PROVIDER_NOT_CONFIGURED" }],
      delivery: { queued: 1, processing: 0, delivered: 3, failed: 1, due_definitions: 1, automation_ready: true },
    });

    expect(configuration.access.canManage).toBe(true);
    expect(configuration.definitions[0]).toEqual(expect.objectContaining({ deliveryFormat: "xls", distributionListId: "list-1", freshnessHours: 12, sendEmail: true, archiveRuns: true }));
    expect(configuration.distributionLists[0]).toEqual(expect.objectContaining({ name: "Board", recipients: ["chair@example.test"] }));
    expect(configuration.runs[0]).toEqual(expect.objectContaining({ status: "failed", definitionName: "Board pack", recipientCount: 1 }));
    expect(configuration.delivery).toEqual(expect.objectContaining({ queued: 1, delivered: 3, failed: 1, dueDefinitions: 1, automationReady: true }));
  });

  test("adds secure report queues, archives, distribution lists and notification preferences", () => {
    [
      "daxora_notification_preferences",
      "daxora_notifications",
      "daxora_push_subscriptions",
      "league_report_distribution_lists",
      "league_report_delivery_runs",
      "get_daxora_notification_centre",
      "update_daxora_notification_preferences",
      "queue_league_report_delivery",
      "retry_league_report_delivery",
      "enqueue_due_league_report_deliveries",
      "claim_due_league_report_deliveries",
      "complete_league_report_delivery",
      "REPORT_SNAPSHOT_MISSING",
      "public.can_manage_league",
      "private.is_service_role",
      "enable row level security",
    ].forEach((contract) => expect(migration).toContain(contract));

    [
      "upsertLeagueReportDistributionList",
      "deleteLeagueReportDistributionList",
      "queueLeagueReportDelivery",
      "retryLeagueReportDelivery",
      "getDaxoraNotificationCentre",
      "updateDaxoraNotificationPreferences",
      "registerDaxoraPushSubscription",
    ].forEach((name) => expect(supabaseSource).toContain(name));
  });

  test("wires scheduled delivery, archives, PDF/Excel exports and performance code splitting", () => {
    expect(analyticsWorkspace).toContain("Automated reporting schedule");
    expect(analyticsWorkspace).toContain("Distribution lists");
    expect(analyticsWorkspace).toContain("Delivery queue and archive");
    expect(analyticsWorkspace).toContain("Print or save board pack as PDF");
    expect(analyticsWorkspace).toContain("Download complete Excel workbook");
    expect(analyticsWorkspace).toContain("deliverLeagueReportRun");
    expect(analyticsWorkspace).not.toContain("Automatic email delivery requires a later delivery-worker integration");
    expect(leaguePage).toContain('lazy(() => import("../components/league/LeagueAnalyticsWorkspace.jsx"))');
    expect(leaguePage).toContain("<Suspense");
    expect(reportDeliveryApi).toContain("claim_league_report_delivery");
    expect(dailyAutomation).toContain("enqueue_due_league_report_deliveries");
    expect(dailyAutomation).toContain("claim_daxora_notification_digests");
    expect(vercel.crons).toEqual(expect.arrayContaining([expect.objectContaining({ path: "/api/automation/daily", schedule: "15 7 * * *" })]));
  });

  test("supports server-backed activity, user preferences and installed-app push", () => {
    expect(notificationLibrary).toContain("configureDaxoraNotificationRemoteAdapter");
    expect(notificationLibrary).toContain("mergeDaxoraNotifications");
    expect(notificationBell).toContain("DaxoraNotificationPreferences");
    expect(notificationBell).toContain("if (!preferences.inAppEnabled) return []");
    expect(notificationBell).toContain("preferences.categories?.[item.category] !== false");
    expect(notificationBell).toContain("navigator.setAppBadge");
    expect(notificationPreferences).toContain("Quiet hours");
    expect(notificationPreferences).toContain("Daily digest");
    expect(browserPush).toContain("VITE_DAXORA_VAPID_PUBLIC_KEY");
    expect(browserPush).toContain("pushManager.subscribe");
    expect(serviceWorker).toContain("self.addEventListener(\"push\"");
    expect(serviceWorker).toContain("Daxora Ground Control");
  });
});
