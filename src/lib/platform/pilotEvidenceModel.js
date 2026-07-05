export const LAUNCH_EVIDENCE_TYPES = Object.freeze([
  "automated_test",
  "manual_test",
  "deployment",
  "security_review",
  "backup_restore",
  "document",
  "decision",
  "observation",
]);

export const LAUNCH_EVIDENCE_RESULTS = Object.freeze(["pass", "fail", "observation"]);
export const DEPLOYMENT_ENVIRONMENTS = Object.freeze(["local", "development", "staging", "production"]);

export const PILOT_CYCLES = Object.freeze([
  "historical_replay",
  "shadow_live",
  "controlled_use",
  "signoff",
]);

export const PILOT_SESSION_STATUSES = Object.freeze(["planned", "in_progress", "completed", "blocked"]);
export const PILOT_OUTCOMES = Object.freeze(["not_run", "pass", "conditional", "fail"]);
export const PILOT_FINDING_TYPES = Object.freeze(["defect", "usability", "data", "training", "feature_request"]);
export const PILOT_FINDING_SEVERITIES = Object.freeze(["critical", "high", "medium", "low"]);
export const PILOT_FINDING_STATUSES = Object.freeze(["open", "in_progress", "resolved", "deferred"]);

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const number = (value) => Math.max(0, Number(value) || 0);

export function normaliseLaunchEvidence(row = {}) {
  return Object.freeze({
    id: row.id || "",
    gateCode: row.gate_code || row.gateCode || "",
    gateTitle: row.gate_title || row.gateTitle || "Launch gate",
    evidenceType: LAUNCH_EVIDENCE_TYPES.includes(row.evidence_type || row.evidenceType) ? (row.evidence_type || row.evidenceType) : "observation",
    result: LAUNCH_EVIDENCE_RESULTS.includes(row.result) ? row.result : "observation",
    environment: DEPLOYMENT_ENVIRONMENTS.includes(row.environment) ? row.environment : "staging",
    release: row.release || "",
    summary: row.summary || "",
    artifactUrl: row.artifact_url || row.artifactUrl || "",
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    observedAt: toDate(row.observed_at || row.observedAt),
    createdAt: toDate(row.created_at || row.createdAt),
    createdByName: row.created_by_name || row.createdByName || "Daxora",
  });
}

export function normalisePilotSession(row = {}) {
  return Object.freeze({
    id: row.id || "",
    clubId: row.club_id || row.clubId || "",
    clubName: row.club_name || row.clubName || "Pilot club",
    cycle: PILOT_CYCLES.includes(row.cycle) ? row.cycle : "historical_replay",
    status: PILOT_SESSION_STATUSES.includes(row.status) ? row.status : "planned",
    sessionDate: row.session_date || row.sessionDate || "",
    operatorName: row.operator_name || row.operatorName || "",
    fixtureCount: number(row.fixture_count ?? row.fixtureCount),
    autoScheduledCount: number(row.auto_scheduled_count ?? row.autoScheduledCount),
    manualResolvedCount: number(row.manual_resolved_count ?? row.manualResolvedCount),
    unresolvedCount: number(row.unresolved_count ?? row.unresolvedCount),
    invalidRecommendationCount: number(row.invalid_recommendation_count ?? row.invalidRecommendationCount),
    correctWarningCount: number(row.correct_warning_count ?? row.correctWarningCount),
    missedWarningCount: number(row.missed_warning_count ?? row.missedWarningCount),
    overrideCount: number(row.override_count ?? row.overrideCount),
    criticalDefectCount: number(row.critical_defect_count ?? row.criticalDefectCount),
    highDefectCount: number(row.high_defect_count ?? row.highDefectCount),
    timeSavedMinutes: number(row.time_saved_minutes ?? row.timeSavedMinutes),
    outcome: PILOT_OUTCOMES.includes(row.outcome) ? row.outcome : "not_run",
    notes: row.notes || "",
    signoffName: row.signoff_name || row.signoffName || "",
    signedOffAt: toDate(row.signed_off_at || row.signedOffAt),
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: toDate(row.updated_at || row.updatedAt),
  });
}

export function normalisePilotFinding(row = {}) {
  return Object.freeze({
    id: row.id || "",
    sessionId: row.session_id || row.sessionId || "",
    clubId: row.club_id || row.clubId || "",
    cycle: row.cycle || "",
    findingType: PILOT_FINDING_TYPES.includes(row.finding_type || row.findingType) ? (row.finding_type || row.findingType) : "defect",
    severity: PILOT_FINDING_SEVERITIES.includes(row.severity) ? row.severity : "medium",
    status: PILOT_FINDING_STATUSES.includes(row.status) ? row.status : "open",
    title: row.title || "Pilot finding",
    description: row.description || "",
    workaround: row.workaround || "",
    reference: row.reference || "",
    createdAt: toDate(row.created_at || row.createdAt),
    updatedAt: toDate(row.updated_at || row.updatedAt),
  });
}

export function normalisePilotEvidencePayload(payload = {}) {
  const launchEvidence = Array.isArray(payload.launch_evidence || payload.launchEvidence)
    ? (payload.launch_evidence || payload.launchEvidence).map(normaliseLaunchEvidence)
    : [];
  const sessions = Array.isArray(payload.sessions) ? payload.sessions.map(normalisePilotSession) : [];
  const findings = Array.isArray(payload.findings) ? payload.findings.map(normalisePilotFinding) : [];
  const summary = payload.summary || {};
  return Object.freeze({
    launchEvidence,
    sessions,
    findings,
    summary: Object.freeze({
      evidenceTotal: number(summary.evidence_total ?? summary.evidenceTotal ?? launchEvidence.length),
      evidencePassed: number(summary.evidence_passed ?? summary.evidencePassed ?? launchEvidence.filter((item) => item.result === "pass").length),
      sessionsTotal: number(summary.sessions_total ?? summary.sessionsTotal ?? sessions.length),
      sessionsCompleted: number(summary.sessions_completed ?? summary.sessionsCompleted ?? sessions.filter((item) => item.status === "completed").length),
      openFindings: number(summary.open_findings ?? summary.openFindings ?? findings.filter((item) => !["resolved", "deferred"].includes(item.status)).length),
      criticalFindings: number(summary.critical_findings ?? summary.criticalFindings ?? findings.filter((item) => item.severity === "critical" && item.status !== "resolved").length),
    }),
  });
}

export function createLaunchEvidenceDraft({ gateCode = "", environment = "staging", release = "" } = {}) {
  return {
    gateCode,
    evidenceType: "automated_test",
    result: "pass",
    environment: DEPLOYMENT_ENVIRONMENTS.includes(environment) ? environment : "staging",
    release,
    summary: "",
    artifactUrl: "",
    observedAt: new Date().toISOString().slice(0, 16),
    metadata: {},
  };
}

export function createPilotSessionDraft(clubId = "") {
  return {
    id: "",
    clubId,
    cycle: "historical_replay",
    status: "planned",
    sessionDate: new Date().toISOString().slice(0, 10),
    operatorName: "",
    fixtureCount: 0,
    autoScheduledCount: 0,
    manualResolvedCount: 0,
    unresolvedCount: 0,
    invalidRecommendationCount: 0,
    correctWarningCount: 0,
    missedWarningCount: 0,
    overrideCount: 0,
    criticalDefectCount: 0,
    highDefectCount: 0,
    timeSavedMinutes: 0,
    outcome: "not_run",
    notes: "",
    signoffName: "",
  };
}

export function createPilotFindingDraft(sessionId = "") {
  return {
    id: "",
    sessionId,
    findingType: "defect",
    severity: "medium",
    status: "open",
    title: "",
    description: "",
    workaround: "",
    reference: "",
  };
}

export function validateLaunchEvidenceDraft(input = {}) {
  const errors = [];
  if (!String(input.gateCode || "").trim()) errors.push("Select the launch gate this evidence supports.");
  if (!LAUNCH_EVIDENCE_TYPES.includes(input.evidenceType)) errors.push("Select a supported evidence type.");
  if (!LAUNCH_EVIDENCE_RESULTS.includes(input.result)) errors.push("Select a supported evidence result.");
  if (!DEPLOYMENT_ENVIRONMENTS.includes(input.environment)) errors.push("Select the environment where the evidence was observed.");
  if (String(input.summary || "").trim().length < 8) errors.push("Describe what was tested and what the result proves.");
  if (input.artifactUrl && !/^https:\/\//i.test(String(input.artifactUrl).trim())) errors.push("Evidence links must use HTTPS.");
  return errors;
}

export function validatePilotSessionDraft(input = {}) {
  const errors = [];
  if (!String(input.clubId || "").trim()) errors.push("Select a pilot club.");
  if (!PILOT_CYCLES.includes(input.cycle)) errors.push("Select a supported pilot cycle.");
  if (!PILOT_SESSION_STATUSES.includes(input.status)) errors.push("Select a supported session status.");
  if (!PILOT_OUTCOMES.includes(input.outcome)) errors.push("Select a supported pilot outcome.");
  if (!input.sessionDate) errors.push("Enter the pilot-session date.");
  const numericFields = [
    "fixtureCount", "autoScheduledCount", "manualResolvedCount", "unresolvedCount",
    "invalidRecommendationCount", "correctWarningCount", "missedWarningCount",
    "overrideCount", "criticalDefectCount", "highDefectCount", "timeSavedMinutes",
  ];
  if (numericFields.some((field) => Number(input[field]) < 0)) errors.push("Pilot metrics cannot be negative.");
  if (input.status === "completed" && input.outcome === "not_run") errors.push("Choose an outcome for a completed pilot session.");
  if (input.cycle === "signoff" && input.outcome === "pass" && !String(input.signoffName || "").trim()) errors.push("Record the person providing pilot sign-off.");
  return errors;
}

export function validatePilotFindingDraft(input = {}) {
  const errors = [];
  if (!String(input.sessionId || "").trim()) errors.push("Select the pilot session for this finding.");
  if (!PILOT_FINDING_TYPES.includes(input.findingType)) errors.push("Select a supported finding type.");
  if (!PILOT_FINDING_SEVERITIES.includes(input.severity)) errors.push("Select a supported severity.");
  if (!PILOT_FINDING_STATUSES.includes(input.status)) errors.push("Select a supported finding status.");
  if (String(input.title || "").trim().length < 4) errors.push("Give the finding a clear title.");
  if (String(input.description || "").trim().length < 8) errors.push("Describe the observed issue or learning.");
  return errors;
}
