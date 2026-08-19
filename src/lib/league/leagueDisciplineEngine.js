function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isoDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isoDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isSecureLeagueDocumentUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normaliseCase(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    caseReference: row.case_reference || row.caseReference || "",
    caseType: row.case_type || row.caseType || "misconduct",
    status: row.status || "draft",
    priority: row.priority || "normal",
    title: row.title || "Untitled discipline case",
    summary: row.summary || "",
    incidentOn: isoDate(row.incident_on || row.incidentOn),
    responseDueOn: isoDate(row.response_due_on || row.responseDueOn),
    hearingOn: row.hearing_on || row.hearingOn || null,
    decisionOn: isoDate(row.decision_on || row.decisionOn),
    closedAt: isoDateTime(row.closed_at || row.closedAt),
    publicationFixtureId: row.publication_fixture_id || row.publicationFixtureId || "",
    targetType: row.target_type || row.targetType || "",
    targetId: row.target_id || row.targetId || "",
    reportingClubId: row.reporting_club_id || row.reportingClubId || "",
    respondentClubId: row.respondent_club_id || row.respondentClubId || "",
    respondentTeamId: row.respondent_team_id || row.respondentTeamId || "",
    reportingClubName: row.reporting_club_name || row.reportingClubName || "",
    respondentClubName: row.respondent_club_name || row.respondentClubName || "",
    respondentTeamName: row.respondent_team_name || row.respondentTeamName || "",
    fixtureLabel: row.fixture_label || row.fixtureLabel || "",
    assignedTo: row.assigned_to || row.assignedTo || "",
    assignedToName: row.assigned_to_name || row.assignedToName || "",
    confidential: asBoolean(row.confidential),
    clubResponseRequired: asBoolean(row.club_response_required ?? row.clubResponseRequired),
    createdBy: row.created_by || row.createdBy || "",
    createdByName: row.created_by_name || row.createdByName || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseCharge(row = {}) {
  return {
    id: row.id || "",
    caseId: row.case_id || row.caseId || "",
    chargeCode: row.charge_code || row.chargeCode || "",
    title: row.title || "Charge",
    description: row.description || "",
    ruleReference: row.rule_reference || row.ruleReference || "",
    status: row.status || "alleged",
    decisionReason: row.decision_reason || row.decisionReason || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseEvent(row = {}) {
  return {
    id: row.id || "",
    caseId: row.case_id || row.caseId || "",
    eventType: row.event_type || row.eventType || "note",
    visibility: row.visibility || "league",
    title: row.title || "Case update",
    detail: row.detail || "",
    eventData: row.event_data || row.eventData || {},
    createdBy: row.created_by || row.createdBy || "",
    createdByName: row.created_by_name || row.createdByName || "",
    createdByRole: row.created_by_role || row.createdByRole || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
  };
}

function normaliseSanction(row = {}) {
  return {
    id: row.id || "",
    caseId: row.case_id || row.caseId || "",
    sanctionType: row.sanction_type || row.sanctionType || "warning",
    subjectType: row.subject_type || row.subjectType || "club",
    subjectId: row.subject_id || row.subjectId || "",
    subjectLabel: row.subject_label || row.subjectLabel || "",
    status: row.status || "proposed",
    amountPence: asNumber(row.amount_pence ?? row.amountPence),
    pointsDelta: asNumber(row.points_delta ?? row.pointsDelta),
    matchCount: asNumber(row.match_count ?? row.matchCount),
    matchesServed: asNumber(row.matches_served ?? row.matchesServed),
    startsOn: isoDate(row.starts_on || row.startsOn),
    endsOn: isoDate(row.ends_on || row.endsOn),
    paymentDueOn: isoDate(row.payment_due_on || row.paymentDueOn),
    paidAt: isoDateTime(row.paid_at || row.paidAt),
    tableAdjustmentId: row.table_adjustment_id || row.tableAdjustmentId || "",
    notes: row.notes || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseAppeal(row = {}) {
  return {
    id: row.id || "",
    caseId: row.case_id || row.caseId || "",
    submittedByClubId: row.submitted_by_club_id || row.submittedByClubId || "",
    status: row.status || "submitted",
    grounds: row.grounds || "",
    decision: row.decision || "",
    decisionReason: row.decision_reason || row.decisionReason || "",
    submittedAt: isoDateTime(row.submitted_at || row.submittedAt),
    decidedAt: isoDateTime(row.decided_at || row.decidedAt),
    appealDueOn: isoDate(row.appeal_due_on || row.appealDueOn),
  };
}

function normaliseDocument(row = {}) {
  return {
    id: row.id || "",
    caseId: row.case_id || row.caseId || "",
    title: row.title || row.file_name || row.fileName || "Evidence",
    fileName: row.file_name || row.fileName || "",
    documentUrl: row.document_url || row.documentUrl || "",
    visibility: row.visibility || "league",
    documentType: row.document_type || row.documentType || "evidence",
    notes: row.notes || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
  };
}

export function buildLeagueDisciplineSummary(data = {}, { today = new Date() } = {}) {
  const todayKey = isoDate(today instanceof Date ? today.toISOString() : today) || new Date().toISOString().slice(0, 10);
  const cases = asArray(data.cases);
  const sanctions = asArray(data.sanctions);
  const appeals = asArray(data.appeals);
  const openStatuses = new Set(["awaiting_review", "awaiting_club_response", "hearing_scheduled", "decision_pending", "decided", "appealed"]);
  const openCases = cases.filter((row) => openStatuses.has(row.status));
  const overdueResponses = openCases.filter((row) => row.responseDueOn && row.responseDueOn < todayKey && row.status === "awaiting_club_response");
  const hearingsDue = openCases.filter((row) => row.hearingOn && String(row.hearingOn).slice(0, 10) >= todayKey);
  const activeSanctions = sanctions.filter((row) => ["active", "unpaid", "appealed"].includes(row.status));
  const unpaidFines = sanctions.filter((row) => row.sanctionType === "fine" && ["active", "unpaid", "appealed"].includes(row.status) && !row.paidAt);
  const overdueFines = unpaidFines.filter((row) => row.paymentDueOn && row.paymentDueOn < todayKey);
  const openAppeals = appeals.filter((row) => ["submitted", "under_review", "hearing_scheduled"].includes(row.status));
  const critical = overdueResponses.length + overdueFines.length;
  const attention = openCases.length + activeSanctions.length + openAppeals.length - critical;

  return {
    status: critical > 0 ? "action_required" : attention > 0 ? "needs_review" : "ready",
    openCases: openCases.length,
    overdueResponses: overdueResponses.length,
    hearingsDue: hearingsDue.length,
    activeSanctions: activeSanctions.length,
    unpaidFines: unpaidFines.length,
    overdueFines: overdueFines.length,
    openAppeals: openAppeals.length,
    totalFinePence: unpaidFines.reduce((sum, row) => sum + asNumber(row.amountPence), 0),
    casesReadyToClose: cases.filter((row) => row.status === "decided" && !sanctions.some((sanction) => sanction.caseId === row.id && ["active", "unpaid", "appealed"].includes(sanction.status))).length,
  };
}

export function buildDisciplineClubScorecards(data = {}) {
  const cases = asArray(data.cases);
  const sanctions = asArray(data.sanctions);
  const todayKey = new Date().toISOString().slice(0, 10);
  const scorecards = new Map();
  const ensure = (id, label) => {
    const key = id || label || "unknown";
    if (!scorecards.has(key)) scorecards.set(key, { id, label: label || "Unassigned club", openCases: 0, overdueResponses: 0, activeSanctions: 0, unpaidFines: 0, finePence: 0 });
    return scorecards.get(key);
  };

  cases.forEach((row) => {
    if (!row.respondentClubId && !row.respondentClubName) return;
    const score = ensure(row.respondentClubId, row.respondentClubName);
    if (!["closed", "withdrawn", "draft"].includes(row.status)) score.openCases += 1;
    if (row.status === "awaiting_club_response" && row.responseDueOn && row.responseDueOn < todayKey) score.overdueResponses += 1;
  });

  sanctions.forEach((row) => {
    if (row.subjectType !== "club") return;
    const score = ensure(row.subjectId, row.subjectLabel);
    if (["active", "unpaid", "appealed"].includes(row.status)) score.activeSanctions += 1;
    if (row.sanctionType === "fine" && ["active", "unpaid", "appealed"].includes(row.status) && !row.paidAt) {
      score.unpaidFines += 1;
      score.finePence += asNumber(row.amountPence);
    }
  });

  return [...scorecards.values()].sort((left, right) => (
    right.overdueResponses - left.overdueResponses
    || right.unpaidFines - left.unpaidFines
    || right.openCases - left.openCases
    || left.label.localeCompare(right.label)
  ));
}

export function normaliseLeagueDisciplineData(payload = {}) {
  const data = {
    access: {
      role: payload.access?.role || "viewer",
      canView: asBoolean(payload.access?.can_view ?? payload.access?.canView ?? true),
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      isClubPortal: asBoolean(payload.access?.is_club_portal ?? payload.access?.isClubPortal),
      clubId: payload.access?.club_id || payload.access?.clubId || "",
    },
    cases: asArray(payload.cases).map(normaliseCase),
    charges: asArray(payload.charges).map(normaliseCharge),
    events: asArray(payload.events).map(normaliseEvent),
    sanctions: asArray(payload.sanctions).map(normaliseSanction),
    appeals: asArray(payload.appeals).map(normaliseAppeal),
    documents: asArray(payload.documents).map(normaliseDocument).filter((row) => isSecureLeagueDocumentUrl(row.documentUrl)),
  };

  data.cases.sort((left, right) => (
    ["critical", "high", "normal", "low"].indexOf(left.priority) - ["critical", "high", "normal", "low"].indexOf(right.priority)
    || String(left.responseDueOn || "9999-12-31").localeCompare(String(right.responseDueOn || "9999-12-31"))
    || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  ));
  data.events.sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  data.summary = buildLeagueDisciplineSummary(data);
  data.clubScorecards = buildDisciplineClubScorecards(data);
  return data;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function leagueDisciplineCasesToCsv(data = {}) {
  const headers = ["Case reference", "Status", "Priority", "Type", "Title", "Incident date", "Respondent club", "Respondent team", "Response due", "Hearing", "Open sanctions", "Unpaid fine"];
  const sanctionsByCase = new Map();
  asArray(data.sanctions).forEach((row) => {
    if (!sanctionsByCase.has(row.caseId)) sanctionsByCase.set(row.caseId, []);
    sanctionsByCase.get(row.caseId).push(row);
  });
  const rows = asArray(data.cases).map((row) => {
    const sanctions = sanctionsByCase.get(row.id) || [];
    return [
      row.caseReference,
      row.status,
      row.priority,
      row.caseType,
      row.title,
      row.incidentOn,
      row.respondentClubName,
      row.respondentTeamName,
      row.responseDueOn,
      row.hearingOn ? String(row.hearingOn).slice(0, 16).replace("T", " ") : "",
      sanctions.filter((sanction) => ["active", "unpaid", "appealed"].includes(sanction.status)).length,
      (sanctions.filter((sanction) => sanction.sanctionType === "fine" && !sanction.paidAt).reduce((sum, sanction) => sum + sanction.amountPence, 0) / 100).toFixed(2),
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function leagueDisciplineScorecardsToCsv(data = {}) {
  const headers = ["Club", "Open cases", "Overdue responses", "Active sanctions", "Unpaid fines", "Outstanding fine"];
  const rows = asArray(data.clubScorecards).map((row) => [row.label, row.openCases, row.overdueResponses, row.activeSanctions, row.unpaidFines, (row.finePence / 100).toFixed(2)]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
