import { neutraliseSpreadsheetFormula } from "../export/spreadsheetSafety.js";
import { buildOperationalEvidence, normaliseSavedHistory } from "../engines/operationalEvidenceEngine.js";
import { bookingDurationMinutes, normaliseAnnualBooking, normaliseAnnualBlackout } from "../planning/annualPlannerEngine.js";

const ACTIVE_PLANNER_STATUSES = new Set(["requested", "provisional", "confirmed", "completed"]);
const DELIVERED_PLANNER_STATUSES = new Set(["completed"]);
const CANCELLED_PLANNER_STATUSES = new Set(["cancelled", "rejected"]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(number(value) * factor) / factor;
}

function dateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate(value) {
  const key = dateKey(value);
  if (!key) return null;
  const result = new Date(`${key}T12:00:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function timeMinutes(value, fallback = null) {
  const match = text(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function normaliseStatus(value, disruptionStatus = "") {
  const status = text(value).toLowerCase();
  const disruption = text(disruptionStatus).toLowerCase();
  if (CANCELLED_PLANNER_STATUSES.has(status) || disruption.includes("cancel")) return "cancelled";
  if (status.includes("postpon") || disruption.includes("postpon") || disruption === "awaiting_rearrangement") return "postponed";
  if (DELIVERED_PLANNER_STATUSES.has(status)) return "delivered";
  if (ACTIVE_PLANNER_STATUSES.has(status)) return "scheduled";
  return status || "scheduled";
}

function usageTypeForBooking(booking) {
  if (booking.seasonPhase === "winter" || booking.siteInventoryId || booking.siteSlotId) return "winter";
  const type = text(booking.bookingType).toLowerCase();
  if (["fixture", "match", "matchday"].includes(type)) return "fixture";
  if (["friendly", "friendly_match"].includes(type)) return "friendly";
  if (["event", "tournament", "camp"].includes(type)) return "event";
  if (["hire", "external_hire", "external"].includes(type)) return "hire";
  if (type === "training") return "training";
  return type || "other";
}

function usageLabel(type) {
  return {
    fixture: "Fixtures",
    training: "Training",
    friendly: "Friendlies",
    event: "Events and camps",
    hire: "External hire",
    winter: "Winter / external sites",
    other: "Other bookings",
  }[type] || "Other bookings";
}

function statusLabel(status) {
  return {
    delivered: "Delivered",
    scheduled: "Scheduled",
    postponed: "Postponed",
    cancelled: "Cancelled",
    unresolved: "Unresolved",
  }[status] || status.replaceAll("_", " ");
}

function teamType(team = {}) {
  const configured = text(team.teamType || team.type).toLowerCase();
  if (configured) return configured;
  const name = text(team.name || team.teamName).toLowerCase();
  if (/(women|ladies)/.test(name)) return "women";
  if (/girls/.test(name)) return "girls";
  if (/(vets|veterans)/.test(name)) return "veterans";
  if (/(1st|first|reserve|senior|adult|open age)/.test(name)) return "adult";
  return "youth";
}

function ageGroup(teamName, configuredTeam = {}) {
  const configured = text(configuredTeam.ageGroup || configuredTeam.age_group);
  if (configured) return configured.toUpperCase();
  const match = text(teamName).match(/\bU\s*-?\s*(\d{1,2})\b/i);
  if (match) return `U${match[1]}`;
  const type = teamType(configuredTeam || { name: teamName });
  if (["adult", "women", "veterans"].includes(type)) return type === "women" ? "Women" : type === "veterans" ? "Veterans" : "Adult";
  return "Youth";
}

function siteRows(club = {}) {
  const rows = list(club.sites);
  if (rows.length) return rows;
  return [{ id: club.primarySiteId || "primary", name: club.siteName || club.venueName || "Main site", isPrimary: true }];
}

function pitchCapacity(pitch = {}) {
  return Math.max(1, Math.round(number(pitch.trainingCapacity ?? pitch.training_capacity, 1)));
}

function pitchEquivalentWeight(row, pitchMap) {
  if (row.usageType === "winter" && !row.pitchId) return 1;
  const pitch = pitchMap.get(text(row.pitchId));
  if (!pitch) return 1;
  if (!row.pitchAreaId) return 1;
  return 1 / pitchCapacity(pitch);
}

function plannerRows(payload = {}, { pitchCfg = [], teamCfg = [] } = {}) {
  const teamByKey = new Map();
  const teamByName = new Map();
  teamCfg.forEach((team, index) => {
    const key = text(team.key || team.id || team.teamKey || team.team_key || team.name || `team-${index + 1}`);
    teamByKey.set(key, team);
    teamByName.set(text(team.name).toLowerCase(), team);
  });
  const pitchMap = new Map(pitchCfg.map((pitch) => [text(pitch.id || pitch.pitchId || pitch.name), pitch]));
  return list(payload.bookings).map(normaliseAnnualBooking).map((booking) => {
    const team = teamByKey.get(booking.teamKey) || teamByName.get(booking.teamName.toLowerCase()) || {};
    const pitch = pitchMap.get(booking.pitchId) || {};
    const durationHours = bookingDurationMinutes(booking) / 60;
    const usageType = usageTypeForBooking(booking);
    const status = normaliseStatus(booking.status, booking.disruptionStatus);
    const start = new Date(booking.startAt || `${booking.startDate}T${booking.startTime}:00`);
    return {
      id: `planner:${booking.id || booking.sourceId || `${booking.startDate}:${booking.teamKey}:${booking.startTime}`}`,
      sourceId: booking.sourceId,
      sourceType: text(booking.sourceType).toLowerCase(),
      source: "Annual Planner",
      date: booking.startDate,
      startAt: Number.isNaN(start.getTime()) ? null : start,
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationHours,
      facilityHours: durationHours,
      teamHours: durationHours,
      usageType,
      usageLabel: usageLabel(usageType),
      status,
      statusLabel: statusLabel(status),
      fixtureVenueRole: text(booking.fixtureVenueRole).toLowerCase(),
      season: booking.seasonPhase || "regular",
      siteId: booking.venueId || booking.siteInventoryId || pitch.siteId || "primary",
      siteName: booking.venueName || pitch.siteName || "Main site",
      pitchId: booking.pitchId || booking.siteSlotId || "external",
      pitchName: booking.pitchName || booking.venueName || (usageType === "winter" ? "Winter / external site" : "Unallocated"),
      pitchAreaId: booking.pitchAreaId,
      pitchAreaName: booking.pitchAreaName || (booking.pitchAreaId ? booking.pitchAreaId : "Full pitch"),
      teamKey: booking.teamKey,
      teamName: booking.teamName || booking.title || "Club-wide",
      ageGroup: ageGroup(booking.teamName, team),
      teamType: teamType(team || { name: booking.teamName }),
      participantCount: booking.participantCount,
      title: booking.title,
      costPence: booking.costPence,
      raw: booking,
    };
  });
}

function fixtureRows(history = [], { club = {}, pitchCfg = [], teamCfg = [] } = {}) {
  const entries = normaliseSavedHistory(history);
  if (!entries.length) return [];
  const evidence = buildOperationalEvidence({ entries, scope: "all", club, pitchCfg, teamCfg });
  const teamByName = new Map(teamCfg.map((team) => [text(team.name).toLowerCase(), team]));
  return evidence.rows.map((row) => {
    const teamName = row.clubTeamName || row.homeTeam;
    const team = teamByName.get(text(teamName).toLowerCase()) || {};
    const start = row.date ? new Date(`${dateKey(row.date)}T${row.koTime === "TBC" ? "12:00" : row.koTime}:00`) : null;
    return {
      id: `fixture:${row.id}`,
      sourceId: text(row.raw?.id || row.raw?.fixtureId || row.raw?.sourceId),
      sourceType: "matchday",
      source: "Matchday history",
      date: dateKey(row.date),
      startAt: start && !Number.isNaN(start.getTime()) ? start : null,
      startTime: row.koTime,
      endTime: row.endTime,
      durationHours: number(row.durationMins, 60) / 60,
      facilityHours: number(row.durationMins, 60) / 60,
      teamHours: number(row.durationMins, 60) / 60,
      usageType: "fixture",
      usageLabel: usageLabel("fixture"),
      status: row.status === "delivered" ? "scheduled" : row.status,
      statusLabel: row.status === "delivered" ? "Scheduled" : row.statusLabel,
      fixtureVenueRole: row.isAwayFixture ? "away" : "home",
      season: "regular",
      siteId: row.siteId || "primary",
      siteName: siteRows(club).find((site) => text(site.id) === text(row.siteId))?.name || "Main site",
      pitchId: row.pitchId || "unallocated",
      pitchName: row.pitchLabel || "Unallocated",
      pitchAreaId: "",
      pitchAreaName: "Full pitch",
      teamKey: text(team.key || team.id || teamName),
      teamName,
      ageGroup: ageGroup(teamName, team),
      teamType: teamType(team || { name: teamName }),
      participantCount: 0,
      title: row.fixtureLabel,
      costPence: 0,
      raw: row.raw,
    };
  });
}

function dedupeRows(rows = []) {
  const fixtureSourceIds = new Set(rows.filter((row) => row.sourceType === "matchday").map((row) => row.sourceId).filter(Boolean));
  const map = new Map();
  rows.forEach((row) => {
    if (row.source === "Annual Planner" && ["matchday", "fixture", "full_time"].includes(row.sourceType) && row.sourceId && fixtureSourceIds.has(row.sourceId)) return;
    const key = row.sourceId && ["matchday", "fixture", "full_time"].includes(row.sourceType)
      ? `shared:${row.sourceId}`
      : row.id;
    if (!map.has(key)) map.set(key, row);
  });
  return [...map.values()];
}

function inRange(row, startDate, endDate) {
  const key = dateKey(row.date || row.startAt);
  if (!key) return false;
  if (startDate && key < startDate) return false;
  if (endDate && key > endDate) return false;
  return true;
}

function matchesFilter(row, filters = {}) {
  if (!inRange(row, filters.startDate, filters.endDate)) return false;
  if (filters.season && filters.season !== "all" && row.season !== filters.season) return false;
  if (filters.site && filters.site !== "all" && text(row.siteId) !== text(filters.site)) return false;
  if (filters.pitch && filters.pitch !== "all" && text(row.pitchId) !== text(filters.pitch)) return false;
  if (filters.area && filters.area !== "all" && text(row.pitchAreaId || "full") !== text(filters.area)) return false;
  if (filters.team && filters.team !== "all" && text(row.teamKey || row.teamName) !== text(filters.team)) return false;
  if (filters.ageGroup && filters.ageGroup !== "all" && text(row.ageGroup) !== text(filters.ageGroup)) return false;
  if (filters.usageType && filters.usageType !== "all" && row.usageType !== filters.usageType) return false;
  if (filters.status && filters.status !== "all" && row.status !== filters.status) return false;
  return true;
}

function defaultPolicy(payload = {}) {
  const policies = list(payload.scheduling_policies || payload.schedulingPolicies);
  return policies.find((row) => text(row.scope_type || row.scopeType) === "club" && text(row.scope_key || row.scopeKey || "all") === "all" && text(row.season_phase || row.seasonPhase) === "regular")
    || policies.find((row) => text(row.scope_type || row.scopeType) === "club")
    || null;
}

function rangeDays(startDate, endDate) {
  const start = localDate(startDate);
  const end = localDate(endDate);
  if (!start || !end || end < start) return [];
  const rows = [];
  const cursor = new Date(start);
  while (cursor <= end && rows.length < 1100) {
    rows.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function mergeIntervals(intervals) {
  const merged = [];
  intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]).forEach(([start, end]) => {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  });
  return merged;
}

function configuredWindowsForDay(day, policy, club = {}) {
  const dayOfWeek = day.getDay();
  const allowedDays = list(policy?.allowed_days || policy?.allowedDays).map(Number);
  const trainingAllowed = allowedDays.includes(dayOfWeek);
  const trainingStart = timeMinutes(policy?.earliest_start_time || policy?.earliestStartTime, 17 * 60);
  const trainingEnd = timeMinutes(policy?.latest_end_time || policy?.latestEndTime, 21 * 60);
  const timing = club.timingSettings || club.timing || {};
  const matchdayStart = number(timing.startHour ?? club.startHour, 8) * 60 + number(timing.startMin ?? club.startMin, 30);
  const matchdayEnd = number(timing.endHour ?? club.endHour, 11) * 60 + number(timing.endMin ?? club.endMin, 30);
  const weekend = [0, 6].includes(dayOfWeek);
  const windows = [];
  if (trainingAllowed) windows.push([trainingStart, trainingEnd]);
  if (weekend) windows.push([matchdayStart, matchdayEnd]);
  return mergeIntervals(windows).map(([start, end]) => {
    const startAt = new Date(day);
    const endAt = new Date(day);
    startAt.setHours(0, start, 0, 0);
    endAt.setHours(0, end, 0, 0);
    return [startAt.getTime(), endAt.getTime()];
  });
}

function closureBreakdown(payload = {}, openingWindows = [], pitchId = "", siteId = "") {
  const totals = { total: 0, weather: 0, maintenance: 0, other: 0 };
  const overlaps = [];
  list(payload.blackouts).map(normaliseAnnualBlackout).filter((row) => {
    if (row.pitchId && pitchId && text(row.pitchId) !== text(pitchId)) return false;
    if (row.venueId && siteId && text(row.venueId) !== text(siteId)) return false;
    return true;
  }).forEach((row) => {
    const start = new Date(row.startAt || `${row.startDate}T00:00:00`);
    const end = new Date(row.endAt || `${row.endDate || row.startDate}T23:59:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const descriptor = `${row.closureType} ${row.title} ${row.reason}`.toLowerCase();
    const category = /(weather|waterlog|flood|snow|ice|storm|rain|heat)/.test(descriptor)
      ? "weather"
      : /(maint|repair|drain|surface|work|inspection)/.test(descriptor)
        ? "maintenance"
        : "other";
    openingWindows.forEach(([openStart, openEnd]) => {
      const overlapStart = Math.max(openStart, start.getTime());
      const overlapEnd = Math.min(openEnd, end.getTime());
      if (overlapEnd > overlapStart) overlaps.push({ start: overlapStart, end: overlapEnd, category });
    });
  });
  // Count each unavailable interval once. Weather takes precedence where causes overlap.
  const boundaries = [...new Set(overlaps.flatMap((row) => [row.start, row.end]))].sort((a, b) => a - b);
  for (let index = 1; index < boundaries.length; index += 1) {
    const start = boundaries[index - 1];
    const end = boundaries[index];
    const causes = overlaps.filter((row) => row.start <= start && row.end >= end);
    if (!causes.length) continue;
    const category = ["weather", "maintenance", "other"].find((candidate) => causes.some((row) => row.category === candidate));
    const hours = (end - start) / 3600000;
    totals.total += hours;
    totals[category] += hours;
  }
  return totals;
}

function buildCapacity({ payload = {}, club = {}, pitchCfg = [], filters = {} }) {
  const policy = defaultPolicy(payload);
  const days = rangeDays(filters.startDate, filters.endDate);
  const pitchRows = pitchCfg.filter((pitch) => {
    const id = text(pitch.id || pitch.pitchId || pitch.name);
    const siteId = text(pitch.siteId || pitch.site_id || pitch.venueId || pitch.venue_id || "primary");
    return (!filters.pitch || filters.pitch === "all" || filters.pitch === id)
      && (!filters.site || filters.site === "all" || filters.site === siteId);
  });
  const openingWindows = days.flatMap((day) => configuredWindowsForDay(day, policy, club));
  const byPitch = new Map();
  pitchRows.forEach((pitch) => {
    const id = text(pitch.id || pitch.pitchId || pitch.name);
    const configured = openingWindows.reduce((sum, [start, end]) => sum + (end - start) / 3600000, 0);
    const siteId = text(pitch.siteId || pitch.site_id || pitch.venueId || pitch.venue_id || "primary");
    const closures = closureBreakdown(payload, openingWindows, id, siteId);
    const closureHours = closures.total;
    byPitch.set(id, {
      configuredFacilityHours: configured,
      closureHours,
      weatherClosureHours: closures.weather,
      maintenanceClosureHours: closures.maintenance,
      otherClosureHours: closures.other,
      usableFacilityHours: Math.max(0, configured - closureHours),
      availableTeamHours: Math.max(0, configured - closureHours) * pitchCapacity(pitch),
    });
  });
  return byPitch;
}

function aggregateFacilityRows(rows, capacityByPitch, pitchMap, club) {
  const map = new Map();
  const seeds = [...capacityByPitch.keys()].map((id) => {
    const pitch = pitchMap.get(id);
    const siteId = text(pitch.siteId || pitch.site_id || pitch.venueId || pitch.venue_id || "primary");
    return { pitchId: id, pitchName: pitch.label || pitch.name || id, siteId, siteName: siteRows(club).find((site) => text(site.id) === siteId)?.name || pitch.siteName || "Main site", capacityOnly: true };
  });
  [...seeds, ...rows].forEach((row) => {
    const key = text(row.pitchId || "unallocated");
    const current = map.get(key) || {
      id: key,
      siteId: row.siteId,
      siteName: row.siteName,
      pitchName: row.pitchName || "Unallocated",
      bookings: 0,
      teamHours: 0,
      facilityHours: 0,
      deliveredHours: 0,
      cancelledHours: 0,
      fixtureHours: 0,
      trainingHours: 0,
      friendlyHours: 0,
      eventHours: 0,
      hireHours: 0,
      winterHours: 0,
      otherHours: 0,
      participants: 0,
    };
    if (row.capacityOnly) { map.set(key, current); return; }
    current.bookings += 1;
    const active = !["cancelled", "postponed"].includes(row.status);
    if (active) {
      current.teamHours += row.teamHours;
      current.facilityHours += row.facilityEquivalentHours;
      current[`${row.usageType}Hours`] = number(current[`${row.usageType}Hours`]) + row.teamHours;
    }
    if (row.status === "delivered") current.deliveredHours += row.teamHours;
    if (row.status === "cancelled") current.cancelledHours += row.teamHours;
    current.participants += number(row.participantCount);
    map.set(key, current);
  });
  return [...map.values()].map((row) => {
    const capacity = capacityByPitch.get(row.id) || { configuredFacilityHours: 0, closureHours: 0, weatherClosureHours: 0, maintenanceClosureHours: 0, otherClosureHours: 0, usableFacilityHours: 0, availableTeamHours: 0 };
    const utilisationPct = capacity.usableFacilityHours > 0 ? Math.round((row.facilityHours / capacity.usableFacilityHours) * 100) : null;
    return {
      ...row,
      ...capacity,
      teamHours: round(row.teamHours),
      facilityHours: round(row.facilityHours),
      deliveredHours: round(row.deliveredHours),
      cancelledHours: round(row.cancelledHours),
      fixtureHours: round(row.fixtureHours),
      trainingHours: round(row.trainingHours),
      friendlyHours: round(row.friendlyHours),
      eventHours: round(row.eventHours),
      hireHours: round(row.hireHours),
      winterHours: round(row.winterHours),
      otherHours: round(row.otherHours),
      configuredFacilityHours: round(capacity.configuredFacilityHours),
      closureHours: round(capacity.closureHours),
      weatherClosureHours: round(capacity.weatherClosureHours),
      maintenanceClosureHours: round(capacity.maintenanceClosureHours),
      otherClosureHours: round(capacity.otherClosureHours),
      usableFacilityHours: round(capacity.usableFacilityHours),
      availableTeamHours: round(capacity.availableTeamHours),
      unusedHours: round(Math.max(0, capacity.usableFacilityHours - row.facilityHours)),
      utilisationPct,
    };
  }).sort((a, b) => b.facilityHours - a.facilityHours || a.pitchName.localeCompare(b.pitchName));
}

function optionRows(rows, key, labelKey = key) {
  const map = new Map();
  rows.forEach((row) => {
    const value = text(row[key]);
    if (!value) return;
    map.set(value, text(row[labelKey]) || value);
  });
  return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
}

function shiftDate(dateValue, days) {
  const date = localDate(dateValue);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function inclusiveDayCount(startDate, endDate) {
  const start = localDate(startDate);
  const end = localDate(endDate);
  if (!start || !end || end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

function percentChange(current, previous) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function buildUnifiedFacilityAnalyticsModel({
  history = [],
  plannerData = {},
  club = {},
  pitchCfg = [],
  teamCfg = [],
  filters = {},
} = {}) {
  const currentYear = new Date().getFullYear();
  const resolvedFilters = {
    startDate: filters.startDate || `${currentYear}-01-01`,
    endDate: filters.endDate || `${currentYear}-12-31`,
    season: filters.season || "all",
    site: filters.site || "all",
    pitch: filters.pitch || "all",
    area: filters.area || "all",
    team: filters.team || "all",
    ageGroup: filters.ageGroup || "all",
    usageType: filters.usageType || "all",
    status: filters.status || "all",
  };
  const pitchMap = new Map(pitchCfg.map((pitch) => [text(pitch.id || pitch.pitchId || pitch.name), pitch]));
  const allRows = dedupeRows([
    ...fixtureRows(history, { club, pitchCfg, teamCfg }),
    ...plannerRows(plannerData, { pitchCfg, teamCfg }),
  ]).map((row) => {
    const pitch = pitchMap.get(text(row.pitchId));
    const facilityScope = row.fixtureVenueRole === "away" || row.status === "away" ? "away"
      : pitch ? "club" : row.usageType === "winter" ? "external" : "unallocated";
    return {
      ...row,
      facilityScope,
      pitchName: facilityScope === "club" ? pitch.label || pitch.name || pitch.id : row.pitchName,
      facilityEquivalentHours: facilityScope === "club" && !["cancelled", "postponed"].includes(row.status) ? row.facilityHours * pitchEquivalentWeight(row, pitchMap) : 0,
    };
  });
  const rows = allRows.filter((row) => matchesFilter(row, resolvedFilters));
  const facilityRows = rows.filter((row) => row.facilityScope === "club");
  const nonFacilityRows = rows.filter((row) => row.facilityScope !== "club").map((row) => ({ ...row, utilisationPct: null }));
  const activeRows = facilityRows.filter((row) => !["cancelled", "postponed"].includes(row.status));
  const selectedDays = inclusiveDayCount(resolvedFilters.startDate, resolvedFilters.endDate);
  const previousFilters = {
    ...resolvedFilters,
    startDate: shiftDate(resolvedFilters.startDate, -selectedDays),
    endDate: shiftDate(resolvedFilters.startDate, -1),
  };
  const previousRows = selectedDays > 0
    ? allRows.filter((row) => row.facilityScope === "club" && matchesFilter(row, previousFilters) && !["cancelled", "postponed"].includes(row.status))
    : [];
  const capacityByPitch = buildCapacity({ payload: plannerData, club, pitchCfg, filters: resolvedFilters });
  const facilities = aggregateFacilityRows(facilityRows, capacityByPitch, pitchMap, club);
  const sum = (selector, source = rows) => source.reduce((total, row) => total + number(selector(row)), 0);
  const teamHours = sum((row) => row.teamHours, activeRows);
  const facilityHours = sum((row) => row.facilityEquivalentHours, activeRows);
  const deliveredHours = sum((row) => row.status === "delivered" ? row.teamHours : 0, facilityRows);
  const cancelledHours = sum((row) => row.status === "cancelled" ? row.teamHours : 0);
  const postponedHours = sum((row) => row.status === "postponed" ? row.teamHours : 0);
  const configuredFacilityHours = facilities.reduce((total, row) => total + row.configuredFacilityHours, 0);
  const closureHoursTotal = facilities.reduce((total, row) => total + row.closureHours, 0);
  const usableFacilityHours = facilities.reduce((total, row) => total + row.usableFacilityHours, 0);
  const utilisationPct = usableFacilityHours > 0 ? Math.round((facilityHours / usableFacilityHours) * 100) : null;
  const weatherClosureHours = facilities.reduce((total, row) => total + number(row.weatherClosureHours), 0);
  const maintenanceClosureHours = facilities.reduce((total, row) => total + number(row.maintenanceClosureHours), 0);
  const previousTeamHours = previousRows.reduce((total, row) => total + number(row.teamHours), 0);
  const previousTeams = new Set(previousRows.map((row) => row.teamKey || row.teamName).filter(Boolean)).size;
  const activeTeams = new Set(activeRows.map((row) => row.teamKey || row.teamName).filter(Boolean)).size;
  const totalCostPence = activeRows.reduce((total, row) => total + number(row.costPence), 0);
  const costPerDeliveredTeamHourPence = deliveredHours > 0 ? Math.round(totalCostPence / deliveredHours) : 0;
  const usage = ["fixture", "training", "friendly", "event", "hire", "winter", "other"].map((type) => ({
    type,
    label: usageLabel(type),
    hours: round(sum((row) => row.usageType === type ? row.teamHours : 0, activeRows)),
    facilityHours: round(sum((row) => row.usageType === type ? row.facilityEquivalentHours : 0, activeRows)),
    bookings: activeRows.filter((row) => row.usageType === type).length,
  }));
  const unresolvedDemand = number(plannerData?.waitlist?.filter?.((row) => text(row.status || "waiting") === "waiting")?.length, 0);
  const grantNarratives = [];
  if (facilityHours > 0) grantNarratives.push(`${round(facilityHours)} pitch-equivalent hours were scheduled across fixtures, training and other bookings in the selected period.`);
  if (teamHours > facilityHours) grantNarratives.push(`${round(teamHours)} team-hours were supported through split-pitch and simultaneous-use capacity.`);
  if (closureHoursTotal > 0) grantNarratives.push(`${round(closureHoursTotal)} configured facility hours were unavailable because of closures, maintenance or weather restrictions.`);
  if (weatherClosureHours > 0) grantNarratives.push(`${round(weatherClosureHours)} pitch-hours were specifically lost to weather-related restrictions.`);
  if (previousTeamHours > 0 && teamHours !== previousTeamHours) grantNarratives.push(`Recorded team-hours changed by ${percentChange(teamHours, previousTeamHours)}% compared with the immediately preceding equivalent period.`);
  if (totalCostPence > 0 && deliveredHours > 0) grantNarratives.push(`Recorded booking cost was £${round(totalCostPence / 100, 2).toFixed(2)}, equivalent to £${round(costPerDeliveredTeamHourPence / 100, 2).toFixed(2)} per delivered team-hour.`);
  if (unresolvedDemand > 0) grantNarratives.push(`${unresolvedDemand} team${unresolvedDemand === 1 ? " remains" : "s remain"} on the training waiting list, evidencing unmet facility demand.`);
  const busiest = facilities[0];
  if (busiest?.facilityHours > 0) grantNarratives.push(`${busiest.pitchName} carried the highest recorded load at ${busiest.facilityHours} pitch-equivalent hours.`);
  if (!grantNarratives.length) grantNarratives.push("Record matchdays and Annual Planner bookings to build a combined facility-use evidence baseline.");
  const configuredOptions = [...pitchMap.entries()].map(([id, pitch]) => {
    const siteId = text(pitch.siteId || pitch.site_id || pitch.venueId || pitch.venue_id || "primary");
    return { pitchId: id, pitchName: pitch.label || pitch.name || id, siteId, siteName: siteRows(club).find((site) => text(site.id) === siteId)?.name || pitch.siteName || "Main site" };
  });

  return Object.freeze({
    filters: resolvedFilters,
    hasData: rows.length > 0 || facilities.length > 0,
    rows: rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime).localeCompare(String(b.startTime))),
    facilities,
    nonFacilityRows,
    usage,
    metrics: Object.freeze({
      records: rows.length,
      teamHours: round(teamHours),
      facilityHours: round(facilityHours),
      deliveredHours: round(deliveredHours),
      scheduledHours: round(Math.max(0, teamHours - deliveredHours)),
      cancelledHours: round(cancelledHours),
      postponedHours: round(postponedHours),
      configuredFacilityHours: round(configuredFacilityHours),
      closureHours: round(closureHoursTotal),
      weatherClosureHours: round(weatherClosureHours),
      maintenanceClosureHours: round(maintenanceClosureHours),
      usableFacilityHours: round(usableFacilityHours),
      unusedHours: round(Math.max(0, usableFacilityHours - facilityHours)),
      utilisationPct,
      teams: activeTeams,
      previousTeamHours: round(previousTeamHours),
      teamHoursChangePct: percentChange(teamHours, previousTeamHours),
      previousTeams,
      teamGrowth: activeTeams - previousTeams,
      totalCostPence: Math.round(totalCostPence),
      totalCost: round(totalCostPence / 100, 2),
      costPerDeliveredTeamHourPence,
      costPerDeliveredTeamHour: round(costPerDeliveredTeamHourPence / 100, 2),
      participants: Math.round(sum((row) => row.participantCount, activeRows)),
      waitingTeams: unresolvedDemand,
    }),
    options: Object.freeze({
      sites: optionRows([...allRows, ...configuredOptions], "siteId", "siteName"),
      pitches: optionRows([...allRows, ...configuredOptions], "pitchId", "pitchName"),
      areas: optionRows(allRows.map((row) => ({ ...row, pitchAreaId: row.pitchAreaId || "full", pitchAreaName: row.pitchAreaId ? row.pitchAreaName : "Full pitch" })), "pitchAreaId", "pitchAreaName"),
      teams: optionRows(allRows.map((row) => ({ ...row, teamKey: row.teamKey || row.teamName })), "teamKey", "teamName"),
      ageGroups: optionRows(allRows, "ageGroup", "ageGroup"),
      seasons: optionRows(allRows, "season", "season"),
      statuses: optionRows(allRows, "status", "statusLabel"),
    }),
    grantNarratives,
    methodology: "Club-pitch totals include only bookings allocated to configured pitches; away, external and unallocated activity is listed separately and does not occupy club capacity. Postponed and cancelled bookings do not count as occupied hours. Split-pitch bookings are converted to pitch-equivalent hours. Capacity covers all selected configured pitches over the selected date range, using the union of saved matchday and Annual Planner opening windows. Closures subtract only overlapping opening hours, counted once (weather takes precedence over maintenance where causes overlap). N/A means no usable configured capacity is available to calculate a percentage. Cost measures use visible booking costs. Trends compare the preceding period of equal length.",
  });
}

function csvCell(value) {
  const string = String(neutraliseSpreadsheetFormula(value) ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

export function buildUnifiedFacilityCsv(model = {}) {
  const metrics = model.metrics || {};
  const lines = [
    ["Unified facility usage report"],
    ["From", model.filters?.startDate || ""],
    ["To", model.filters?.endDate || ""],
    ["Pitch-equivalent hours", metrics.facilityHours || 0],
    ["Team-hours", metrics.teamHours || 0],
    ["Utilisation %", metrics.utilisationPct ?? "N/A"],
    ["Closure / downtime hours", metrics.closureHours || 0],
    ["Weather closure hours", metrics.weatherClosureHours || 0],
    ["Maintenance closure hours", metrics.maintenanceClosureHours || 0],
    ["Unused configured hours", metrics.unusedHours || 0],
    ["Team-hours change %", metrics.teamHoursChangePct || 0],
    ["Recorded booking cost", metrics.totalCost || 0],
    ["Cost per delivered team-hour", metrics.costPerDeliveredTeamHour || 0],
    [],
    ["Facility", "Site", "Bookings", "Pitch-equivalent hours", "Team-hours", "Fixtures", "Training", "Friendlies", "Events", "Winter/external", "Closure hours", "Unused hours", "Utilisation %"],
    ...list(model.facilities).map((row) => [row.pitchName, row.siteName, row.bookings, row.facilityHours, row.teamHours, row.fixtureHours, row.trainingHours, row.friendlyHours, row.eventHours, row.winterHours, row.closureHours, row.unusedHours, row.utilisationPct ?? "N/A"]),
    [],
    ["Away / external / unallocated activity", "Not included in club pitch usage"],
    ["Date", "Team", "Venue", "Scope", "Status", "Recorded hours", "Utilisation %"],
    ...list(model.nonFacilityRows).map((row) => [row.date, row.teamName, row.pitchName, row.facilityScope, row.statusLabel, row.durationHours, "N/A"]),
    [],
    ["Date", "Start", "End", "Usage", "Status", "Team", "Age group", "Site", "Pitch", "Area", "Team-hours", "Pitch-equivalent hours", "Source"],
    ...list(model.rows).map((row) => [row.date, row.startTime, row.endTime, row.usageLabel, row.statusLabel, row.teamName, row.ageGroup, row.siteName, row.pitchName, row.pitchAreaName, round(row.teamHours), round(row.facilityEquivalentHours), row.source]),
  ];
  return `\uFEFF${lines.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
