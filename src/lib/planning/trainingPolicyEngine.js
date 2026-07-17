import { normaliseTime, timeToMinutes } from "./annualPlannerEngine.js";

export const DEFAULT_TRAINING_DAYS = Object.freeze([1, 2, 3, 4, 5]);
export const POLICY_SCOPE_OPTIONS = Object.freeze([
  { value: "club", label: "Club default" },
  { value: "team_type", label: "Team type" },
  { value: "age_group", label: "Age group" },
]);
export const COACH_EDIT_POLICY_OPTIONS = Object.freeze([
  { value: "approval", label: "Coach changes require approval" },
  { value: "immediate", label: "Valid coach changes apply immediately" },
  { value: "club_only", label: "Club managed only" },
]);

const VALID_SEASONS = new Set(["preseason", "regular", "winter"]);
const VALID_SCOPES = new Set(["club", "team_type", "age_group"]);
const VALID_AREA_MODES = new Set(["any", "named_area", "full_pitch"]);
const VALID_COACH_POLICIES = new Set(["approval", "immediate", "club_only"]);

function clean(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(list(values).map((value) => clean(value)).filter(Boolean))];
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseDays(value, fallback = DEFAULT_TRAINING_DAYS) {
  const days = [...new Set(list(value).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return days.length ? days : [...fallback];
}

export function teamPolicyAgeGroup(team = {}) {
  const explicit = clean(team.ageGroup || team.age_group || team.ageBand || team.age_band).toLowerCase();
  if (explicit) return explicit.replace(/\s+/g, "-");
  const name = clean(team.name || team.label).toLowerCase();
  const match = name.match(/\bu\s*-?\s*(\d{1,2})\b/i);
  if (match) return `u${match[1]}`;
  const order = finite(team.ageOrder ?? team.age_order, 99);
  if (order <= 4) return "foundation";
  if (order <= 8) return "youth";
  if (order <= 11) return "older-youth";
  return "adult";
}

export function teamPolicyType(team = {}) {
  const value = clean(team.teamType || team.team_type || team.type).toLowerCase();
  if (value) return value.replace(/\s+/g, "-");
  return teamPolicyAgeGroup(team) === "adult" ? "adult" : "youth";
}

export function normaliseTrainingSchedulingPolicy(row = {}, seasonPhase = "regular") {
  const season = clean(row.season_phase || row.seasonPhase || seasonPhase).toLowerCase();
  const scopeType = clean(row.scope_type || row.scopeType || "club").toLowerCase();
  const weekendAllowed = Boolean(row.weekend_allowed ?? row.weekendAllowed ?? false);
  let allowedDays = normaliseDays(row.allowed_days || row.allowedDays, DEFAULT_TRAINING_DAYS);
  if (!weekendAllowed) allowedDays = allowedDays.filter((day) => day !== 0 && day !== 6);
  if (!allowedDays.length) allowedDays = [...DEFAULT_TRAINING_DAYS];
  const earliest = normaliseTime(row.earliest_start_time || row.earliestStartTime || "17:00", "17:00");
  const latest = normaliseTime(row.latest_end_time || row.latestEndTime || "21:00", "21:00");
  return Object.freeze({
    id: clean(row.id),
    seasonPhase: VALID_SEASONS.has(season) ? season : "regular",
    scopeType: VALID_SCOPES.has(scopeType) ? scopeType : "club",
    scopeKey: clean(row.scope_key || row.scopeKey || "all").toLowerCase() || "all",
    allowedDays,
    weekendAllowed,
    preferredStartTimes: unique(row.preferred_start_times || row.preferredStartTimes || ["17:00", "18:00", "19:00", "20:00"]).map((time) => normaliseTime(time)),
    earliestStartTime: earliest,
    latestEndTime: timeToMinutes(latest) > timeToMinutes(earliest) ? latest : "21:00",
    defaultDurationMinutes: Math.max(30, Math.min(240, finite(row.default_duration_minutes ?? row.defaultDurationMinutes, 90))),
    minimumAreaMode: VALID_AREA_MODES.has(clean(row.minimum_area_mode || row.minimumAreaMode)) ? clean(row.minimum_area_mode || row.minimumAreaMode) : "any",
    sessionsPerWeek: Math.max(1, Math.min(7, finite(row.sessions_per_week ?? row.sessionsPerWeek, 1))),
    permittedPitchIds: unique(row.permitted_pitch_ids || row.permittedPitchIds),
    permittedWinterSiteIds: unique(row.permitted_winter_site_ids || row.permittedWinterSiteIds),
    coachEditPolicy: VALID_COACH_POLICIES.has(clean(row.coach_edit_policy || row.coachEditPolicy)) ? clean(row.coach_edit_policy || row.coachEditPolicy) : "approval",
    notes: clean(row.notes),
    inheritedFrom: clean(row.inherited_from || row.inheritedFrom),
  });
}

export function trainingSchedulingPolicyToPayload(policy = {}) {
  const normalised = normaliseTrainingSchedulingPolicy(policy, policy.seasonPhase);
  return {
    id: normalised.id || null,
    season_phase: normalised.seasonPhase,
    scope_type: normalised.scopeType,
    scope_key: normalised.scopeKey,
    allowed_days: normalised.allowedDays,
    weekend_allowed: normalised.weekendAllowed,
    preferred_start_times: normalised.preferredStartTimes,
    earliest_start_time: normalised.earliestStartTime,
    latest_end_time: normalised.latestEndTime,
    default_duration_minutes: normalised.defaultDurationMinutes,
    minimum_area_mode: normalised.minimumAreaMode,
    sessions_per_week: normalised.sessionsPerWeek,
    permitted_pitch_ids: normalised.permittedPitchIds,
    permitted_winter_site_ids: normalised.permittedWinterSiteIds,
    coach_edit_policy: normalised.coachEditPolicy,
    notes: normalised.notes || null,
  };
}

function policyRank(policy) {
  if (policy.scopeType === "club") return 0;
  if (policy.scopeType === "team_type") return 1;
  if (policy.scopeType === "age_group") return 2;
  return 0;
}

function policyMatches(policy, team) {
  if (policy.scopeType === "club") return true;
  if (policy.scopeType === "team_type") return policy.scopeKey === teamPolicyType(team);
  if (policy.scopeType === "age_group") return policy.scopeKey === teamPolicyAgeGroup(team);
  return false;
}

export function resolveTrainingSchedulingPolicy({ policies = [], team = {}, seasonPhase = "regular" } = {}) {
  const matching = list(policies)
    .map((row) => normaliseTrainingSchedulingPolicy(row, seasonPhase))
    .filter((policy) => policy.seasonPhase === seasonPhase && policyMatches(policy, team))
    .sort((a, b) => policyRank(a) - policyRank(b));
  let resolved = normaliseTrainingSchedulingPolicy({ seasonPhase, scopeType: "club", scopeKey: "all" }, seasonPhase);
  const sources = [];
  matching.forEach((policy) => {
    resolved = normaliseTrainingSchedulingPolicy({ ...resolved, ...policy }, seasonPhase);
    sources.push(policy.scopeType === "club" ? "Club default" : `${policy.scopeType === "age_group" ? "Age group" : "Team type"}: ${policy.scopeKey}`);
  });
  return Object.freeze({ ...resolved, sources, inheritedFrom: sources.join(" -> ") || "Built-in club defaults" });
}

export function applyPolicyToTrainingPreference(preference = {}, policy = {}, { preserveOverrides = true } = {}) {
  const normalisedPolicy = normaliseTrainingSchedulingPolicy(policy, preference.seasonPhase || policy.seasonPhase);
  const overrideFields = new Set(list(preference.overrideFields || preference.override_fields));
  const hasSavedRow = Boolean(preference.id || preference.team_key || preference.teamKey);
  const useValue = (field, current, fallback) => {
    if (preserveOverrides && (overrideFields.has(field) || (hasSavedRow && !overrideFields.size && current !== undefined && current !== null))) return current;
    return fallback;
  };
  const allowedDays = normalisedPolicy.allowedDays;
  const preferredDays = list(useValue("preferredDays", preference.preferredDays ?? preference.preferred_days, allowedDays)).map(Number).filter((day) => allowedDays.includes(day));
  const unavailableDays = list(useValue("unavailableDays", preference.unavailableDays ?? preference.unavailable_days, [])).map(Number).filter((day) => allowedDays.includes(day));
  return {
    ...preference,
    preferredDays: preferredDays.length ? [...new Set(preferredDays)] : [...allowedDays],
    preferredStartTimes: unique(useValue("preferredStartTimes", preference.preferredStartTimes ?? preference.preferred_start_times, normalisedPolicy.preferredStartTimes)).map((time) => normaliseTime(time)),
    unavailableDays: [...new Set(unavailableDays)],
    preferredPitchIds: unique(useValue("preferredPitchIds", preference.preferredPitchIds ?? preference.preferred_pitch_ids, [])),
    preferredWinterSiteIds: unique(useValue("preferredWinterSiteIds", preference.preferredWinterSiteIds ?? preference.preferred_winter_site_ids, [])),
    requiredDurationMinutes: Math.max(30, Math.min(240, finite(useValue("requiredDurationMinutes", preference.requiredDurationMinutes ?? preference.required_duration_minutes, normalisedPolicy.defaultDurationMinutes), normalisedPolicy.defaultDurationMinutes))),
    minimumAreaMode: clean(useValue("minimumAreaMode", preference.minimumAreaMode ?? preference.minimum_area_mode, normalisedPolicy.minimumAreaMode)) || normalisedPolicy.minimumAreaMode,
    allowedDays,
    weekendAllowed: normalisedPolicy.weekendAllowed,
    earliestStartTime: normalisedPolicy.earliestStartTime,
    latestEndTime: normalisedPolicy.latestEndTime,
    permittedPitchIds: normalisedPolicy.permittedPitchIds,
    permittedWinterSiteIds: normalisedPolicy.permittedWinterSiteIds,
    sessionsPerWeek: normalisedPolicy.sessionsPerWeek,
    coachEditPolicy: normalisedPolicy.coachEditPolicy,
    policySource: normalisedPolicy.inheritedFrom || normalisedPolicy.sources?.join(" -> ") || "Club defaults",
    overrideFields: [...overrideFields],
  };
}

export function validateTrainingPreferenceAgainstPolicy(preference = {}, policy = {}) {
  const resolved = normaliseTrainingSchedulingPolicy(policy, preference.seasonPhase || policy.seasonPhase);
  const errors = [];
  const allowed = new Set(resolved.allowedDays);
  list(preference.preferredDays).forEach((day) => { if (!allowed.has(Number(day))) errors.push(`Day ${Number(day)} is not permitted by the club`); });
  list(preference.unavailableDays).forEach((day) => { if (!allowed.has(Number(day))) errors.push(`Unavailable day ${Number(day)} is outside the club policy`); });
  list(preference.preferredStartTimes).forEach((time) => {
    const minutes = timeToMinutes(normaliseTime(time));
    if (minutes < timeToMinutes(resolved.earliestStartTime) || minutes >= timeToMinutes(resolved.latestEndTime)) errors.push(`${normaliseTime(time)} is outside the permitted time window`);
  });
  if (!resolved.weekendAllowed && list(preference.preferredDays).some((day) => [0, 6].includes(Number(day)))) errors.push("Weekend training is disabled by the club");
  if (resolved.permittedPitchIds.length && list(preference.preferredPitchIds).some((id) => !resolved.permittedPitchIds.includes(clean(id)))) errors.push("A selected pitch is not permitted by the club");
  if (resolved.permittedWinterSiteIds.length && list(preference.preferredWinterSiteIds).some((id) => !resolved.permittedWinterSiteIds.includes(clean(id)))) errors.push("A selected winter site is not permitted by the club");
  return [...new Set(errors)];
}

export function coachTrainingPreferenceToPayload(preference = {}) {
  return {
    team_key: clean(preference.teamKey),
    team_name: clean(preference.teamName),
    season_phase: clean(preference.seasonPhase || "regular"),
    preferred_days: list(preference.preferredDays).map(Number),
    preferred_start_times: unique(preference.preferredStartTimes).map((time) => normaliseTime(time)),
    unavailable_days: list(preference.unavailableDays).map(Number),
    preferred_pitch_ids: unique(preference.preferredPitchIds),
    preferred_winter_site_ids: unique(preference.preferredWinterSiteIds),
    required_duration_minutes: Math.max(30, Math.min(240, finite(preference.requiredDurationMinutes, 90))),
    minimum_area_mode: clean(preference.minimumAreaMode || "any"),
    notes: clean(preference.notes) || null,
    override_fields: ["preferredDays", "preferredStartTimes", "unavailableDays", "preferredPitchIds", "preferredWinterSiteIds", "requiredDurationMinutes", "minimumAreaMode", "notes"],
  };
}

export function policyScopeLabel(policy = {}) {
  const normalised = normaliseTrainingSchedulingPolicy(policy, policy.seasonPhase);
  if (normalised.scopeType === "club") return "Club default";
  return `${normalised.scopeType === "age_group" ? "Age group" : "Team type"}: ${normalised.scopeKey}`;
}
