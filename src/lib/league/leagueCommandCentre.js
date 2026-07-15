import {
  buildLeagueOperationalFixtures,
  getLeagueOfficialCoverage,
} from "./leagueOperationsEngine.js";
import { buildMissingResultQueue } from "./leagueResultsEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isoDate(value) {
  if (typeof value === "string") return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function activePublication(publications = []) {
  return asArray(publications).find((row) => row.status === "published") || null;
}

function action({ id, title, detail, count = 0, severity = "info", tab, child = "", empty = false }) {
  return { id, title, detail, count, severity, tab, child, empty };
}

export function buildLeagueCommandCentre({
  workspace = {},
  operations = {},
  clubOperations = {},
  results = {},
  discipline = {},
  registrations = {},
  finance = {},
  scheduleVersion = null,
  readiness = { checks: [], percentage: 0 },
  role = "viewer",
  today = new Date(),
  officialHorizonDays = 35,
} = {}) {
  const todayKey = isoDate(today);
  const horizonKey = addDays(todayKey, officialHorizonDays);
  const openChangeRequests = asArray(clubOperations.changeRequests).filter((row) => ["submitted", "under_review"].includes(row.status));
  const pendingAcknowledgements = asArray(clubOperations.acknowledgements).filter((row) => row.status === "awaiting");
  const pendingResults = asArray(results.submissions).filter((row) => row.status === "submitted");
  const missingResults = buildMissingResultQueue(results.publishedFixtures, results.results, { today: todayKey });
  const disciplineSummary = discipline.summary || {};
  const openDisciplineCases = Number(disciplineSummary.openCases || 0);
  const overdueDisciplineResponses = Number(disciplineSummary.overdueResponses || 0);
  const overdueDisciplineFines = Number(disciplineSummary.overdueFines || 0);
  const disciplineHearings = Number(disciplineSummary.hearingsDue || 0);
  const disciplineAppeals = Number(disciplineSummary.openAppeals || 0);
  const registrationSummary = registrations.summary || {};
  const pendingRegistrations = Number(registrationSummary.pendingRegistrations || 0);
  const registrationCorrections = Number(registrationSummary.correctionRequired || 0);
  const pendingTransfers = Number(registrationSummary.pendingTransfers || 0);
  const openEligibilityExceptions = Number(registrationSummary.openDispensations || 0);
  const invalidTeamSheets = Number(registrationSummary.invalidTeamSheets || 0);
  const financeSummary = finance.summary || {};
  const overdueInvoices = Number(financeSummary.overdueInvoices || 0);
  const outstandingPence = Number(financeSummary.outstandingPence || 0);
  const unbilledFines = Number(financeSummary.unbilledFines || 0);
  const unpaidExpenses = Number(financeSummary.unpaidExpenses || 0);
  const openPostponements = asArray(operations.postponements).filter((row) => !["closed", "rearranged", "rejected"].includes(row.status));
  const overduePostponements = openPostponements.filter((row) => row.deadlineOn && row.deadlineOn < todayKey);
  const replacementAssignments = asArray(operations.assignments).filter((row) => ["declined", "replacement_required"].includes(row.status));
  const scheduleEntries = asArray(scheduleVersion?.entries);
  const unplacedFixtures = (scheduleEntries.length ? scheduleEntries : asArray(workspace.fixtures))
    .filter((row) => !row.scheduledDate || row.placementStatus === "unplaced");
  const incompleteSetup = asArray(readiness.checks).filter((row) => !row.complete && !row.optionalForSetup);
  const publication = activePublication(clubOperations.publications);

  const operationalFixtures = buildLeagueOperationalFixtures(workspace, scheduleVersion)
    .filter((fixture) => fixture.date && fixture.date >= todayKey && fixture.date <= horizonKey)
    .filter((fixture) => !["cancelled", "void", "bye"].includes(String(fixture.status || "").toLowerCase()));
  const officialCoverage = getLeagueOfficialCoverage(
    operationalFixtures,
    operations.requirements,
    operations.assignments,
  );

  const actions = [
    action({
      id: "finance-overdue-invoices",
      title: "Overdue club balances",
      detail: "Issued club invoices have passed their due date and require collection action.",
      count: overdueInvoices,
      severity: "critical",
      tab: "finance",
      child: "invoices",
    }),
    action({
      id: "finance-unbilled-fines",
      title: "Discipline fines awaiting invoice",
      detail: "Active financial sanctions have not yet been converted into club invoices.",
      count: unbilledFines,
      severity: "attention",
      tab: "finance",
      child: "command",
    }),
    action({
      id: "finance-unpaid-expenses",
      title: "Approved expenses awaiting payment",
      detail: "League or official expenses are approved but do not yet have a payment record.",
      count: unpaidExpenses,
      severity: "attention",
      tab: "finance",
      child: "expenses",
    }),
    action({
      id: "overdue-postponements",
      title: "Overdue rearrangements",
      detail: "Postponements have passed their league deadline and need a decision.",
      count: overduePostponements.length,
      severity: "critical",
      tab: "officials",
      child: "postponements",
    }),
    action({
      id: "discipline-overdue-responses",
      title: "Overdue discipline responses",
      detail: "Club response deadlines have passed and need league intervention.",
      count: overdueDisciplineResponses,
      severity: "critical",
      tab: "discipline",
      child: "cases",
    }),
    action({
      id: "discipline-overdue-fines",
      title: "Overdue discipline fines",
      detail: "Active financial sanctions have passed their payment deadline.",
      count: overdueDisciplineFines,
      severity: "critical",
      tab: "discipline",
      child: "sanctions",
    }),
    action({
      id: "discipline-hearings",
      title: "Discipline hearings scheduled",
      detail: "Open cases have hearings or appeal activity requiring committee preparation.",
      count: disciplineHearings + disciplineAppeals,
      severity: "attention",
      tab: "discipline",
      child: "hearings",
    }),
    action({
      id: "registration-corrections",
      title: "Registrations requiring correction",
      detail: "Club applications need clear feedback and resubmission before approval.",
      count: registrationCorrections,
      severity: "critical",
      tab: "registrations",
      child: "applications",
    }),
    action({
      id: "registration-review",
      title: "Registrations awaiting review",
      detail: "Submitted player applications require a league decision.",
      count: pendingRegistrations,
      severity: "attention",
      tab: "registrations",
      child: "applications",
    }),
    action({
      id: "registration-transfers",
      title: "Transfers awaiting clearance",
      detail: "Pending transfer decisions may block player eligibility.",
      count: pendingTransfers,
      severity: "attention",
      tab: "registrations",
      child: "transfers",
    }),
    action({
      id: "registration-team-sheets",
      title: "Team sheets failing eligibility",
      detail: "Submitted matchday selections contain one or more ineligible players.",
      count: invalidTeamSheets,
      severity: "critical",
      tab: "registrations",
      child: "matchday",
    }),
    action({
      id: "registration-exceptions",
      title: "Eligibility exceptions awaiting decision",
      detail: "Dispensation requests require a recorded league decision.",
      count: openEligibilityExceptions,
      severity: "attention",
      tab: "registrations",
      child: "eligibility",
    }),
    action({
      id: "result-verification",
      title: "Results awaiting verification",
      detail: "Club submissions do not affect tables until the league verifies them.",
      count: pendingResults.length,
      severity: "critical",
      tab: "results",
      child: "command",
    }),
    action({
      id: "missing-results",
      title: "Played fixtures without a result",
      detail: "Published fixtures have passed their date but remain outside the official result register.",
      count: missingResults.length,
      severity: "attention",
      tab: "results",
      child: "command",
    }),
    action({
      id: "club-change-requests",
      title: "Club change requests",
      detail: "Date, kick-off or venue requests are waiting for league review.",
      count: openChangeRequests.length,
      severity: "attention",
      tab: "clubs",
      child: "requests",
    }),
    action({
      id: "official-replacements",
      title: "Officials needing replacement",
      detail: "Declined or replacement-required appointments need reassignment.",
      count: replacementAssignments.length,
      severity: "critical",
      tab: "officials",
      child: "appointments",
    }),
    action({
      id: "official-gaps",
      title: `Official gaps in the next ${officialHorizonDays} days`,
      detail: "Upcoming appointments are measured against each competition's referee and assistant requirements.",
      count: officialCoverage.missing.length,
      severity: "attention",
      tab: "officials",
      child: "appointments",
    }),
    action({
      id: "fixture-acknowledgements",
      title: "Clubs yet to acknowledge fixtures",
      detail: "The active publication still has clubs waiting to confirm receipt.",
      count: pendingAcknowledgements.length,
      severity: "attention",
      tab: "clubs",
      child: "publication",
    }),
    action({
      id: "unplaced-fixtures",
      title: "Fixtures without a confirmed date",
      detail: "Unplaced fixtures cannot be published or appointed safely.",
      count: unplacedFixtures.length,
      severity: "attention",
      tab: "schedule",
    }),
    action({
      id: "setup-gaps",
      title: "League setup gaps",
      detail: "Mandatory configuration checks are still incomplete.",
      count: incompleteSetup.length,
      severity: "info",
      tab: "structure",
    }),
    action({
      id: "publication-gap",
      title: "No active club publication",
      detail: "A schedule exists, but clubs do not yet have an active fixture release.",
      count: !publication && asArray(scheduleVersion?.entries).length ? 1 : 0,
      severity: "attention",
      tab: "clubs",
      child: "publication",
    }),
  ].filter((row) => row.count > 0);

  const severityOrder = { critical: 0, attention: 1, info: 2 };
  const rolePriorities = {
    fixtures: ["overdue-postponements", "club-change-requests", "unplaced-fixtures", "publication-gap", "fixture-acknowledgements"],
    officials: ["official-replacements", "official-gaps", "overdue-postponements"],
    results: ["result-verification", "missing-results"],
    discipline: ["discipline-overdue-responses", "discipline-overdue-fines", "discipline-hearings"],
    registrations: ["registration-corrections", "registration-team-sheets", "registration-review", "registration-transfers", "registration-exceptions"],
    finance: ["finance-overdue-invoices", "finance-unbilled-fines", "finance-unpaid-expenses"],
  };
  const roleLabels = {
    fixtures: { label: "Fixture secretary focus", detail: "Fixture exceptions, rearrangements, unplaced matches and club requests are prioritised for your role." },
    officials: { label: "Officials secretary focus", detail: "Replacement appointments, coverage gaps and postponement actions are prioritised for your role." },
    results: { label: "Results secretary focus", detail: "Verification and missing-result queues are prioritised for your role." },
    discipline: { label: "Discipline officer focus", detail: "Overdue responses, unpaid fines, hearings and appeals are prioritised for your role." },
    registrations: { label: "Registration secretary focus", detail: "Application corrections, eligibility failures, transfers and dispensations are prioritised for your role." },
    finance: { label: "Finance officer focus", detail: "Overdue balances, unbilled fines and approved expenses are prioritised for your role." },
  };
  const focusedIds = rolePriorities[role] || [];
  const focusIndex = (id) => {
    const index = focusedIds.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  actions.sort((left, right) => (
    severityOrder[left.severity] - severityOrder[right.severity]
    || focusIndex(left.id) - focusIndex(right.id)
    || right.count - left.count
  ));

  const criticalCount = actions.filter((row) => row.severity === "critical").reduce((sum, row) => sum + row.count, 0);
  const attentionCount = actions.filter((row) => row.severity === "attention").reduce((sum, row) => sum + row.count, 0);
  const status = criticalCount > 0 ? "action_required" : attentionCount > 0 ? "needs_review" : "ready";

  return {
    status,
    actions,
    counts: {
      critical: criticalCount,
      attention: attentionCount,
      openActions: actions.reduce((sum, row) => sum + row.count, 0),
      openChangeRequests: openChangeRequests.length,
      pendingResults: pendingResults.length,
      missingResults: missingResults.length,
      openPostponements: openPostponements.length,
      overduePostponements: overduePostponements.length,
      officialGaps: officialCoverage.missing.length,
      replacementAssignments: replacementAssignments.length,
      officialCoverage: officialCoverage.percentage,
      pendingAcknowledgements: pendingAcknowledgements.length,
      unplacedFixtures: unplacedFixtures.length,
      setupGaps: incompleteSetup.length,
      openDisciplineCases,
      overdueDisciplineResponses,
      overdueDisciplineFines,
      disciplineHearings,
      disciplineAppeals,
      pendingRegistrations,
      registrationCorrections,
      pendingTransfers,
      openEligibilityExceptions,
      invalidTeamSheets,
      overdueInvoices,
      outstandingPence,
      unbilledFines,
      unpaidExpenses,
    },
    publication,
    officialCoverage,
    roleFocus: roleLabels[role] || null,
    nextFixtures: operationalFixtures.slice(0, 8),
    readinessPercentage: Number(readiness.percentage || 0),
    generatedFor: todayKey,
    officialHorizonEnd: horizonKey,
  };
}
