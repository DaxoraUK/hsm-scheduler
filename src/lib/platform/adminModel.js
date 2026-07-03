import { PLAN_CATALOGUE, PLAN_CODES, SUBSCRIPTION_STATUSES } from "../subscriptions/entitlements.js";

export const PLATFORM_ROLES = Object.freeze({
  SUPPORT: "support",
  ADMIN: "admin",
});

export const CLUB_STATUSES = Object.freeze(["active", "suspended"]);
export const CASE_PRIORITIES = Object.freeze(["low", "normal", "high", "urgent"]);
export const CASE_STATUSES = Object.freeze([
  "open",
  "investigating",
  "waiting_on_club",
  "resolved",
  "closed",
]);

const dateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function normalisePlatformContext(payload = {}) {
  const isPlatformStaff = Boolean(payload.is_platform_staff ?? payload.isPlatformStaff);
  const role = String(payload.platform_role || payload.platformRole || PLATFORM_ROLES.SUPPORT).toLowerCase();
  return Object.freeze({
    isPlatformStaff,
    isPlatformAdmin: isPlatformStaff && role === PLATFORM_ROLES.ADMIN,
    userId: payload.user_id || payload.userId || "",
    email: payload.email || "",
    displayName: payload.display_name || payload.displayName || payload.email || "Daxora operator",
    role: role === PLATFORM_ROLES.ADMIN ? PLATFORM_ROLES.ADMIN : PLATFORM_ROLES.SUPPORT,
    roleLabel: role === PLATFORM_ROLES.ADMIN ? "Platform Administrator" : "Support Operator",
    status: payload.status || (isPlatformStaff ? "active" : "none"),
  });
}

export function normalisePlatformClub(row = {}) {
  return Object.freeze({
    id: row.club_id || row.clubId || "",
    name: row.club_name || row.clubName || "Club workspace",
    slug: row.club_slug || row.clubSlug || "",
    status: String(row.club_status || row.clubStatus || "active").toLowerCase(),
    organisationName: row.organisation_name || row.organisationName || "",
    ownerUserId: row.owner_user_id || row.ownerUserId || "",
    ownerName: row.owner_display_name || row.ownerDisplayName || "",
    ownerEmail: row.owner_email || row.ownerEmail || "",
    planCode: String(row.plan_code || row.planCode || PLAN_CODES.CORE).toLowerCase(),
    planName: row.plan_name || row.planName || PLAN_CATALOGUE[PLAN_CODES.CORE].name,
    subscriptionStatus: String(row.subscription_status || row.subscriptionStatus || SUBSCRIPTION_STATUSES.TRIALING).toLowerCase(),
    billingInterval: row.billing_interval || row.billingInterval || "monthly",
    billingExempt: Boolean(row.billing_exempt ?? row.billingExempt),
    trialEndsAt: dateOrNull(row.trial_ends_at || row.trialEndsAt),
    graceEndsAt: dateOrNull(row.grace_ends_at || row.graceEndsAt),
    currentPeriodEnd: dateOrNull(row.current_period_end || row.currentPeriodEnd),
    onboardingStatus: String(row.onboarding_status || row.onboardingStatus || "pending").toLowerCase(),
    onboardingStep: Number(row.onboarding_step ?? row.onboardingStep ?? 0),
    memberCount: Number(row.member_count ?? row.memberCount ?? 0),
    teamCount: Number(row.team_count ?? row.teamCount ?? 0),
    pitchCount: Number(row.pitch_count ?? row.pitchCount ?? 0),
    venueCount: Number(row.venue_count ?? row.venueCount ?? 0),
    historyCount: Number(row.history_count ?? row.historyCount ?? 0),
    openCaseCount: Number(row.open_case_count ?? row.openCaseCount ?? 0),
    activeSupportCount: Number(row.active_support_count ?? row.activeSupportCount ?? 0),
    mySupportSessionId: row.my_support_session_id || row.mySupportSessionId || null,
    mySupportExpiresAt: dateOrNull(row.my_support_expires_at || row.mySupportExpiresAt),
    lastActivityAt: dateOrNull(row.last_activity_at || row.lastActivityAt),
    createdAt: dateOrNull(row.created_at || row.createdAt),
  });
}

export function normaliseSupportCase(row = {}) {
  return Object.freeze({
    id: row.id || "",
    caseNumber: Number(row.case_number ?? row.caseNumber ?? 0),
    clubId: row.club_id || row.clubId || "",
    clubName: row.club_name || row.clubName || "Club workspace",
    subject: row.subject || "Support case",
    description: row.description || "",
    priority: String(row.priority || "normal").toLowerCase(),
    status: String(row.status || "open").toLowerCase(),
    requesterEmail: row.requester_email || row.requesterEmail || "",
    openedByName: row.opened_by_name || row.openedByName || "Daxora operator",
    assignedToName: row.assigned_to_name || row.assignedToName || "Unassigned",
    createdAt: dateOrNull(row.created_at || row.createdAt),
    updatedAt: dateOrNull(row.updated_at || row.updatedAt),
    resolvedAt: dateOrNull(row.resolved_at || row.resolvedAt),
  });
}

export function summarisePlatform(clubs = [], cases = []) {
  const activeCases = cases.filter((item) => !["resolved", "closed"].includes(item.status));
  return Object.freeze({
    clubs: clubs.length,
    activeClubs: clubs.filter((item) => item.status === "active").length,
    suspendedClubs: clubs.filter((item) => item.status === "suspended").length,
    trials: clubs.filter((item) => item.subscriptionStatus === "trialing").length,
    grace: clubs.filter((item) => item.subscriptionStatus === "grace").length,
    readOnlySubscriptions: clubs.filter((item) => ["suspended", "cancelled"].includes(item.subscriptionStatus)).length,
    openCases: activeCases.length,
    urgentCases: activeCases.filter((item) => item.priority === "urgent").length,
    activeSupportSessions: clubs.reduce((total, item) => total + item.activeSupportCount, 0),
  });
}

export function formatCaseNumber(value) {
  return `GC-${String(Number(value) || 0).padStart(6, "0")}`;
}

export function validateSubscriptionChange(input = {}) {
  const errors = [];
  if (!PLAN_CATALOGUE[String(input.planCode || "").toLowerCase()]) errors.push("Select a supported plan.");
  if (!Object.values(SUBSCRIPTION_STATUSES).includes(String(input.status || "").toLowerCase())) errors.push("Select a supported subscription status.");
  if (!["monthly", "annual", "manual"].includes(String(input.billingInterval || "").toLowerCase())) errors.push("Select a supported billing interval.");
  if (String(input.reason || "").trim().length < 5) errors.push("Enter a clear reason for the plan change.");
  return errors;
}

export function validateCaseDraft(input = {}) {
  const errors = [];
  if (!String(input.clubId || "").trim()) errors.push("Select a club.");
  if (String(input.subject || "").trim().length < 5) errors.push("Enter a subject of at least five characters.");
  if (!CASE_PRIORITIES.includes(String(input.priority || "").toLowerCase())) errors.push("Select a valid priority.");
  const email = String(input.requesterEmail || "").trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("Enter a valid requester email address.");
  return errors;
}
