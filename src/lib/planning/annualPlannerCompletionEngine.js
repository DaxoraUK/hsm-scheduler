import { neutraliseSpreadsheetFormula } from "../export/spreadsheetSafety.js";

const clean = (value) => String(value ?? "").trim();
const finite = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const WAITLIST_OFFER_STATUSES = Object.freeze([
  { value: "offered", label: "Awaiting coach" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
]);

export const BULK_COMMAND_TYPES = Object.freeze([
  { value: "change_status", label: "Change booking status" },
  { value: "move_pitch", label: "Move to another pitch / area" },
  { value: "shift_dates", label: "Shift dates" },
]);

export function normaliseWaitlistOffer(row = {}) {
  return Object.freeze({
    id: clean(row.id),
    waitlistEntryId: clean(row.waitlist_entry_id || row.waitlistEntryId),
    teamKey: clean(row.team_key || row.teamKey).toLowerCase(),
    teamName: clean(row.team_name || row.teamName) || "Unnamed team",
    status: ["offered", "accepted", "declined", "expired", "revoked"].includes(clean(row.status).toLowerCase())
      ? clean(row.status).toLowerCase()
      : "offered",
    startAt: row.start_at || row.startAt || null,
    endAt: row.end_at || row.endAt || null,
    venueId: clean(row.venue_id || row.venueId),
    venueName: clean(row.venue_name || row.venueName),
    pitchId: clean(row.pitch_id || row.pitchId),
    pitchName: clean(row.pitch_name || row.pitchName),
    pitchAreaId: clean(row.pitch_area_id || row.pitchAreaId),
    pitchAreaName: clean(row.pitch_area_name || row.pitchAreaName),
    siteInventoryId: clean(row.site_inventory_id || row.siteInventoryId),
    siteSlotId: clean(row.site_slot_id || row.siteSlotId),
    message: clean(row.message),
    coachResponse: clean(row.coach_response || row.coachResponse),
    expiresAt: row.expires_at || row.expiresAt || null,
    bookingId: clean(row.booking_id || row.bookingId),
    createdAt: row.created_at || row.createdAt || null,
    respondedAt: row.responded_at || row.respondedAt || null,
  });
}

export function waitlistOfferToPayload(value = {}) {
  const row = normaliseWaitlistOffer(value);
  return {
    waitlist_entry_id: row.waitlistEntryId || null,
    start_at: row.startAt,
    end_at: row.endAt,
    venue_id: row.venueId || null,
    venue_name: row.venueName || null,
    pitch_id: row.pitchId || null,
    pitch_name: row.pitchName || null,
    pitch_area_id: row.pitchAreaId || null,
    pitch_area_name: row.pitchAreaName || null,
    site_inventory_id: row.siteInventoryId || null,
    site_slot_id: row.siteSlotId || null,
    message: row.message || null,
    expires_at: row.expiresAt || null,
  };
}

export function normalisePlannerCalendarFeed(row = {}) {
  return Object.freeze({
    id: clean(row.id),
    label: clean(row.label || row.feed_label || row.feedLabel) || "Annual Planner calendar",
    scopeType: clean(row.scope_type || row.scopeType || "club").toLowerCase(),
    scopeKey: clean(row.scope_key || row.scopeKey),
    seasonPhase: clean(row.season_phase || row.seasonPhase || "all").toLowerCase(),
    token: clean(row.token),
    revokedAt: row.revoked_at || row.revokedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  });
}

export function plannerCalendarFeedToPayload(value = {}) {
  return {
    label: clean(value.label || "Annual Planner calendar"),
    scope_type: ["club", "team", "season"].includes(clean(value.scopeType).toLowerCase()) ? clean(value.scopeType).toLowerCase() : "club",
    scope_key: clean(value.scopeKey) || null,
    season_phase: ["preseason", "regular", "winter", "all"].includes(clean(value.seasonPhase).toLowerCase()) ? clean(value.seasonPhase).toLowerCase() : "all",
  };
}

export function buildAnnualPlannerFeedUrl(token, origin = "") {
  const safeToken = encodeURIComponent(clean(token));
  const safeOrigin = clean(origin).replace(/\/$/, "");
  return `${safeOrigin}/api/planner/calendar?token=${safeToken}`;
}

export function bulkCommandToPayload(value = {}) {
  return {
    command_type: ["change_status", "move_pitch", "shift_dates"].includes(clean(value.commandType)) ? clean(value.commandType) : "change_status",
    booking_ids: [...new Set((Array.isArray(value.bookingIds) ? value.bookingIds : []).map(clean).filter(Boolean))],
    status: clean(value.status) || null,
    pitch_id: clean(value.pitchId) || null,
    pitch_name: clean(value.pitchName) || null,
    pitch_area_id: clean(value.pitchAreaId) || null,
    pitch_area_name: clean(value.pitchAreaName) || null,
    shift_days: Math.max(-365, Math.min(365, Math.round(finite(value.shiftDays, 0)))),
    reason: clean(value.reason) || null,
  };
}

export function buildBulkCommandPreview(value = {}, bookings = []) {
  const payload = bulkCommandToPayload(value);
  const selected = (Array.isArray(bookings) ? bookings : []).filter((booking) => payload.booking_ids.includes(clean(booking.id)));
  const invalid = [];
  if (!selected.length) invalid.push("Select at least one booking.");
  if (payload.command_type === "change_status" && !payload.status) invalid.push("Choose a target status.");
  if (payload.command_type === "move_pitch" && !payload.pitch_id) invalid.push("Choose a target pitch.");
  if (payload.command_type === "shift_dates" && payload.shift_days === 0) invalid.push("Choose a non-zero date shift.");
  return Object.freeze({
    payload,
    selected,
    count: selected.length,
    ready: invalid.length === 0,
    errors: invalid,
    affectedTeams: [...new Set(selected.map((booking) => clean(booking.teamName || booking.team_name)).filter(Boolean))],
  });
}

export function buildAnnualPlannerReadiness({ bookings = [], waitlist = [], waitlistOffers = [], calendarFeeds = [], analytics = null, teams = [], pitches = [], winterSites = [] } = {}) {
  const checks = [
    { key: "teams", label: "Teams configured", passed: (Array.isArray(teams) ? teams : []).length > 0 },
    { key: "pitches", label: "Club pitches configured", passed: (Array.isArray(pitches) ? pitches : []).length > 0 },
    { key: "bookings", label: "Annual bookings tested", passed: (Array.isArray(bookings) ? bookings : []).length > 0 },
    { key: "winter", label: "Winter inventory reviewed", passed: (Array.isArray(winterSites) ? winterSites : []).length > 0 },
    { key: "waitlist", label: "Waitlist workflow tested", passed: (Array.isArray(waitlist) ? waitlist : []).length === 0 || (Array.isArray(waitlistOffers) ? waitlistOffers : []).length > 0 },
    { key: "feeds", label: "External calendar feed created", passed: (Array.isArray(calendarFeeds) ? calendarFeeds : []).some((row) => !row.revokedAt && !row.revoked_at) },
    { key: "analytics", label: "Grant evidence generated", passed: Boolean(analytics?.hasData && analytics?.grantNarratives?.length) },
  ];
  const passed = checks.filter((check) => check.passed).length;
  return Object.freeze({
    checks,
    passed,
    total: checks.length,
    percent: Math.round((passed / checks.length) * 100),
    ready: passed === checks.length,
  });
}

function csv(value) {
  const text = String(neutraliseSpreadsheetFormula(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildAnnualPlannerGrantEvidenceCsv(model = {}) {
  const metrics = model.metrics || {};
  const rows = [
    ["Measure", "Value", "Evidence use"],
    ["Planned facility hours", metrics.plannedHours || 0, "Total annual demand"],
    ["Delivered hours", metrics.deliveredHours || 0, "Actual programme delivery"],
    ["Weather-lost hours", metrics.weatherLostHours || 0, "Drainage and all-weather facility need"],
    ["Winter training hours", metrics.winterHours || 0, "Seasonal external provision"],
    ["External winter cost", ((metrics.externalWinterCostPence || 0) / 100).toFixed(2), "Cost pressure"],
    ["Waiting teams", metrics.waitingTeams || 0, "Unmet demand"],
    ["Waitlist offers accepted", metrics.acceptedWaitlistOffers || 0, "Recovered capacity"],
    ["Waitlist offers declined", metrics.declinedWaitlistOffers || 0, "Suitability gap"],
    ["Closure-affected bookings", metrics.closureAffectedBookings || 0, "Facility resilience"],
    ["Prime-slot fairness", `${metrics.primeSlotFairnessPct ?? 100}%`, "Fair access"],
    ["Preference success", `${metrics.preferenceSuccessPct || 0}%`, "User need alignment"],
  ];
  (Array.isArray(model.grantNarratives) ? model.grantNarratives : []).forEach((narrative, index) => rows.push([`Narrative ${index + 1}`, narrative, "Grant application statement"]));
  return rows.map((row) => row.map(csv).join(",")).join("\n");
}
