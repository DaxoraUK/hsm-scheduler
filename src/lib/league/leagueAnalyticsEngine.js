import { neutraliseSpreadsheetFormula } from "../export/spreadsheetSafety.js";
import { getCurrentLeagueSeason } from "./leagueManagerModel.js";
import { getFixtureOfficialRequirement, getRequiredOfficialRoles } from "./leagueOperationsEngine.js";
import { buildLeagueStandings, buildMissingResultQueue, fixtureResultKey } from "./leagueResultsEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function isoDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Math.max(0, Math.min(100, Math.round((asNumber(numerator) / asNumber(denominator)) * 100)));
}

function average(values = []) {
  const rows = asArray(values).map(Number).filter(Number.isFinite);
  return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
}

function resultStatusIsOpen(status) {
  return ["submitted", "under_review", "pending"].includes(String(status || "").toLowerCase());
}

function acknowledgementComplete(status) {
  return ["received", "confirmed", "accepted", "acknowledged"].includes(String(status || "").toLowerCase());
}

function assignmentFilled(status) {
  return !["declined", "released", "cancelled", "withdrawn"].includes(String(status || "").toLowerCase());
}

function fixtureWithinFilters(fixture, filters = {}) {
  const seasonId = filters.seasonId || "";
  const divisionId = filters.divisionId || "";
  const from = isoDate(filters.dateFrom);
  const to = isoDate(filters.dateTo);
  const date = isoDate(fixture.scheduledDate || fixture.date);
  if (seasonId && fixture.seasonId && fixture.seasonId !== seasonId) return false;
  if (divisionId && (fixture.divisionId || fixture.competitionId) !== divisionId) return false;
  if (from && date && date < from) return false;
  if (to && date && date > to) return false;
  return true;
}

const REPORT_TYPE_LABELS = Object.freeze({
  executive: "Executive",
  competitions: "Competitions",
  clubs: "Club scorecards",
  officials: "Officials",
  governance: "Governance",
  funding_evidence: "Funding evidence",
});

function sortByName(rows = [], key = "name") {
  return [...asArray(rows)].sort((left, right) => String(left?.[key] || "").localeCompare(String(right?.[key] || "")));
}

export function normaliseLeagueReportConfiguration(payload = {}) {
  const normaliseDefinition = (row = {}) => ({
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    name: row.name || "Saved report",
    reportType: row.report_type || row.reportType || "executive",
    cadence: row.cadence || "manual",
    deliveryFormat: row.delivery_format || row.deliveryFormat || "html",
    recipients: asArray(row.recipients),
    distributionListId: row.distribution_list_id || row.distributionListId || "",
    filters: row.filters && typeof row.filters === "object" ? row.filters : {},
    nextRunOn: isoDate(row.next_run_on || row.nextRunOn),
    lastRunAt: row.last_run_at || row.lastRunAt || null,
    freshnessHours: Math.max(1, Math.min(168, asNumber(row.freshness_hours ?? row.freshnessHours, 24))),
    sendEmail: asBoolean(row.send_email ?? row.sendEmail ?? true),
    archiveRuns: asBoolean(row.archive_runs ?? row.archiveRuns ?? true),
    active: asBoolean(row.active ?? true),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  });
  const normaliseSnapshot = (row = {}) => ({
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    definitionId: row.definition_id || row.definitionId || "",
    reportType: row.report_type || row.reportType || "executive",
    generatedFrom: row.generated_from || row.generatedFrom || "manual",
    snapshot: row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {},
    createdAt: row.created_at || row.createdAt || null,
  });
  const normaliseDistributionList = (row = {}) => ({
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    name: row.name || "Distribution list",
    recipients: asArray(row.recipients),
    active: asBoolean(row.active ?? true),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  });
  const normaliseRun = (row = {}) => ({
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    definitionId: row.definition_id || row.definitionId || "",
    definitionName: row.definition_name || row.definitionName || "Report delivery",
    snapshotId: row.snapshot_id || row.snapshotId || "",
    reportType: row.report_type || row.reportType || "executive",
    deliveryFormat: row.delivery_format || row.deliveryFormat || "html",
    status: row.status || "queued",
    recipients: asArray(row.recipients),
    recipientCount: asNumber(row.recipient_count ?? row.recipientCount),
    requestedSource: row.requested_source || row.requestedSource || "manual",
    attemptCount: asNumber(row.attempt_count ?? row.attemptCount),
    queuedAt: row.queued_at || row.queuedAt || null,
    startedAt: row.started_at || row.startedAt || null,
    completedAt: row.completed_at || row.completedAt || null,
    nextAttemptAt: row.next_attempt_at || row.nextAttemptAt || null,
    provider: row.provider || "",
    providerReference: row.provider_reference || row.providerReference || "",
    errorCode: row.error_code || row.errorCode || "",
    errorMessage: row.error_message || row.errorMessage || "",
    artifactName: row.artifact_name || row.artifactName || "",
    snapshotCreatedAt: row.snapshot_created_at || row.snapshotCreatedAt || null,
    snapshot: row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {},
    createdAt: row.created_at || row.createdAt || row.queued_at || row.queuedAt || null,
  });
  return {
    access: {
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      role: payload.access?.role || "viewer",
    },
    definitions: asArray(payload.definitions).map(normaliseDefinition),
    snapshots: asArray(payload.snapshots).map(normaliseSnapshot),
    distributionLists: asArray(payload.distribution_lists || payload.distributionLists).map(normaliseDistributionList),
    runs: asArray(payload.runs).map(normaliseRun),
    delivery: {
      queued: asNumber(payload.delivery?.queued),
      processing: asNumber(payload.delivery?.processing),
      delivered: asNumber(payload.delivery?.delivered),
      failed: asNumber(payload.delivery?.failed),
      dueDefinitions: asNumber(payload.delivery?.due_definitions ?? payload.delivery?.dueDefinitions),
      automationReady: asBoolean(payload.delivery?.automation_ready ?? payload.delivery?.automationReady),
    },
  };
}

function buildFixtureMetrics({ fixtures, results, todayKey }) {
  const resultByKey = new Map(asArray(results).map((row) => [fixtureResultKey(row), row]));
  const due = fixtures.filter((fixture) => fixture.scheduledDate && fixture.scheduledDate <= todayKey && !["postponed", "cancelled", "void"].includes(String(fixture.status || "").toLowerCase()));
  const completed = fixtures.filter((fixture) => resultByKey.has(fixtureResultKey(fixture)));
  const completedDue = due.filter((fixture) => resultByKey.has(fixtureResultKey(fixture)));
  const upcoming = fixtures.filter((fixture) => fixture.scheduledDate && fixture.scheduledDate > todayKey);
  const missing = buildMissingResultQueue(fixtures, results, { today: todayKey });
  const postponed = fixtures.filter((fixture) => ["postponed", "cancelled"].includes(String(fixture.status || "").toLowerCase()));
  return {
    total: fixtures.length,
    due: due.length,
    completed: completed.length,
    completedDue: completedDue.length,
    upcoming: upcoming.length,
    missing: missing.length,
    postponed: postponed.length,
    completionRate: percentage(completedDue.length, due.length),
    seasonProgressRate: percentage(completed.length, fixtures.length),
    resultByKey,
    missingRows: missing,
  };
}

function buildOfficialMetrics({ fixtures, operations }) {
  const assignments = asArray(operations.assignments).filter((row) => assignmentFilled(row.status));
  const assignmentKeys = new Set(assignments.map((row) => `${row.targetType || "schedule_entry"}:${row.targetId}:${row.role}`));
  let requiredSlots = 0;
  let filledSlots = 0;
  const gaps = [];
  fixtures.forEach((fixture) => {
    const requirement = getFixtureOfficialRequirement(fixture, operations.requirements);
    const roles = getRequiredOfficialRoles(requirement);
    roles.forEach((role) => {
      requiredSlots += 1;
      const targetType = fixture.targetType || (fixture.competitionType === "cup" ? "cup_tie" : "schedule_entry");
      const targetId = fixture.targetId || fixture.id || fixture.publicationFixtureId;
      if (assignmentKeys.has(`${targetType}:${targetId}:${role}`)) filledSlots += 1;
      else gaps.push({ fixture, role });
    });
  });
  const confirmed = assignments.filter((row) => ["confirmed", "accepted"].includes(String(row.status || "").toLowerCase())).length;
  return {
    activeOfficials: asArray(operations.officials).filter((row) => row.status === "active").length,
    assignments: assignments.length,
    requiredSlots,
    filledSlots,
    gaps: gaps.length,
    coverageRate: percentage(filledSlots, requiredSlots),
    confirmationRate: percentage(confirmed, assignments.length),
    gapRows: gaps,
  };
}

function buildCompetitionRows({ workspace, fixtures, results, adjustments, todayKey }) {
  const standings = buildLeagueStandings({
    divisions: workspace.divisions,
    teams: workspace.teams,
    results,
    adjustments,
  });
  const standingByDivision = new Map(standings.map((row) => [row.division.id, row]));
  return asArray(workspace.divisions).map((division) => {
    const competitionFixtures = fixtures.filter((fixture) => (fixture.divisionId || fixture.competitionId) === division.id);
    const competitionResults = results.filter((result) => (result.divisionId || result.competitionId) === division.id && result.competitionType !== "cup");
    const metrics = buildFixtureMetrics({ fixtures: competitionFixtures, results: competitionResults, todayKey });
    const played = competitionResults.filter((row) => row.outcomeType === "played" && row.homeScore !== "" && row.awayScore !== "");
    const goals = played.map((row) => asNumber(row.homeScore) + asNumber(row.awayScore));
    const table = standingByDivision.get(division.id);
    return {
      id: division.id,
      name: division.name,
      sortOrder: asNumber(division.sortOrder),
      teams: asArray(workspace.teams).filter((team) => team.divisionId === division.id && !["inactive", "withdrawn"].includes(team.status)).length,
      fixtures: metrics.total,
      due: metrics.due,
      completed: metrics.completed,
      missing: metrics.missing,
      postponed: metrics.postponed,
      completionRate: metrics.completionRate,
      averageGoals: Number(average(goals).toFixed(2)),
      leader: table?.standings?.[0]?.teamName || "—",
      leaderPoints: table?.standings?.[0]?.points ?? "—",
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

function buildClubRows({ workspace, fixtures, results, clubOperations, discipline, registrations, todayKey }) {
  const disciplineByClub = new Map(asArray(discipline?.clubScorecards).map((row) => [row.id, row]));
  const resultByKey = new Map(asArray(results).map((row) => [fixtureResultKey(row), row]));
  return sortByName(workspace.clubs).filter((club) => club.status !== "withdrawn").map((club) => {
    const teamIds = new Set(asArray(workspace.teams).filter((team) => team.parentClubId === club.id).map((team) => team.id));
    const clubFixtures = fixtures.filter((fixture) => teamIds.has(fixture.homeTeamId) || teamIds.has(fixture.awayTeamId));
    const dueFixtures = clubFixtures.filter((fixture) => fixture.scheduledDate && fixture.scheduledDate <= todayKey && !["postponed", "cancelled", "void"].includes(String(fixture.status || "").toLowerCase()));
    const completedDue = dueFixtures.filter((fixture) => resultByKey.has(fixtureResultKey(fixture))).length;
    const acknowledgements = asArray(clubOperations.acknowledgements).filter((row) => row.parentClubId === club.id);
    const acknowledged = acknowledgements.filter((row) => acknowledgementComplete(row.status)).length;
    const openChanges = asArray(clubOperations.changeRequests).filter((row) => row.parentClubId === club.id && !["approved", "rejected", "withdrawn", "closed"].includes(String(row.status || "").toLowerCase())).length;
    const pendingResults = asArray(results).filter((row) => row.parentClubId === club.id && resultStatusIsOpen(row.status)).length;
    const clubRegistrations = asArray(registrations?.registrations).filter((row) => row.parentClubId === club.id);
    const registrationIssues = clubRegistrations.filter((row) => ["submitted", "under_review", "correction_required", "rejected"].includes(row.status)).length;
    const invalidSheets = asArray(registrations?.teamSheets).filter((row) => row.parentClubId === club.id && ["invalid", "blocked"].includes(row.validationStatus)).length;
    const disciplineScore = disciplineByClub.get(club.id) || { openCases: 0, overdueResponses: 0, activeSanctions: 0, unpaidFines: 0, finePence: 0 };
    const resultRate = percentage(completedDue, dueFixtures.length);
    const acknowledgementRate = percentage(acknowledged, acknowledgements.length);
    const registrationHealth = Math.max(0, 100 - (registrationIssues * 8) - (invalidSheets * 18));
    const disciplineHealth = Math.max(0, 100 - (disciplineScore.openCases * 8) - (disciplineScore.overdueResponses * 20) - (disciplineScore.unpaidFines * 12));
    const requestHealth = Math.max(0, 100 - (openChanges * 10));
    const operationalScore = Math.round((resultRate * 0.35) + ((acknowledgements.length ? acknowledgementRate : 100) * 0.2) + (registrationHealth * 0.2) + (disciplineHealth * 0.15) + (requestHealth * 0.1));
    return {
      id: club.id,
      name: club.name,
      teams: teamIds.size,
      fixtures: clubFixtures.length,
      dueFixtures: dueFixtures.length,
      completedResults: completedDue,
      resultCompletionRate: resultRate,
      acknowledgements: acknowledgements.length,
      acknowledgementRate: acknowledgements.length ? acknowledgementRate : 100,
      openChanges,
      pendingResults,
      registrationIssues,
      invalidTeamSheets: invalidSheets,
      openDisciplineCases: disciplineScore.openCases,
      overdueDisciplineResponses: disciplineScore.overdueResponses,
      unpaidFines: disciplineScore.unpaidFines,
      finePence: disciplineScore.finePence,
      operationalScore,
    };
  }).sort((left, right) => right.operationalScore - left.operationalScore || left.name.localeCompare(right.name));
}

function buildOfficialRows({ operations, fixtures }) {
  const officialById = new Map(asArray(operations.officials).map((row) => [row.id, row]));
  const fixtureIds = new Set(fixtures.flatMap((fixture) => [fixture.targetId, fixture.id, fixture.publicationFixtureId]).filter(Boolean));
  const rows = new Map();
  asArray(operations.assignments).filter((assignment) => fixtureIds.has(assignment.targetId) && assignmentFilled(assignment.status)).forEach((assignment) => {
    const official = officialById.get(assignment.officialId) || {};
    if (!rows.has(assignment.officialId)) rows.set(assignment.officialId, {
      id: assignment.officialId,
      name: official.name || official.displayName || official.email || "Official",
      grade: official.grade || "—",
      appointments: 0,
      confirmed: 0,
      declined: 0,
      referee: 0,
      assistant: 0,
    });
    const row = rows.get(assignment.officialId);
    row.appointments += 1;
    if (["confirmed", "accepted"].includes(String(assignment.status || "").toLowerCase())) row.confirmed += 1;
    if (String(assignment.status || "").toLowerCase() === "declined") row.declined += 1;
    if (assignment.role === "referee") row.referee += 1;
    if (String(assignment.role || "").startsWith("assistant")) row.assistant += 1;
  });
  return [...rows.values()].map((row) => ({ ...row, confirmationRate: percentage(row.confirmed, row.appointments) }))
    .sort((left, right) => right.appointments - left.appointments || left.name.localeCompare(right.name));
}

export function buildLeagueAnalyticsModel({
  workspace = {},
  operations = {},
  clubOperations = {},
  results = {},
  discipline = null,
  registrations = null,
  reportConfiguration = {},
  filters = {},
  today = new Date(),
} = {}) {
  const currentSeason = getCurrentLeagueSeason(workspace);
  const todayKey = isoDate(today instanceof Date ? today.toISOString() : today) || new Date().toISOString().slice(0, 10);
  const resolvedFilters = {
    seasonId: filters.seasonId || currentSeason?.id || "",
    divisionId: filters.divisionId || "",
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
  };
  const allPublishedFixtures = asArray(results.publishedFixtures);
  const fixtures = allPublishedFixtures.filter((fixture) => fixtureWithinFilters(fixture, resolvedFilters));
  const fixtureKeys = new Set(fixtures.map(fixtureResultKey));
  const verifiedResults = asArray(results.results).filter((row) => fixtureKeys.has(fixtureResultKey(row)));
  const submissions = asArray(results.submissions).filter((row) => fixtureKeys.has(fixtureResultKey(row)));
  const fixtureMetrics = buildFixtureMetrics({ fixtures, results: verifiedResults, todayKey });
  const officialMetrics = buildOfficialMetrics({ fixtures, operations });
  const acknowledgements = asArray(clubOperations.acknowledgements);
  const acknowledged = acknowledgements.filter((row) => acknowledgementComplete(row.status)).length;
  const openChanges = asArray(clubOperations.changeRequests).filter((row) => !["approved", "rejected", "withdrawn", "closed"].includes(String(row.status || "").toLowerCase()));
  const pendingSubmissions = submissions.filter((row) => resultStatusIsOpen(row.status));
  const disciplineSummary = discipline?.summary || null;
  const registrationSummary = registrations?.summary || null;
  const competitionRows = buildCompetitionRows({ workspace, fixtures, results: verifiedResults, adjustments: results.adjustments, todayKey });
  const clubRows = buildClubRows({ workspace, fixtures, results: [...verifiedResults, ...submissions], clubOperations, discipline, registrations, todayKey });
  const officialRows = buildOfficialRows({ operations, fixtures });
  const publicationCount = new Set(fixtures.map((row) => row.publicationId).filter(Boolean)).size;
  const playedResults = verifiedResults.filter((row) => row.outcomeType === "played");
  const averageGoalsPerGame = Number(average(playedResults.map((row) => asNumber(row.homeScore) + asNumber(row.awayScore))).toFixed(2));
  const governanceIssues = (disciplineSummary?.overdueResponses || 0)
    + (disciplineSummary?.overdueFines || 0)
    + (registrationSummary?.correctionRequired || 0)
    + (registrationSummary?.invalidTeamSheets || 0);
  const executiveStatus = fixtureMetrics.missing > 0 || officialMetrics.gaps > 0 || governanceIssues > 0
    ? "action_required"
    : openChanges.length || pendingSubmissions.length
      ? "needs_review"
      : "ready";

  return {
    generatedAt: new Date().toISOString(),
    today: todayKey,
    league: workspace.league || {},
    season: asArray(workspace.seasons).find((row) => row.id === resolvedFilters.seasonId) || currentSeason || null,
    filters: resolvedFilters,
    dataCoverage: {
      fixtures: true,
      results: true,
      officials: true,
      clubs: true,
      discipline: Boolean(discipline?.access?.canView || discipline?.cases),
      registrations: Boolean(registrations?.access?.canView || registrations?.registrations),
    },
    executive: {
      status: executiveStatus,
      publicationCount,
      fixtureTotal: fixtureMetrics.total,
      fixturesDue: fixtureMetrics.due,
      completedResults: fixtureMetrics.completed,
      missingResults: fixtureMetrics.missing,
      upcomingFixtures: fixtureMetrics.upcoming,
      postponedFixtures: fixtureMetrics.postponed,
      fixtureCompletionRate: fixtureMetrics.completionRate,
      seasonProgressRate: fixtureMetrics.seasonProgressRate,
      averageGoalsPerGame,
      pendingResultSubmissions: pendingSubmissions.length,
      acknowledgementRate: percentage(acknowledged, acknowledgements.length),
      pendingAcknowledgements: acknowledgements.length - acknowledged,
      openChangeRequests: openChanges.length,
      officialCoverageRate: officialMetrics.coverageRate,
      officialGaps: officialMetrics.gaps,
      openDisciplineCases: disciplineSummary?.openCases || 0,
      overdueDisciplineResponses: disciplineSummary?.overdueResponses || 0,
      outstandingFinePence: disciplineSummary?.totalFinePence || 0,
      approvedRegistrations: asArray(registrations?.registrations).filter((row) => row.status === "approved").length,
      pendingRegistrations: registrationSummary?.pendingRegistrations || 0,
      registrationCorrections: registrationSummary?.correctionRequired || 0,
      invalidTeamSheets: registrationSummary?.invalidTeamSheets || 0,
    },
    fixtureMetrics,
    officialMetrics,
    competitionRows,
    clubRows,
    officialRows,
    disciplineSummary,
    registrationSummary,
    reportConfiguration: normaliseLeagueReportConfiguration(reportConfiguration),
    fundingEvidence: buildLeagueFundingEvidence({
      workspace,
      executive: {
        fixtureTotal: fixtureMetrics.total,
        completedResults: fixtureMetrics.completed,
        fixtureCompletionRate: fixtureMetrics.completionRate,
        officialCoverageRate: officialMetrics.coverageRate,
        acknowledgementRate: percentage(acknowledged, acknowledgements.length),
        approvedRegistrations: asArray(registrations?.registrations).filter((row) => row.status === "approved").length,
        openDisciplineCases: disciplineSummary?.openCases || 0,
      },
      competitionRows,
      clubRows,
    }),
  };
}

export function buildLeagueFundingEvidence({ workspace = {}, executive = {}, competitionRows = [], clubRows = [] } = {}) {
  const activeTeams = asArray(workspace.teams).filter((row) => !["withdrawn", "inactive"].includes(row.status)).length;
  const activeClubs = asArray(workspace.clubs).filter((row) => row.status !== "withdrawn").length;
  const activeVenues = asArray(workspace.venues).filter((row) => row.status === "active").length;
  return [
    { id: "clubs", category: "Participation infrastructure", metric: "Active clubs", value: activeClubs, unit: "clubs", evidenceSource: "League structure", interpretation: "Number of participating parent clubs configured in the selected season." },
    { id: "teams", category: "Participation infrastructure", metric: "Active teams", value: activeTeams, unit: "teams", evidenceSource: "League structure", interpretation: "Number of active league teams supported by the competition." },
    { id: "venues", category: "Facilities", metric: "Active venues", value: activeVenues, unit: "venues", evidenceSource: "Venue register", interpretation: "Grounds currently used to deliver league activity." },
    { id: "fixtures", category: "Activity delivery", metric: "Published fixtures", value: executive.fixtureTotal || 0, unit: "fixtures", evidenceSource: "Published fixture register", interpretation: "Scheduled competitive activity within the selected reporting scope." },
    { id: "completed", category: "Activity delivery", metric: "Completed fixtures", value: executive.completedResults || 0, unit: "fixtures", evidenceSource: "Verified results", interpretation: "Fixtures with a verified outcome recorded by the league." },
    { id: "completion", category: "Operational resilience", metric: "Fixture completion rate", value: executive.fixtureCompletionRate || 0, unit: "%", evidenceSource: "Published fixtures and verified results", interpretation: "Percentage of due fixtures with a verified outcome." },
    { id: "officials", category: "Workforce", metric: "Official appointment coverage", value: executive.officialCoverageRate || 0, unit: "%", evidenceSource: "Official requirements and appointments", interpretation: "Percentage of required match-official roles currently filled." },
    { id: "acknowledgements", category: "Governance", metric: "Club acknowledgement rate", value: executive.acknowledgementRate || 0, unit: "%", evidenceSource: "Club portal acknowledgements", interpretation: "Percentage of issued fixture acknowledgements completed by clubs." },
    { id: "registrations", category: "Participation", metric: "Approved player registrations", value: executive.approvedRegistrations || 0, unit: "registrations", evidenceSource: "Player registration register", interpretation: "Approved player registrations in the secure league register." },
    { id: "division_delivery", category: "Competition reach", metric: "Divisions operating", value: asArray(competitionRows).filter((row) => row.teams > 0).length, unit: "divisions", evidenceSource: "Competition structure", interpretation: "Active competition levels represented in the reporting period." },
    { id: "club_coverage", category: "Club support", metric: "Clubs with operational score", value: asArray(clubRows).length, unit: "clubs", evidenceSource: "League operational scorecards", interpretation: "Clubs included in league benchmarking and support monitoring." },
    { id: "discipline", category: "Governance", metric: "Open discipline cases", value: executive.openDisciplineCases || 0, unit: "cases", evidenceSource: "Discipline case register", interpretation: "Open governance cases; context is required before using this metric externally." },
  ];
}

export function leagueAnalyticsSnapshotPayload(model = {}, reportType = "executive") {
  const base = {
    generatedAt: model.generatedAt || new Date().toISOString(),
    league: {
      id: model.league?.id || "",
      name: model.league?.name || "League",
    },
    season: {
      id: model.season?.id || "",
      name: model.season?.name || "Current season",
    },
    filters: model.filters || {},
    dataCoverage: model.dataCoverage || {},
    executive: model.executive || {},
  };
  if (reportType === "clubs") return { ...base, clubs: asArray(model.clubRows) };
  if (reportType === "competitions") return { ...base, competitions: model.competitionRows || [] };
  if (reportType === "officials") return { ...base, officials: model.officialMetrics || {}, officialRows: model.officialRows || [] };
  if (reportType === "governance") return { ...base, discipline: model.disciplineSummary || {}, registrations: model.registrationSummary || {} };
  if (reportType === "funding_evidence") return { ...base, evidence: model.fundingEvidence || [] };
  return {
    ...base,
    competitions: model.competitionRows || [],
    clubs: model.clubRows || [],
    officials: model.officialMetrics || {},
    discipline: model.disciplineSummary || {},
    registrations: model.registrationSummary || {},
    evidence: model.fundingEvidence || [],
  };
}

export function leagueAnalyticsModelFromSnapshot(snapshot = {}) {
  return {
    generatedAt: snapshot.generatedAt || new Date().toISOString(),
    league: snapshot.league && typeof snapshot.league === "object" ? snapshot.league : { id: "", name: "League" },
    season: snapshot.season && typeof snapshot.season === "object"
      ? snapshot.season
      : { id: snapshot.seasonId || "", name: snapshot.seasonName || "Current season" },
    filters: snapshot.filters && typeof snapshot.filters === "object" ? snapshot.filters : {},
    dataCoverage: snapshot.dataCoverage && typeof snapshot.dataCoverage === "object" ? snapshot.dataCoverage : {},
    executive: snapshot.executive && typeof snapshot.executive === "object" ? snapshot.executive : {},
    competitionRows: asArray(snapshot.competitions || snapshot.competitionRows),
    clubRows: asArray(snapshot.clubs || snapshot.clubRows),
    officialMetrics: snapshot.officials && typeof snapshot.officials === "object" ? snapshot.officials : {},
    officialRows: asArray(snapshot.officialRows),
    disciplineSummary: snapshot.discipline && typeof snapshot.discipline === "object" ? snapshot.discipline : {},
    registrationSummary: snapshot.registrations && typeof snapshot.registrations === "object" ? snapshot.registrations : {},
    fundingEvidence: asArray(snapshot.evidence || snapshot.fundingEvidence),
  };
}

export function leagueAnalyticsSnapshotAgeHours(snapshot = {}, reference = Date.now()) {
  const timestamp = new Date(snapshot.generatedAt || snapshot.createdAt || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Number(reference) - timestamp) / 3600000);
}

function csvCell(value) {
  const text = String(neutraliseSpreadsheetFormula(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRows(rows = []) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function leagueAnalyticsToCsv(model = {}, reportType = "executive") {
  if (reportType === "clubs") {
    return csvRows([
      ["Club", "Teams", "Due fixtures", "Completed results", "Result completion %", "Acknowledgement %", "Open change requests", "Registration issues", "Invalid team sheets", "Open discipline cases", "Unpaid fines", "Operational score"],
      ...asArray(model.clubRows).map((row) => [row.name, row.teams, row.dueFixtures, row.completedResults, row.resultCompletionRate, row.acknowledgementRate, row.openChanges, row.registrationIssues, row.invalidTeamSheets, row.openDisciplineCases, row.unpaidFines, row.operationalScore]),
    ]);
  }
  if (reportType === "competitions") {
    return csvRows([
      ["Competition", "Teams", "Fixtures", "Due", "Completed", "Missing results", "Postponed", "Completion %", "Average goals", "Leader", "Leader points"],
      ...asArray(model.competitionRows).map((row) => [row.name, row.teams, row.fixtures, row.due, row.completed, row.missing, row.postponed, row.completionRate, row.averageGoals, row.leader, row.leaderPoints]),
    ]);
  }
  if (reportType === "officials") {
    return csvRows([
      ["Official", "Grade", "Appointments", "Confirmed", "Confirmation %", "Referee", "Assistant"],
      ...asArray(model.officialRows).map((row) => [row.name, row.grade, row.appointments, row.confirmed, row.confirmationRate, row.referee, row.assistant]),
    ]);
  }
  if (reportType === "governance") {
    const discipline = model.disciplineSummary || {};
    const registrations = model.registrationSummary || {};
    return csvRows([
      ["Area", "Metric", "Value"],
      ["Discipline", "Open cases", discipline.openCases || 0],
      ["Discipline", "Overdue responses", discipline.overdueResponses || 0],
      ["Discipline", "Active sanctions", discipline.activeSanctions || 0],
      ["Discipline", "Unpaid fines", discipline.unpaidFines || 0],
      ["Discipline", "Outstanding fine value", ((discipline.totalFinePence || 0) / 100).toFixed(2)],
      ["Registrations", "Pending registrations", registrations.pendingRegistrations || 0],
      ["Registrations", "Corrections required", registrations.correctionRequired || 0],
      ["Registrations", "Pending transfers", registrations.pendingTransfers || 0],
      ["Registrations", "Invalid team sheets", registrations.invalidTeamSheets || 0],
    ]);
  }
  if (reportType === "funding_evidence") {
    return csvRows([
      ["Category", "Metric", "Value", "Unit", "Evidence source", "Interpretation"],
      ...asArray(model.fundingEvidence).map((row) => [row.category, row.metric, row.value, row.unit, row.evidenceSource, row.interpretation]),
    ]);
  }
  const executive = model.executive || {};
  return csvRows([
    ["Metric", "Value"],
    ["Season", model.season?.name || ""],
    ["Published fixtures", executive.fixtureTotal || 0],
    ["Fixtures due", executive.fixturesDue || 0],
    ["Completed results", executive.completedResults || 0],
    ["Missing results", executive.missingResults || 0],
    ["Fixture completion %", executive.fixtureCompletionRate || 0],
    ["Official coverage %", executive.officialCoverageRate || 0],
    ["Club acknowledgement %", executive.acknowledgementRate || 0],
    ["Open change requests", executive.openChangeRequests || 0],
    ["Open discipline cases", executive.openDisciplineCases || 0],
    ["Outstanding fines", ((executive.outstandingFinePence || 0) / 100).toFixed(2)],
    ["Approved registrations", executive.approvedRegistrations || 0],
    ["Pending registrations", executive.pendingRegistrations || 0],
    ["Invalid team sheets", executive.invalidTeamSheets || 0],
  ]);
}


function parseCsvRows(content = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < String(content).length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(cell); cell = ""; }
    else if (character === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows;
}

function spreadsheetXmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function spreadsheetCell(value, header = false) {
  const numeric = value !== "" && Number.isFinite(Number(value));
  const type = numeric ? "Number" : "String";
  return `<Cell${header ? ' ss:StyleID="Header"' : ""}><Data ss:Type="${type}">${spreadsheetXmlEscape(value)}</Data></Cell>`;
}

function worksheetXml(name, rows = []) {
  const safeName = String(name || "Report").replace(/[\\/:?*]/g, " ").replaceAll("[", " ").replaceAll("]", " ").slice(0, 31) || "Report";
  const body = asArray(rows).map((row, rowIndex) => `<Row>${asArray(row).map((value) => spreadsheetCell(value, rowIndex === 0)).join("")}</Row>`).join("");
  return `<Worksheet ss:Name="${spreadsheetXmlEscape(safeName)}"><Table>${body}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions></Worksheet>`;
}

export function leagueAnalyticsToExcelXml(model = {}, reportType = "executive") {
  const requested = reportType === "executive"
    ? [
        ["Executive", "executive"],
        ["Competitions", "competitions"],
        ["Club scorecards", "clubs"],
        ["Officials", "officials"],
        ["Governance", "governance"],
        ["Funding evidence", "funding_evidence"],
      ]
    : [[REPORT_TYPE_LABELS[reportType] || "Report", reportType]];
  const worksheets = requested.map(([label, type]) => worksheetXml(label, parseCsvRows(leagueAnalyticsToCsv(model, type)))).join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40"><DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>Daxora Ground Control</Author><Title>${spreadsheetXmlEscape(model.league?.name || "League")} analytics</Title><Created>${new Date(model.generatedAt || Date.now()).toISOString()}</Created></DocumentProperties><Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Borders/><Font ss:FontName="Aptos" ss:Size="10"/><Interior/><NumberFormat/><Protection/></Style><Style ss:ID="Header"><Alignment ss:Vertical="Center"/><Font ss:FontName="Aptos Display" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#07121F" ss:Pattern="Solid"/></Style></Styles>${worksheets}</Workbook>`;
}

export function leagueAnalyticsArtifact(model = {}, reportType = "executive", deliveryFormat = "html") {
  const format = ["html", "csv", "xls"].includes(deliveryFormat) ? deliveryFormat : "html";
  if (format === "csv") return { extension: "csv", contentType: "text/csv; charset=utf-8", content: leagueAnalyticsToCsv(model, reportType) };
  if (format === "xls") return { extension: "xls", contentType: "application/vnd.ms-excel", content: leagueAnalyticsToExcelXml(model, reportType) };
  return { extension: "html", contentType: "text/html; charset=utf-8", content: leagueAnalyticsToHtml(model, reportType) };
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function htmlMetric(label, value, detail = "") {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div>${detail ? `<div class="metric-detail">${escapeHtml(detail)}</div>` : ""}</div>`;
}


function htmlTable(headers = [], rows = []) {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.length
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${Math.max(1, headers.length)}">No records are available for the selected reporting scope.</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function reportDocument({ model, title, subtitle, content }) {
  const leagueName = model.league?.name || "League";
  const seasonName = model.season?.name || "Current season";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(leagueName)} ${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#0f172a;background:#fff}main{max-width:1100px;margin:0 auto;padding:42px}.header{border-bottom:4px solid #10b981;padding-bottom:24px;margin-bottom:26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#047857}h1{font-size:32px;margin:8px 0 4px}h2{font-size:20px;margin:30px 0 12px}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{border:1px solid #cbd5e1;border-radius:14px;padding:14px}.metric-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#64748b}.metric-value{font-size:25px;font-weight:900;margin-top:7px}.metric-detail{font-size:11px;color:#64748b;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em}th,td{padding:10px;border-bottom:1px solid #e2e8f0}.note{margin-top:28px;padding:14px;border:1px solid #fbbf24;background:#fffbeb;border-radius:12px;font-size:12px;line-height:1.5}@media print{main{padding:18px}.grid{grid-template-columns:repeat(4,1fr)}}
  </style></head><body><main><div class="header"><div class="eyebrow">Daxora League Operations</div><h1>${escapeHtml(leagueName)} ${escapeHtml(title)}</h1><div class="muted">${escapeHtml(seasonName)} · ${escapeHtml(subtitle)} · Generated ${escapeHtml(new Date(model.generatedAt || Date.now()).toLocaleString("en-GB"))}</div></div>${content}<div class="note"><strong>Evidence note:</strong> This report reflects records held in Daxora League Operations at the generated time. Funding, regulatory and governing-body submissions must be checked against source documents and current programme guidance before use.</div></main></body></html>`;
}

export function leagueAnalyticsToHtml(model = {}, reportType = "executive") {
  if (reportType === "executive") return leagueBoardPackHtml(model);
  if (reportType === "competitions") {
    return reportDocument({ model, title: "competition delivery report", subtitle: "Competition performance", content: `<h2>Competition delivery</h2>${htmlTable(["Competition", "Teams", "Fixtures", "Due", "Completed", "Missing", "Postponed", "Completion", "Leader"], asArray(model.competitionRows).map((row) => [row.name, row.teams, row.fixtures, row.due, row.completed, row.missing, row.postponed, `${row.completionRate}%`, row.leader]))}` });
  }
  if (reportType === "clubs") {
    return reportDocument({ model, title: "club scorecard report", subtitle: "Operational benchmarking", content: `<h2>Club scorecards</h2>${htmlTable(["Club", "Teams", "Results", "Acknowledgements", "Change requests", "Registration issues", "Open cases", "Score"], asArray(model.clubRows).map((row) => [row.name, row.teams, `${row.resultCompletionRate}%`, `${row.acknowledgementRate}%`, row.openChanges, row.registrationIssues, row.openDisciplineCases, row.operationalScore]))}` });
  }
  if (reportType === "officials") {
    const metrics = model.officialMetrics || {};
    const summary = `<div class="grid">${htmlMetric("Appointment coverage", `${metrics.coverageRate || 0}%`, `${metrics.filledSlots || 0}/${metrics.requiredSlots || 0} roles`)}${htmlMetric("Appointment gaps", metrics.gaps || 0)}${htmlMetric("Confirmation rate", `${metrics.confirmationRate || 0}%`)}${htmlMetric("Active officials", metrics.activeOfficials || 0)}</div>`;
    return reportDocument({ model, title: "match officials report", subtitle: "Coverage and workload", content: `${summary}<h2>Official workload</h2>${htmlTable(["Official", "Grade", "Appointments", "Confirmed", "Confirmation", "Referee", "Assistant"], asArray(model.officialRows).map((row) => [row.name, row.grade, row.appointments, row.confirmed, `${row.confirmationRate}%`, row.referee, row.assistant]))}` });
  }
  if (reportType === "governance") {
    const discipline = model.disciplineSummary || {};
    const registrations = model.registrationSummary || {};
    const content = `<h2>Discipline and compliance</h2>${htmlTable(["Metric", "Value"], [["Open cases", discipline.openCases || 0], ["Overdue responses", discipline.overdueResponses || 0], ["Active sanctions", discipline.activeSanctions || 0], ["Unpaid fines", discipline.unpaidFines || 0], ["Outstanding fine value", `£${((discipline.totalFinePence || 0) / 100).toFixed(2)}`]])}<h2>Registrations and eligibility</h2>${htmlTable(["Metric", "Value"], [["Pending registrations", registrations.pendingRegistrations || 0], ["Corrections required", registrations.correctionRequired || 0], ["Pending transfers", registrations.pendingTransfers || 0], ["Invalid team sheets", registrations.invalidTeamSheets || 0]])}`;
    return reportDocument({ model, title: "governance report", subtitle: "Discipline, compliance and registrations", content });
  }
  if (reportType === "funding_evidence") {
    return reportDocument({ model, title: "funding evidence dataset", subtitle: "Operational evidence register", content: `<h2>Evidence dataset</h2>${htmlTable(["Category", "Metric", "Value", "Unit", "Evidence source", "Interpretation"], asArray(model.fundingEvidence).map((row) => [row.category, row.metric, row.value, row.unit, row.evidenceSource, row.interpretation]))}` });
  }
  return leagueBoardPackHtml(model);
}

export function leagueBoardPackHtml(model = {}) {
  const executive = model.executive || {};
  const leagueName = model.league?.name || "League";
  const seasonName = model.season?.name || "Current season";
  const competitionRows = asArray(model.competitionRows).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.teams}</td><td>${row.fixtures}</td><td>${row.completed}</td><td>${row.missing}</td><td>${row.completionRate}%</td><td>${escapeHtml(row.leader)}</td></tr>`).join("");
  const clubRows = asArray(model.clubRows).slice().sort((left, right) => left.operationalScore - right.operationalScore).slice(0, 15).map((row) => `<tr><td>${escapeHtml(row.name)}</td><td>${row.resultCompletionRate}%</td><td>${row.acknowledgementRate}%</td><td>${row.registrationIssues}</td><td>${row.openDisciplineCases}</td><td>${row.operationalScore}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(leagueName)} board report</title><style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;color:#0f172a;background:#fff}main{max-width:1100px;margin:0 auto;padding:42px}.header{border-bottom:4px solid #10b981;padding-bottom:24px;margin-bottom:26px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#047857}h1{font-size:32px;margin:8px 0 4px}h2{font-size:20px;margin:30px 0 12px}.muted{color:#64748b;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{border:1px solid #cbd5e1;border-radius:14px;padding:14px}.metric-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#64748b}.metric-value{font-size:25px;font-weight:900;margin-top:7px}.metric-detail{font-size:11px;color:#64748b;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em}th,td{padding:10px;border-bottom:1px solid #e2e8f0}.note{margin-top:28px;padding:14px;border:1px solid #fbbf24;background:#fffbeb;border-radius:12px;font-size:12px;line-height:1.5}@media print{main{padding:18px}.grid{grid-template-columns:repeat(4,1fr)}.no-print{display:none}}
  </style></head><body><main><div class="header"><div class="eyebrow">Daxora League Operations</div><h1>${escapeHtml(leagueName)} executive report</h1><div class="muted">${escapeHtml(seasonName)} · Generated ${escapeHtml(new Date(model.generatedAt || Date.now()).toLocaleString("en-GB"))}</div></div><div class="grid">${htmlMetric("Fixture completion", `${executive.fixtureCompletionRate || 0}%`, `${executive.completedResults || 0} verified`)}${htmlMetric("Missing results", executive.missingResults || 0, `${executive.fixturesDue || 0} fixtures due`)}${htmlMetric("Official coverage", `${executive.officialCoverageRate || 0}%`, `${executive.officialGaps || 0} gaps`)}${htmlMetric("Club acknowledgement", `${executive.acknowledgementRate || 0}%`, `${executive.pendingAcknowledgements || 0} pending`)}${htmlMetric("Open discipline", executive.openDisciplineCases || 0, `${executive.overdueDisciplineResponses || 0} overdue responses`)}${htmlMetric("Outstanding fines", `£${((executive.outstandingFinePence || 0) / 100).toFixed(2)}`)}${htmlMetric("Approved registrations", executive.approvedRegistrations || 0, `${executive.pendingRegistrations || 0} pending`)}${htmlMetric("Invalid team sheets", executive.invalidTeamSheets || 0)}</div><h2>Competition delivery</h2><table><thead><tr><th>Competition</th><th>Teams</th><th>Fixtures</th><th>Completed</th><th>Missing</th><th>Completion</th><th>Leader</th></tr></thead><tbody>${competitionRows || '<tr><td colspan="7">No competition data available.</td></tr>'}</tbody></table><h2>Clubs requiring attention</h2><table><thead><tr><th>Club</th><th>Results</th><th>Acknowledgements</th><th>Registration issues</th><th>Open cases</th><th>Score</th></tr></thead><tbody>${clubRows || '<tr><td colspan="6">No club data available.</td></tr>'}</tbody></table><div class="note"><strong>Evidence note:</strong> This report reflects records held in Daxora League Operations at the generated time. Funding, regulatory and governing-body submissions must be checked against source documents and current programme guidance before use.</div></main></body></html>`;
}

export function buildLeagueSnapshotTrend(snapshots = [], currentModel = null) {
  const rows = asArray(snapshots).filter((row) => row.reportType === "executive" && row.snapshot?.executive).map((row) => ({
    id: row.id,
    capturedAt: row.createdAt,
    label: row.createdAt ? new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Snapshot",
    fixtureCompletionRate: asNumber(row.snapshot.executive.fixtureCompletionRate),
    officialCoverageRate: asNumber(row.snapshot.executive.officialCoverageRate),
    acknowledgementRate: asNumber(row.snapshot.executive.acknowledgementRate),
    missingResults: asNumber(row.snapshot.executive.missingResults),
  }));
  if (currentModel?.executive) rows.push({
    id: "current",
    capturedAt: currentModel.generatedAt,
    label: "Now",
    fixtureCompletionRate: asNumber(currentModel.executive.fixtureCompletionRate),
    officialCoverageRate: asNumber(currentModel.executive.officialCoverageRate),
    acknowledgementRate: asNumber(currentModel.executive.acknowledgementRate),
    missingResults: asNumber(currentModel.executive.missingResults),
  });
  return rows.sort((left, right) => String(left.capturedAt || "").localeCompare(String(right.capturedAt || ""))).slice(-12);
}
