import {
  FULL_PITCH_AREA_ID,
  FULL_PITCH_AREA_LABEL,
  normaliseAnnualBooking,
  normaliseDateKey,
  normaliseTime,
  pitchAreaOptions,
  timeToMinutes,
} from "./annualPlannerEngine.js";
import {
  applyPolicyToTrainingPreference,
  resolveTrainingSchedulingPolicy,
} from "./trainingPolicyEngine.js";

export const SMART_ALLOCATION_MODES = Object.freeze([
  { value: "manual", label: "Manual", detail: "Keep control; Ground Control only recommends and validates." },
  { value: "assisted", label: "Assisted", detail: "Create explainable suggestions for operator approval." },
  { value: "automatic", label: "Automatic draft", detail: "Build a complete draft, never publish it automatically." },
]);

export const TEAM_ALLOCATION_MODE_OPTIONS = Object.freeze([
  { value: "inherit", label: "Follow allocation run", detail: "Use the Manual, Assisted or Automatic Draft mode selected for this season run." },
  ...SMART_ALLOCATION_MODES,
]);

export const SEASON_PHASE_OPTIONS = Object.freeze([
  { value: "preseason", label: "Pre-season / summer" },
  { value: "regular", label: "Regular season" },
  { value: "winter", label: "Winter training" },
]);

const ACTIVE_STATUSES = new Set(["requested", "provisional", "confirmed", "completed"]);
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clean(value) {
  return String(value ?? "").trim();
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(array(values).map((value) => clean(value)).filter(Boolean))];
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function teamKey(team = {}, index = 0) {
  return clean(team.key || team.id || team.teamKey || team.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `team-${index + 1}`;
}

function teamName(team = {}, index = 0) {
  return clean(team.name || team.label) || `Team ${index + 1}`;
}

function timeOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(endA) > timeToMinutes(startB);
}

function bookingDayOfWeek(booking = {}) {
  const date = new Date(booking.startAt || booking.start_at || `${booking.startDate || booking.start_date}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getDay();
}

function ageBand(team = {}) {
  const order = finite(team.ageOrder, 99);
  const type = clean(team.teamType).toLowerCase();
  if (["adult", "women", "veterans"].includes(type) || order >= 11) return "adult";
  if (order <= 4) return "young";
  if (order <= 8) return "middle";
  return "older_youth";
}

function preferredAgeStart(team = {}) {
  const band = ageBand(team);
  if (band === "young") return 17 * 60;
  if (band === "middle") return 18 * 60;
  if (band === "older_youth") return 19 * 60;
  return 20 * 60;
}

function formatRank(format) {
  const value = clean(format).toLowerCase();
  if (value.includes("3v3")) return 1;
  if (value.includes("5v5")) return 2;
  if (value.includes("7v7")) return 3;
  if (value.includes("9v9")) return 4;
  if (value.includes("11v11")) return 5;
  return 0;
}

function resourceFormatScore(team = {}, pitch = {}) {
  const teamRank = formatRank(team.format);
  const pitchRank = formatRank(pitch.format);
  if (!pitchRank || !teamRank) return { score: 4, reason: "Pitch format is flexible" };
  if (pitchRank === teamRank) return { score: 14, reason: "Pitch format matches the team" };
  if (pitchRank > teamRank) return { score: 7, reason: "Pitch is large enough for the team format" };
  return { score: -35, reason: "Pitch format is smaller than the team requires", warning: true };
}

function defaultPreference(team = {}, index = 0, seasonPhase = "regular") {
  const fallbackDay = clean(team.trainingDay || team.preferredTrainingDay);
  const dayNumber = DAY_LABELS.findIndex((day) => day.toLowerCase() === fallbackDay.toLowerCase());
  return {
    id: "",
    teamKey: teamKey(team, index),
    teamName: teamName(team, index),
    seasonPhase,
    allocationMode: "inherit",
    preferredDays: dayNumber >= 0 ? [dayNumber] : [],
    preferredStartTimes: unique([team.trainingTime || team.preferredTrainingTime]),
    unavailableDays: [],
    preferredPitchIds: unique([team.trainingPitch || team.defaultPitch]),
    preferredWinterSiteIds: [],
    requiredDurationMinutes: Math.max(30, finite(team.trainingDurationMinutes, 90)),
    minimumAreaMode: "any",
    priorityWeight: Math.max(1, finite(team.trainingPriority, 50)),
    keepCurrentAllocation: Boolean(team.keepTrainingAllocation),
    manualOnly: false,
    notes: "",
  };
}

export function normaliseTrainingPreference(row = {}, team = {}, index = 0, seasonPhase = "regular", policy = {}) {
  const fallback = defaultPreference(team, index, seasonPhase);
  const days = array(row.preferred_days || row.preferredDays).map(Number).filter((day) => day >= 0 && day <= 6);
  const unavailable = array(row.unavailable_days || row.unavailableDays).map(Number).filter((day) => day >= 0 && day <= 6);
  const mode = clean(row.allocation_mode || row.allocationMode || fallback.allocationMode).toLowerCase();
  const normalised = {
    id: clean(row.id),
    teamKey: clean(row.team_key || row.teamKey || fallback.teamKey),
    teamName: clean(row.team_name || row.teamName || fallback.teamName),
    seasonPhase: clean(row.season_phase || row.seasonPhase || seasonPhase).toLowerCase(),
    allocationMode: ["inherit", "manual", "assisted", "automatic"].includes(mode) ? mode : "inherit",
    preferredDays: [...new Set(days)],
    preferredStartTimes: unique(row.preferred_start_times || row.preferredStartTimes).map((time) => normaliseTime(time)),
    unavailableDays: [...new Set(unavailable)],
    preferredPitchIds: unique(row.preferred_pitch_ids || row.preferredPitchIds),
    preferredWinterSiteIds: unique(row.preferred_winter_site_ids || row.preferredWinterSiteIds),
    requiredDurationMinutes: Math.max(30, Math.min(240, finite(row.required_duration_minutes ?? row.requiredDurationMinutes, fallback.requiredDurationMinutes))),
    minimumAreaMode: ["any", "named_area", "full_pitch"].includes(clean(row.minimum_area_mode || row.minimumAreaMode)) ? clean(row.minimum_area_mode || row.minimumAreaMode) : "any",
    priorityWeight: Math.max(1, Math.min(100, finite(row.priority_weight ?? row.priorityWeight, fallback.priorityWeight))),
    keepCurrentAllocation: Boolean(row.keep_current_allocation ?? row.keepCurrentAllocation ?? fallback.keepCurrentAllocation),
    manualOnly: Boolean(row.manual_only ?? row.manualOnly ?? fallback.manualOnly),
    notes: clean(row.notes),
    overrideFields: array(row.override_fields || row.overrideFields),
  };
  return Object.freeze(applyPolicyToTrainingPreference(normalised, policy));
}

export function trainingPreferenceToPayload(preference = {}) {
  return {
    id: preference.id || null,
    team_key: clean(preference.teamKey),
    team_name: clean(preference.teamName),
    season_phase: clean(preference.seasonPhase || "regular"),
    allocation_mode: clean(preference.allocationMode || "inherit"),
    preferred_days: array(preference.preferredDays).map(Number),
    preferred_start_times: unique(preference.preferredStartTimes).map((time) => normaliseTime(time)),
    unavailable_days: array(preference.unavailableDays).map(Number),
    preferred_pitch_ids: unique(preference.preferredPitchIds),
    preferred_winter_site_ids: unique(preference.preferredWinterSiteIds),
    required_duration_minutes: Math.max(30, finite(preference.requiredDurationMinutes, 90)),
    minimum_area_mode: clean(preference.minimumAreaMode || "any"),
    priority_weight: Math.max(1, finite(preference.priorityWeight, 50)),
    keep_current_allocation: Boolean(preference.keepCurrentAllocation),
    manual_only: Boolean(preference.manualOnly),
    notes: clean(preference.notes) || null,
    override_fields: array(preference.overrideFields).length ? array(preference.overrideFields) : [
      "allocationMode", "preferredDays", "preferredStartTimes", "unavailableDays", "preferredPitchIds", "preferredWinterSiteIds",
      "requiredDurationMinutes", "minimumAreaMode", "priorityWeight", "keepCurrentAllocation", "manualOnly", "notes",
    ],
  };
}

function historicalAllocations(bookings = [], seasonPhase = "regular") {
  const byTeam = new Map();
  array(bookings).map(normaliseAnnualBooking).filter((booking) =>
    booking.bookingType === "training" && ACTIVE_STATUSES.has(booking.status) && booking.teamKey && booking.seasonPhase === seasonPhase,
  ).forEach((booking) => {
    const key = clean(booking.teamKey).toLowerCase();
    const row = {
      dayOfWeek: bookingDayOfWeek(booking),
      startTime: booking.startTime,
      pitchId: booking.pitchId,
      pitchAreaId: booking.pitchAreaId,
      siteInventoryId: booking.siteInventoryId,
      siteSlotId: booking.siteSlotId,
    };
    const current = byTeam.get(key) || [];
    current.push(row);
    byTeam.set(key, current);
  });
  return byTeam;
}

function primaryHistorical(rows = []) {
  const counts = new Map();
  rows.forEach((row) => {
    const key = [row.dayOfWeek, row.startTime, row.pitchId, row.pitchAreaId, row.siteSlotId].join("|");
    const current = counts.get(key) || { count: 0, row };
    current.count += 1;
    counts.set(key, current);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.row || null;
}

function candidateEnd(startTime, durationMinutes) {
  const minutes = timeToMinutes(startTime) + durationMinutes;
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function candidateKey(candidate = {}) {
  return [candidate.dayOfWeek, candidate.startTime, candidate.endTime, candidate.pitchId, candidate.pitchAreaId, candidate.siteSlotId].join("|");
}

function resourceConflict(candidate, other) {
  if (candidate.dayOfWeek !== other.dayOfWeek || !timeOverlap(candidate.startTime, candidate.endTime, other.startTime, other.endTime)) return false;
  if (candidate.siteSlotId || other.siteSlotId) return Boolean(candidate.siteSlotId && candidate.siteSlotId === other.siteSlotId);
  if (!candidate.pitchId || candidate.pitchId !== other.pitchId) return false;
  const candidateFull = !candidate.pitchAreaId || candidate.pitchAreaId === FULL_PITCH_AREA_ID;
  const otherFull = !other.pitchAreaId || other.pitchAreaId === FULL_PITCH_AREA_ID;
  return candidateFull || otherFull || candidate.pitchAreaId === other.pitchAreaId;
}

function resourceAtCapacity(candidate, rows = []) {
  const overlaps = rows.filter((other) => resourceConflict(candidate, other));
  if (candidate.siteSlotId) return overlaps.length >= Math.max(1, finite(candidate.capacity, 1));
  return overlaps.length > 0;
}

function existingWeeklyResources(bookings = [], seasonPhase, startDate, endDate) {
  const start = normaliseDateKey(startDate);
  const end = normaliseDateKey(endDate);
  return array(bookings).map(normaliseAnnualBooking).filter((booking) => {
    if (!ACTIVE_STATUSES.has(booking.status)) return false;
    if (booking.seasonPhase !== seasonPhase) return false;
    if (start && booking.startDate < start) return false;
    if (end && booking.startDate > end) return false;
    return booking.bookingType === "training";
  }).map((booking) => ({
    id: booking.id,
    teamKey: clean(booking.teamKey).toLowerCase(),
    dayOfWeek: bookingDayOfWeek(booking),
    startTime: booking.startTime,
    endTime: booking.endTime,
    pitchId: booking.pitchId,
    pitchAreaId: booking.pitchAreaId,
    siteSlotId: booking.siteSlotId,
    source: "existing",
  }));
}

function coachMap(assignments = []) {
  const map = new Map();
  array(assignments).filter((assignment) => clean(assignment.status || "active") === "active").forEach((assignment) => {
    const key = clean(assignment.team_key || assignment.teamKey).toLowerCase();
    const personId = clean(assignment.person_id || assignment.personId);
    if (!key || !personId) return;
    const people = map.get(key) || new Set();
    people.add(personId);
    map.set(key, people);
  });
  return map;
}

function coachSetsOverlap(first = new Set(), second = new Set()) {
  for (const personId of first) if (second.has(personId)) return true;
  return false;
}

function regularCandidates({ preference, pitches, startTimes }) {
  const allowedDays = preference.allowedDays?.length ? preference.allowedDays : [1, 2, 3, 4, 5];
  const preferred = preference.preferredDays.filter((day) => allowedDays.includes(day));
  const days = preferred.length ? preferred : allowedDays;
  const rawTimes = unique([...(preference.preferredStartTimes || []), ...(startTimes || [])]);
  const times = rawTimes.filter((startTime) => {
    const start = timeToMinutes(startTime);
    const end = start + preference.requiredDurationMinutes;
    return start >= timeToMinutes(preference.earliestStartTime || "00:00") && end <= timeToMinutes(preference.latestEndTime || "23:59");
  });
  const permittedPitchIds = preference.permittedPitchIds || [];
  const candidates = [];
  array(pitches).filter((pitch) => !permittedPitchIds.length || permittedPitchIds.includes(clean(pitch.id))).forEach((pitch) => {
    const options = pitchAreaOptions(pitch, { includeFullPitch: true });
    let allocations = options.length ? options : [{ id: FULL_PITCH_AREA_ID, label: FULL_PITCH_AREA_LABEL }];
    if (preference.minimumAreaMode === "full_pitch") allocations = allocations.filter((area) => area.id === FULL_PITCH_AREA_ID);
    if (preference.minimumAreaMode === "named_area") allocations = allocations.filter((area) => area.id !== FULL_PITCH_AREA_ID);
    allocations.forEach((area) => days.forEach((dayOfWeek) => times.forEach((startTime) => {
      if (preference.unavailableDays.includes(dayOfWeek)) return;
      candidates.push({
        dayOfWeek,
        startTime: normaliseTime(startTime),
        endTime: candidateEnd(startTime, preference.requiredDurationMinutes),
        pitchId: clean(pitch.id),
        pitchName: clean(pitch.label || pitch.id),
        pitchAreaId: area.id,
        pitchAreaName: area.label,
        siteInventoryId: "",
        siteSlotId: "",
        siteName: clean(pitch.siteLabel || pitch.siteName),
        resourceLabel: `${clean(pitch.label || pitch.id)} · ${area.label}`,
        resource: pitch,
      });
    })));
  });
  return candidates;
}

function winterCandidates({ preference, winterSites, winterSlots }) {
  const siteMap = new Map(array(winterSites).map((site) => [clean(site.id), site]));
  const allowedDays = preference.allowedDays?.length ? preference.allowedDays : [1, 2, 3, 4, 5];
  const permittedSiteIds = preference.permittedWinterSiteIds || [];
  return array(winterSlots).filter((slot) => slot.active !== false).map((slot) => {
    const siteId = clean(slot.site_id || slot.siteId);
    const site = siteMap.get(siteId) || {};
    return {
      dayOfWeek: Number(slot.day_of_week ?? slot.dayOfWeek),
      startTime: normaliseTime(slot.start_time || slot.startTime),
      endTime: normaliseTime(slot.end_time || slot.endTime, "19:00"),
      pitchId: `winter-slot:${clean(slot.id)}`,
      pitchName: clean(site.name) || "Winter site",
      pitchAreaId: clean(slot.area_name || slot.areaName || slot.label),
      pitchAreaName: clean(slot.area_name || slot.areaName || slot.label),
      siteInventoryId: siteId,
      siteSlotId: clean(slot.id),
      siteName: clean(site.name),
      resourceLabel: `${clean(site.name) || "Winter site"} · ${clean(slot.label || slot.area_name || slot.areaName) || "Training slot"}`,
      capacity: Math.max(1, finite(slot.capacity, 1)),
      costPence: Math.max(0, finite(slot.cost_pence ?? slot.costPence ?? site.cost_pence ?? site.costPence, 0)),
      resource: slot,
      site,
    };
  }).filter((candidate) => {
    if (!allowedDays.includes(candidate.dayOfWeek) || preference.unavailableDays.includes(candidate.dayOfWeek)) return false;
    if (permittedSiteIds.length && !permittedSiteIds.includes(candidate.siteInventoryId)) return false;
    return timeToMinutes(candidate.startTime) >= timeToMinutes(preference.earliestStartTime || "00:00") && timeToMinutes(candidate.endTime) <= timeToMinutes(preference.latestEndTime || "23:59");
  });
}

function scoreCandidate({ candidate, team, preference, history, seasonPhase }) {
  let score = 50;
  const reasons = [];
  const warnings = [];
  if (preference.preferredDays.includes(candidate.dayOfWeek)) { score += 24; reasons.push("Preferred training day"); }
  if (preference.preferredStartTimes.includes(candidate.startTime)) { score += 24; reasons.push("Preferred start time"); }
  if (seasonPhase === "winter") {
    if (preference.preferredWinterSiteIds.includes(candidate.siteInventoryId)) { score += 22; reasons.push("Preferred winter site"); }
  } else {
    if (candidate.pitchAreaId && candidate.pitchAreaId !== FULL_PITCH_AREA_ID && preference.minimumAreaMode !== "full_pitch") {
      score += 9;
      reasons.push("Uses shared training capacity efficiently");
    } else if (candidate.pitchAreaId === FULL_PITCH_AREA_ID && preference.minimumAreaMode === "any") {
      score -= 6;
    }
    if (preference.preferredPitchIds.includes(candidate.pitchId)) { score += 20; reasons.push("Preferred or usual pitch"); }
    const format = resourceFormatScore(team, candidate.resource);
    score += format.score;
    if (format.warning) warnings.push(format.reason); else reasons.push(format.reason);
  }
  const preferredMinutes = preferredAgeStart(team);
  const difference = Math.abs(timeToMinutes(candidate.startTime) - preferredMinutes);
  if (difference <= 30) { score += 16; reasons.push("Start time suits the age group"); }
  else if (difference <= 60) score += 8;
  else if (difference >= 150) { score -= 12; warnings.push("Start time is far from the recommended age-group window"); }
  if (history) {
    if (history.dayOfWeek === candidate.dayOfWeek) { score += 16; reasons.push("Matches the team's historic training day"); }
    if (history.startTime === candidate.startTime) { score += 16; reasons.push("Matches the team's historic start time"); }
    if ((seasonPhase === "winter" && history.siteSlotId === candidate.siteSlotId) || (seasonPhase !== "winter" && history.pitchId === candidate.pitchId && history.pitchAreaId === candidate.pitchAreaId)) {
      score += 22;
      reasons.push("Keeps the team's existing allocation");
    }
  }
  score += Math.round((preference.priorityWeight - 50) / 10);
  if (seasonPhase === "winter" && candidate.costPence > 0) {
    score -= Math.min(12, Math.round(candidate.costPence / 1000));
    reasons.push("External slot cost considered");
  }
  return { score, reasons: unique(reasons), warnings: unique(warnings) };
}

function confidenceFor(score, gap) {
  if (score >= 105 && gap >= 12) return "high";
  if (score >= 82 && gap >= 5) return "medium";
  return "low";
}

function allocationSlotKey(candidate = {}) {
  return [candidate.dayOfWeek, candidate.startTime].join("|");
}

function candidateFromAllocationItem(item = {}) {
  return {
    dayOfWeek: item.dayOfWeek ?? item.day_of_week ?? null,
    startTime: clean(item.startTime || item.start_time),
    endTime: clean(item.endTime || item.end_time),
    pitchId: clean(item.pitchId || item.pitch_id),
    pitchName: clean(item.pitchName || item.pitch_name),
    pitchAreaId: clean(item.pitchAreaId || item.pitch_area_id),
    pitchAreaName: clean(item.pitchAreaName || item.pitch_area_name),
    siteInventoryId: clean(item.siteInventoryId || item.site_inventory_id),
    siteSlotId: clean(item.siteSlotId || item.site_slot_id),
    siteName: clean(item.siteName || item.site_name),
    resourceLabel: clean(item.resourceLabel || item.resource_label) || "Pinned allocation",
  };
}

function sameAllocation(first = {}, second = {}) {
  if (!first || !second) return false;
  return Number(first.dayOfWeek) === Number(second.dayOfWeek)
    && clean(first.startTime) === clean(second.startTime)
    && clean(first.pitchId) === clean(second.pitchId)
    && clean(first.pitchAreaId) === clean(second.pitchAreaId)
    && clean(first.siteSlotId) === clean(second.siteSlotId);
}

function preferenceMatch(candidate, preference, seasonPhase) {
  if (!candidate) return false;
  const dayMatched = !preference.preferredDays.length || preference.preferredDays.includes(candidate.dayOfWeek);
  const timeMatched = !preference.preferredStartTimes.length || preference.preferredStartTimes.includes(candidate.startTime);
  const resourceMatched = seasonPhase === "winter"
    ? !preference.preferredWinterSiteIds.length || preference.preferredWinterSiteIds.includes(candidate.siteInventoryId)
    : !preference.preferredPitchIds.length || preference.preferredPitchIds.includes(candidate.pitchId);
  return dayMatched && timeMatched && resourceMatched;
}

function unassignedDiagnostics(candidates = [], ranked = []) {
  if (!candidates.length) {
    return ["No eligible facility falls inside the permitted club days, times and space rules"];
  }
  const resourceBusy = ranked.filter((candidate) => candidate.warnings.includes("Resource is already allocated")).length;
  const coachBusy = ranked.filter((candidate) => candidate.warnings.includes("Coach is already allocated to another team")).length;
  const teamBusy = ranked.filter((candidate) => candidate.warnings.includes("Team already has an overlapping training allocation")).length;
  const diagnostics = [];
  if (resourceBusy) diagnostics.push(`${resourceBusy} candidate slot${resourceBusy === 1 ? " was" : "s were"} blocked by facility capacity`);
  if (coachBusy) diagnostics.push(`${coachBusy} candidate slot${coachBusy === 1 ? " was" : "s were"} blocked by a shared-coach clash`);
  if (teamBusy) diagnostics.push(`${teamBusy} candidate slot${teamBusy === 1 ? " was" : "s were"} overlapped an existing team allocation`);
  return diagnostics.length ? diagnostics : ["No conflict-free candidate matched the current master rules and team preferences"];
}

function fairnessScore(items = []) {
  const counts = new Map();
  items.filter((item) => item.status !== "unassigned").forEach((item) => {
    const key = allocationSlotKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const values = [...counts.values()];
  if (!values.length) return 100;
  if (values.length === 1) return values[0] <= 1 ? 100 : Math.max(0, 100 - ((values[0] - 1) * 25));
  const max = Math.max(...values);
  const min = Math.min(...values);
  return Math.max(0, Math.round(100 - ((max - min) / Math.max(1, max)) * 100));
}

export function buildSmartTrainingAllocationDraft({
  teams = [],
  pitches = [],
  winterSites = [],
  winterSlots = [],
  bookings = [],
  preferences = [],
  assignments = [],
  policies = [],
  seasonPhase = "regular",
  mode = "assisted",
  startDate,
  endDate,
  defaultStartTimes = ["17:00", "18:00", "19:00", "20:00"],
  lockedItems = [],
  baselineItems = [],
  fairnessEnabled = true,
  compareHistory = true,
} = {}) {
  const preferenceMap = new Map(array(preferences).filter((row) => clean(row.season_phase || row.seasonPhase || seasonPhase) === seasonPhase).map((row) => [clean(row.team_key || row.teamKey).toLowerCase(), row]));
  const historyMap = historicalAllocations(bookings, seasonPhase);
  const coachByTeam = coachMap(assignments);
  const existing = existingWeeklyResources(bookings, seasonPhase, startDate, endDate);
  const lockedMap = new Map(array(lockedItems).filter((item) => item?.locked && clean(item.teamKey || item.team_key)).map((item) => [clean(item.teamKey || item.team_key).toLowerCase(), item]));
  const baselineMap = new Map(array(baselineItems).filter((item) => clean(item.teamKey || item.team_key)).map((item) => [clean(item.teamKey || item.team_key).toLowerCase(), candidateFromAllocationItem(item)]));
  const allocated = [];
  const slotLoads = new Map();
  const results = [];
  const orderedTeams = array(teams).map((team, index) => ({ team, index, key: teamKey(team, index) })).sort((a, b) => {
    const prefA = normaliseTrainingPreference(preferenceMap.get(a.key) || {}, a.team, a.index, seasonPhase, resolveTrainingSchedulingPolicy({ policies, team: a.team, seasonPhase }));
    const prefB = normaliseTrainingPreference(preferenceMap.get(b.key) || {}, b.team, b.index, seasonPhase, resolveTrainingSchedulingPolicy({ policies, team: b.team, seasonPhase }));
    return prefB.priorityWeight - prefA.priorityWeight || finite(a.team.ageOrder, 99) - finite(b.team.ageOrder, 99);
  });

  orderedTeams.forEach(({ team, index, key }) => {
    const policy = resolveTrainingSchedulingPolicy({ policies, team, seasonPhase });
    const preference = normaliseTrainingPreference(preferenceMap.get(key) || {}, team, index, seasonPhase, policy);
    const teamMode = preference.manualOnly ? "manual" : (preference.allocationMode === "inherit" ? mode : preference.allocationMode);
    const history = primaryHistorical(historyMap.get(key) || []) || baselineMap.get(key) || null;
    const coachIds = coachByTeam.get(key) || new Set();
    const pinned = lockedMap.get(key);

    if (pinned && teamMode !== "manual") {
      const candidate = candidateFromAllocationItem(pinned);
      const changed = compareHistory && history ? !sameAllocation(candidate, history) : false;
      const item = {
        ...pinned,
        teamKey: key,
        teamName: teamName(team, index),
        seasonPhase,
        mode: teamMode,
        status: teamMode === "automatic" ? "proposed" : "suggested",
        locked: true,
        confidence: clean(pinned.confidence) || "high",
        reasons: unique([...(pinned.reasons || []), "Pinned by the operator and preserved during rebuild", `Policy: ${preference.policySource}`]),
        warnings: array(pinned.warnings),
        policySource: preference.policySource,
        preferenceMatched: preferenceMatch(candidate, preference, seasonPhase),
        changedFromHistoric: changed,
        historicAllocation: history,
        alternatives: array(pinned.alternatives),
        preference,
      };
      results.push(item);
      allocated.push({ ...candidate, teamKey: key, coachIds });
      slotLoads.set(allocationSlotKey(candidate), (slotLoads.get(allocationSlotKey(candidate)) || 0) + 1);
      return;
    }

    const candidates = seasonPhase === "winter"
      ? winterCandidates({ preference, winterSites, winterSlots })
      : regularCandidates({ preference, pitches, startTimes: unique(defaultStartTimes).map((time) => normaliseTime(time)) });
    const ranked = candidates.map((candidate) => {
      const score = scoreCandidate({ candidate, team, preference, history, seasonPhase });
      const resourceBusy = resourceAtCapacity(candidate, [...existing, ...allocated]);
      const coachBusy = coachIds.size > 0 && allocated.some((other) => coachSetsOverlap(other.coachIds, coachIds) && other.dayOfWeek === candidate.dayOfWeek && timeOverlap(other.startTime, other.endTime, candidate.startTime, candidate.endTime));
      const sameTeamExisting = existing.some((other) => other.teamKey === key && other.dayOfWeek === candidate.dayOfWeek && timeOverlap(other.startTime, other.endTime, candidate.startTime, candidate.endTime));
      const blocked = resourceBusy || coachBusy || sameTeamExisting;
      const load = slotLoads.get(allocationSlotKey(candidate)) || 0;
      const fairnessPenalty = fairnessEnabled ? load * 28 : 0;
      return {
        ...candidate,
        score: score.score - fairnessPenalty - (blocked ? 500 : 0),
        rawScore: score.score - fairnessPenalty,
        reasons: unique([...(score.reasons || []), ...(fairnessPenalty > 0 ? ["Balances demand across heavily used start times"] : [])]),
        warnings: [...score.warnings, ...(resourceBusy ? ["Resource is already allocated"] : []), ...(coachBusy ? ["Coach is already allocated to another team"] : []), ...(sameTeamExisting ? ["Team already has an overlapping training allocation"] : [])],
        available: !blocked,
      };
    }).sort((a, b) => b.score - a.score || candidateKey(a).localeCompare(candidateKey(b)));
    const available = ranked.filter((candidate) => candidate.available);
    const selected = available[0] || null;
    const next = available[1] || null;
    const status = !selected ? "unassigned" : teamMode === "manual" ? "recommendation" : teamMode === "automatic" ? "proposed" : "suggested";
    const changed = compareHistory && selected && history ? !sameAllocation(selected, history) : false;
    const item = {
      id: "",
      teamKey: key,
      teamName: teamName(team, index),
      seasonPhase,
      mode: teamMode,
      status,
      locked: Boolean(preference.keepCurrentAllocation && selected && selected.reasons.includes("Keeps the team's existing allocation")),
      confidence: selected ? confidenceFor(selected.rawScore, selected.rawScore - finite(next?.rawScore, 0)) : "none",
      score: selected?.rawScore || 0,
      dayOfWeek: selected?.dayOfWeek ?? null,
      startTime: selected?.startTime || "",
      endTime: selected?.endTime || "",
      pitchId: selected?.pitchId || "",
      pitchName: selected?.pitchName || "",
      pitchAreaId: selected?.pitchAreaId || "",
      pitchAreaName: selected?.pitchAreaName || "",
      siteInventoryId: selected?.siteInventoryId || "",
      siteSlotId: selected?.siteSlotId || "",
      siteName: selected?.siteName || "",
      resourceLabel: selected?.resourceLabel || "No suitable slot",
      reasons: selected ? unique([...(selected.reasons || []), `Policy: ${preference.policySource}`]) : [],
      warnings: selected?.warnings || unassignedDiagnostics(candidates, ranked),
      policySource: preference.policySource,
      allowedDays: preference.allowedDays,
      weekendAllowed: preference.weekendAllowed,
      preferenceMatched: preferenceMatch(selected, preference, seasonPhase),
      changedFromHistoric: changed,
      historicAllocation: history,
      manualOverride: false,
      alternatives: available.slice(1, 4).map((candidate) => ({
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        pitchId: candidate.pitchId,
        pitchName: candidate.pitchName,
        pitchAreaId: candidate.pitchAreaId,
        pitchAreaName: candidate.pitchAreaName,
        siteInventoryId: candidate.siteInventoryId,
        siteSlotId: candidate.siteSlotId,
        siteName: candidate.siteName,
        resourceLabel: candidate.resourceLabel,
        score: candidate.rawScore,
        reasons: candidate.reasons,
      })),
      preference,
    };
    results.push(item);
    if (selected && teamMode !== "manual") {
      allocated.push({ ...selected, teamKey: key, coachIds });
      slotLoads.set(allocationSlotKey(selected), (slotLoads.get(allocationSlotKey(selected)) || 0) + 1);
    }
  });

  const assigned = results.filter((item) => item.status !== "unassigned").length;
  const unassigned = results.length - assigned;
  const confidenceValues = results.filter((item) => item.score > 0).map((item) => item.score);
  const averageScore = confidenceValues.length ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length) : 0;
  const preferenceMatches = results.filter((item) => item.status !== "unassigned" && item.preferenceMatched).length;
  const comparable = results.filter((item) => item.status !== "unassigned" && item.historicAllocation);
  return Object.freeze({
    mode,
    seasonPhase,
    startDate: normaliseDateKey(startDate),
    endDate: normaliseDateKey(endDate),
    fairnessEnabled,
    compareHistory,
    items: results,
    summary: {
      teams: results.length,
      assigned,
      unassigned,
      locked: results.filter((item) => item.locked).length,
      highConfidence: results.filter((item) => item.confidence === "high").length,
      mediumConfidence: results.filter((item) => item.confidence === "medium").length,
      lowConfidence: results.filter((item) => item.confidence === "low").length,
      averageScore,
      preferenceSuccessPct: assigned ? Math.round((preferenceMatches / assigned) * 100) : 0,
      changedFromHistoric: comparable.filter((item) => item.changedFromHistoric).length,
      comparableHistoricTeams: comparable.length,
      primeSlotFairnessPct: fairnessScore(results),
      manualOverrides: results.filter((item) => item.manualOverride).length,
      publishable: results.length > 0 && unassigned === 0 && mode !== "manual" && results.every((item) => ["suggested", "proposed"].includes(item.status)),
    },
  });
}

export function allocationRunToPayload(run = {}) {
  return {
    id: run.id || null,
    season_phase: clean(run.seasonPhase || "regular"),
    mode: clean(run.mode || "assisted"),
    status: clean(run.status || "draft"),
    start_date: normaliseDateKey(run.startDate),
    end_date: normaliseDateKey(run.endDate),
    default_start_times: unique(run.defaultStartTimes || []),
    summary: run.summary && typeof run.summary === "object" ? run.summary : {},
  };
}

export function allocationItemToPayload(item = {}) {
  return {
    id: item.id || null,
    team_key: clean(item.teamKey),
    team_name: clean(item.teamName),
    status: clean(item.status || "suggested"),
    locked: Boolean(item.locked),
    confidence: clean(item.confidence || "low"),
    score: finite(item.score, 0),
    day_of_week: item.dayOfWeek == null ? null : Number(item.dayOfWeek),
    start_time: item.startTime || null,
    end_time: item.endTime || null,
    pitch_id: clean(item.pitchId) || null,
    pitch_name: clean(item.pitchName) || null,
    pitch_area_id: clean(item.pitchAreaId) || null,
    pitch_area_name: clean(item.pitchAreaName) || null,
    site_inventory_id: clean(item.siteInventoryId) || null,
    site_slot_id: clean(item.siteSlotId) || null,
    reasons: array(item.reasons),
    warnings: array(item.warnings),
    alternatives: array(item.alternatives),
  };
}

export function allocationDayLabel(dayOfWeek) {
  return DAY_LABELS[Number(dayOfWeek)] || "Unassigned";
}
