const clean = (value) => String(value ?? "").trim();
const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const RESOURCE_TYPE_OPTIONS = Object.freeze([
  { value: "equipment", label: "Equipment" },
  { value: "changing_room", label: "Changing room" },
  { value: "access", label: "Access / key" },
  { value: "lighting", label: "Lighting" },
  { value: "staff", label: "Staff / supervision" },
  { value: "other", label: "Other" },
]);

export const WAITLIST_STATUS_OPTIONS = Object.freeze([
  { value: "waiting", label: "Waiting" },
  { value: "offered", label: "Slot offered" },
  { value: "allocated", label: "Allocated" },
  { value: "withdrawn", label: "Withdrawn" },
]);

export function normalisePlannerResource(row = {}) {
  return Object.freeze({
    id: clean(row.id),
    name: clean(row.name) || "Shared resource",
    resourceType: clean(row.resource_type || row.resourceType || "equipment").toLowerCase(),
    quantity: Math.max(1, Math.min(999, Math.round(finite(row.quantity, 1)))),
    setupBufferMinutes: Math.max(0, Math.min(240, Math.round(finite(row.setup_buffer_minutes ?? row.setupBufferMinutes, 0)))),
    clearDownBufferMinutes: Math.max(0, Math.min(240, Math.round(finite(row.clear_down_buffer_minutes ?? row.clearDownBufferMinutes, 0)))),
    notes: clean(row.notes),
    active: row.active !== false,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  });
}

export function plannerResourceToPayload(resource = {}) {
  const row = normalisePlannerResource(resource);
  return {
    id: row.id || null,
    name: row.name,
    resource_type: row.resourceType,
    quantity: row.quantity,
    setup_buffer_minutes: row.setupBufferMinutes,
    clear_down_buffer_minutes: row.clearDownBufferMinutes,
    notes: row.notes || null,
    active: row.active,
  };
}

function normaliseDays(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function normaliseTimes(value) {
  const rows = Array.isArray(value) ? value : [];
  return [...new Set(rows.map((time) => clean(time).slice(0, 5)).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort();
}

export function normaliseWaitlistEntry(row = {}) {
  return Object.freeze({
    id: clean(row.id),
    teamKey: clean(row.team_key || row.teamKey).toLowerCase(),
    teamName: clean(row.team_name || row.teamName) || "Unnamed team",
    seasonPhase: ["preseason", "regular", "winter"].includes(clean(row.season_phase || row.seasonPhase).toLowerCase())
      ? clean(row.season_phase || row.seasonPhase).toLowerCase()
      : "regular",
    preferredDays: normaliseDays(row.preferred_days || row.preferredDays),
    preferredStartTimes: normaliseTimes(row.preferred_start_times || row.preferredStartTimes),
    requiredDurationMinutes: Math.max(30, Math.min(240, Math.round(finite(row.required_duration_minutes ?? row.requiredDurationMinutes, 90)))),
    pitchId: clean(row.pitch_id || row.pitchId),
    pitchAreaId: clean(row.pitch_area_id || row.pitchAreaId),
    winterSiteId: clean(row.winter_site_id || row.winterSiteId),
    resourceRequirements: Array.isArray(row.resource_requirements || row.resourceRequirements)
      ? (row.resource_requirements || row.resourceRequirements).map((item) => ({ resourceId: clean(item.resource_id || item.resourceId), quantity: Math.max(1, Math.round(finite(item.quantity, 1))) })).filter((item) => item.resourceId)
      : [],
    participantCount: Math.max(0, Math.min(999, Math.round(finite(row.participant_count ?? row.participantCount, 0)))),
    priority: Math.max(1, Math.min(100, Math.round(finite(row.priority, 50)))),
    status: ["waiting", "offered", "allocated", "withdrawn"].includes(clean(row.status).toLowerCase()) ? clean(row.status).toLowerCase() : "waiting",
    notes: clean(row.notes),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  });
}

export function waitlistEntryToPayload(entry = {}) {
  const row = normaliseWaitlistEntry(entry);
  return {
    id: row.id || null,
    team_key: row.teamKey,
    team_name: row.teamName,
    season_phase: row.seasonPhase,
    preferred_days: row.preferredDays,
    preferred_start_times: row.preferredStartTimes,
    required_duration_minutes: row.requiredDurationMinutes,
    pitch_id: row.pitchId || null,
    pitch_area_id: row.pitchAreaId || null,
    winter_site_id: row.winterSiteId || null,
    resource_requirements: row.resourceRequirements.map((item) => ({ resource_id: item.resourceId, quantity: item.quantity })),
    participant_count: row.participantCount,
    priority: row.priority,
    status: row.status,
    notes: row.notes || null,
  };
}

export function normaliseSeasonRollover(row = {}) {
  return Object.freeze({
    id: clean(row.id),
    fromSeasonPhase: clean(row.from_season_phase || row.fromSeasonPhase || "regular"),
    toSeasonPhase: clean(row.to_season_phase || row.toSeasonPhase || "winter"),
    fromStartDate: clean(row.from_start_date || row.fromStartDate),
    fromEndDate: clean(row.from_end_date || row.fromEndDate),
    toStartDate: clean(row.to_start_date || row.toStartDate),
    toEndDate: clean(row.to_end_date || row.toEndDate),
    copiedPreferences: Math.max(0, Math.round(finite(row.copied_preferences ?? row.copiedPreferences, 0))),
    copiedAllocations: Math.max(0, Math.round(finite(row.copied_allocations ?? row.copiedAllocations, 0))),
    status: clean(row.status || "draft"),
    summary: row.summary && typeof row.summary === "object" ? row.summary : {},
    createdAt: row.created_at || row.createdAt || null,
  });
}

export function buildSeasonRolloverPreview({ preferences = [], allocationRuns = [], allocationItems = [], fromSeasonPhase = "regular", copyPreferences = true, copyAllocations = true } = {}) {
  const sourcePreferences = (Array.isArray(preferences) ? preferences : []).filter((row) => String(row.season_phase || row.seasonPhase || "regular") === fromSeasonPhase);
  const sourceRuns = (Array.isArray(allocationRuns) ? allocationRuns : [])
    .filter((run) => String(run.season_phase || run.seasonPhase || "regular") === fromSeasonPhase && String(run.status || "") === "published")
    .sort((a, b) => String(b.published_at || b.publishedAt || b.created_at || b.createdAt || "").localeCompare(String(a.published_at || a.publishedAt || a.created_at || a.createdAt || "")));
  const sourceRun = sourceRuns[0] || null;
  const sourceRunId = clean(sourceRun?.id);
  const sourceItems = sourceRunId
    ? (Array.isArray(allocationItems) ? allocationItems : []).filter((item) => clean(item.run_id || item.runId) === sourceRunId && String(item.status || "") === "published")
    : [];
  return Object.freeze({
    sourceRun,
    preferenceCount: copyPreferences ? sourcePreferences.length : 0,
    allocationCount: copyAllocations ? sourceItems.length : 0,
    ready: (copyPreferences && sourcePreferences.length > 0) || (copyAllocations && sourceItems.length > 0),
    warning: !sourceRun && copyAllocations ? "No published allocation exists for the selected source season." : "",
  });
}

export function seasonRolloverToPayload(value = {}) {
  return {
    from_season_phase: clean(value.fromSeasonPhase || "regular"),
    to_season_phase: clean(value.toSeasonPhase || "winter"),
    from_start_date: clean(value.fromStartDate) || null,
    from_end_date: clean(value.fromEndDate) || null,
    to_start_date: clean(value.toStartDate) || null,
    to_end_date: clean(value.toEndDate) || null,
    copy_preferences: value.copyPreferences !== false,
    copy_allocations: value.copyAllocations !== false,
  };
}
