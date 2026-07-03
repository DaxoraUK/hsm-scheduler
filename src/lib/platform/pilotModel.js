export const PILOT_STAGES = Object.freeze([
  "candidate",
  "invited",
  "onboarding",
  "validation",
  "live_pilot",
  "paused",
  "graduated",
  "withdrawn",
]);

export const PILOT_HEALTH = Object.freeze(["on_track", "attention", "blocked"]);
export const LAUNCH_GATE_STATUSES = Object.freeze([
  "not_started",
  "in_progress",
  "blocked",
  "ready",
  "not_applicable",
]);

export const PILOT_CHECKLIST_ITEMS = Object.freeze([
  ["owner_confirmed", "Accountable club owner confirmed"],
  ["onboarding_complete", "Workspace onboarding completed"],
  ["data_verified", "Teams, pitches, venues and fixtures verified"],
  ["training_complete", "Club operator training completed"],
  ["support_channel_confirmed", "Support channel and escalation contact confirmed"],
  ["legal_acceptance_complete", "Required legal documents accepted"],
  ["billing_mode_confirmed", "Pilot billing or exemption confirmed"],
  ["go_live_check_complete", "Desktop and mobile go-live check passed"],
  ["feedback_cadence_confirmed", "Feedback and review cadence agreed"],
  ["exit_review_complete", "Pilot exit or graduation review completed"],
]);

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function normaliseLaunchGate(row = {}) {
  return Object.freeze({
    code: row.code || "",
    title: row.title || "Launch gate",
    category: row.category || "operations",
    status: LAUNCH_GATE_STATUSES.includes(row.status) ? row.status : "not_started",
    evidence: row.evidence || "",
    ownerLabel: row.owner_label || row.ownerLabel || "",
    dueDate: row.due_date || row.dueDate || null,
    lastVerifiedAt: toDate(row.last_verified_at || row.lastVerifiedAt),
    lastVerifiedByName: row.last_verified_by_name || row.lastVerifiedByName || "",
    updatedAt: toDate(row.updated_at || row.updatedAt),
  });
}

export function normalisePilotClub(row = {}) {
  const checklist = row.checklist && typeof row.checklist === "object" ? row.checklist : {};
  const checklistTotal = PILOT_CHECKLIST_ITEMS.length;
  const checklistComplete = PILOT_CHECKLIST_ITEMS.filter(([key]) => Boolean(checklist[key])).length;
  return Object.freeze({
    clubId: row.club_id || row.clubId || "",
    clubName: row.club_name || row.clubName || "Club workspace",
    stage: PILOT_STAGES.includes(row.stage) ? row.stage : "candidate",
    health: PILOT_HEALTH.includes(row.health) ? row.health : "on_track",
    coordinatorUserId: row.coordinator_user_id || row.coordinatorUserId || null,
    coordinatorName: row.coordinator_name || row.coordinatorName || "",
    targetStartDate: row.target_start_date || row.targetStartDate || null,
    targetReviewDate: row.target_review_date || row.targetReviewDate || null,
    liveSince: toDate(row.live_since || row.liveSince),
    notes: row.notes || "",
    checklist,
    checklistTotal,
    checklistComplete,
    checklistPercent: checklistTotal ? Math.round((checklistComplete / checklistTotal) * 100) : 0,
    planCode: row.plan_code || row.planCode || "",
    subscriptionStatus: row.subscription_status || row.subscriptionStatus || "",
    onboardingStatus: row.onboarding_status || row.onboardingStatus || "",
    updatedAt: toDate(row.updated_at || row.updatedAt),
  });
}

export function normaliseClientEvent(row = {}) {
  return Object.freeze({
    id: row.id || "",
    clubId: row.club_id || row.clubId || null,
    clubName: row.club_name || row.clubName || "Platform",
    level: row.level === "warning" ? "warning" : "error",
    category: row.category || "manual_report",
    message: row.message || "Unexpected client error",
    reference: row.reference || "",
    route: row.route || "",
    release: row.release || "",
    environment: row.environment || "",
    context: row.context && typeof row.context === "object" ? row.context : {},
    createdAt: toDate(row.created_at || row.createdAt),
  });
}

export function normalisePilotLaunchReadiness(payload = {}) {
  const gates = Array.isArray(payload.gates) ? payload.gates.map(normaliseLaunchGate) : [];
  const pilots = Array.isArray(payload.pilots) ? payload.pilots.map(normalisePilotClub) : [];
  const clientEvents = Array.isArray(payload.client_events || payload.clientEvents)
    ? (payload.client_events || payload.clientEvents).map(normaliseClientEvent)
    : [];
  const summary = payload.summary || {};
  const gateTotal = Number(summary.gate_total ?? summary.gateTotal ?? gates.filter((item) => item.status !== "not_applicable").length);
  const gateReady = Number(summary.gate_ready ?? summary.gateReady ?? gates.filter((item) => item.status === "ready").length);

  return Object.freeze({
    gates,
    pilots,
    clientEvents,
    summary: Object.freeze({
      gateTotal,
      gateReady,
      gateBlocked: Number(summary.gate_blocked ?? summary.gateBlocked ?? 0),
      gatePercent: gateTotal ? Math.round((gateReady / gateTotal) * 100) : 0,
      pilotTotal: Number(summary.pilot_total ?? summary.pilotTotal ?? pilots.length),
      pilotLive: Number(summary.pilot_live ?? summary.pilotLive ?? pilots.filter((item) => item.stage === "live_pilot").length),
      pilotBlocked: Number(summary.pilot_blocked ?? summary.pilotBlocked ?? pilots.filter((item) => item.health === "blocked").length),
      openClientErrors: Number(summary.open_client_errors ?? summary.openClientErrors ?? clientEvents.filter((item) => item.level === "error").length),
      billingLegalReady: Boolean(summary.billing_legal_ready ?? summary.billingLegalReady),
    }),
  });
}

export function createPilotDraft(clubId = "") {
  return {
    clubId,
    stage: "candidate",
    health: "on_track",
    coordinatorUserId: null,
    targetStartDate: "",
    targetReviewDate: "",
    notes: "",
    checklist: Object.fromEntries(PILOT_CHECKLIST_ITEMS.map(([key]) => [key, false])),
  };
}

export function validatePilotDraft(input = {}) {
  const errors = [];
  if (!String(input.clubId || "").trim()) errors.push("Select a club for the pilot.");
  if (!PILOT_STAGES.includes(String(input.stage || "").toLowerCase())) errors.push("Select a supported pilot stage.");
  if (!PILOT_HEALTH.includes(String(input.health || "").toLowerCase())) errors.push("Select a supported pilot health state.");
  if (input.targetReviewDate && input.targetStartDate && input.targetReviewDate < input.targetStartDate) {
    errors.push("The pilot review date cannot be before the target start date.");
  }
  return errors;
}
