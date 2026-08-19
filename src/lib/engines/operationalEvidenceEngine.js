import { AVG_CARS, PITCHES } from "../constants.js";
import { cleanName } from "../scheduler.js";
import { getParkingSnapshot } from "./parkingEngine.js";
import { getParkingCapacity, getPrimarySite } from "../domain/clubDomain.js";
import { isParkingEnabled } from "../settings/workspaceSettings.js";

const DAY_ORDER = ["midweek", "saturday", "sunday"];
const STATUS_RANK = { delivered: 1, unresolved: 2, postponed: 3, cancelled: 4 };

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value, fallback = null) {
  if (value === "" || value == null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseClock(value) {
  const direct = finiteNumber(value, null);
  if (direct != null) return direct;
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatClock(value) {
  const minutes = finiteNumber(value, null);
  if (minutes == null) return "TBC";
  const safe = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(safe / 60) % 24).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function parseLocalDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12, 0, 0);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatDate(date, fallback = "Saved matchday") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function shortDate(date, fallback = "Matchday") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayLabel(key) {
  if (key === "saturday") return "Saturday";
  if (key === "sunday") return "Sunday";
  if (key === "midweek") return "Midweek";
  return "Matchday";
}

export function normaliseDayKey(value) {
  const text = normaliseText(value);
  if (text.includes("sat")) return "saturday";
  if (text.includes("sun")) return "sunday";
  if (text.includes("mid") || text.includes("weeknight")) return "midweek";
  return text || "matchday";
}

function scopeIncludesDay(scope, key) {
  const normalised = String(scope || "matchweek").toLowerCase();
  if (["matchweek", "all"].includes(normalised)) return true;
  if (normalised === "weekend") return ["saturday", "sunday"].includes(key);
  return normaliseDayKey(normalised) === key;
}

function fixtureStart(fixture = {}) {
  return parseClock(
    fixture.koMins ??
      fixture.kickOffMins ??
      fixture.kickoffMins ??
      fixture.startMins ??
      fixture.koTime ??
      fixture.kickOff ??
      fixture.kickoff ??
      fixture.time
  );
}

function fixtureDuration(fixture = {}) {
  const start = fixtureStart(fixture);
  const end = parseClock(fixture.endMins ?? fixture.finishMins ?? fixture.endTime);
  if (start != null && end != null && end > start) return end - start;
  const configured = finiteNumber(
    fixture.cfg?.gameMins ?? fixture.gameMins ?? fixture.durationMins ?? fixture.duration,
    60
  );
  return configured > 0 ? configured : 60;
}

function fixtureFormat(fixture = {}) {
  return String(
    fixture.cfg?.format || fixture.manualFormat || fixture.format || fixture.gameFormat || "Unspecified"
  ).trim() || "Unspecified";
}

function fixturePitchId(fixture = {}) {
  return String(
    fixture.pitchId || fixture.pitch || fixture.pitchName || fixture.pitchLabel || ""
  ).trim();
}

function fixtureStatus(fixture = {}, forcedStatus = "") {
  if (forcedStatus) return forcedStatus;
  const value = normaliseText(fixture.status || fixture.fixtureStatus || fixture.outcome);
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("postpone")) return "postponed";
  if (value.includes("unresolved") || value.includes("unassigned")) return "unresolved";
  return "delivered";
}

function officialStatus(fixture = {}) {
  const status = normaliseText(
    fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || fixture.assignmentStatus
  );
  if (["confirmed", "accepted", "assigned"].includes(status)) return "confirmed";
  if (["declined", "cancelled", "unavailable"].includes(status)) return "declined";
  return status || "unconfirmed";
}

function officialName(fixture = {}) {
  return String(
    fixture.referee || fixture.official || fixture.ref || fixture.matchOfficial || fixture.assignedOfficial || ""
  ).trim();
}

function weatherRisk(fixture = {}) {
  const source =
    fixture.weatherRisk?.key ||
    fixture.weatherRisk ||
    fixture.weather?.risk?.key ||
    fixture.weather?.risk ||
    fixture.forecastRisk?.key ||
    fixture.forecastRisk ||
    fixture.weatherStatus ||
    "";
  const value = normaliseText(source);
  if (["high", "danger", "critical", "severe"].some((word) => value.includes(word))) return "high";
  if (["medium", "watch", "warning", "amber"].some((word) => value.includes(word))) return "watch";
  if (["low", "clear", "safe", "green"].some((word) => value.includes(word))) return "low";
  return "unknown";
}

function stableFixtureKey(fixture = {}, day = "matchday") {
  const explicit = fixture.id || fixture.fixtureId || fixture.key || fixture.fullTimeId || fixture.sourceId;
  if (explicit) return `${day}:id:${String(explicit)}`;
  return [
    day,
    normaliseText(fixture.homeTeam || fixture.team || fixture.home),
    normaliseText(fixture.awayTeam || fixture.opponent || fixture.away),
    String(fixture.date || fixture.fixtureDate || ""),
    String(fixtureStart(fixture) ?? ""),
  ].join(":");
}

function buildPitchMap(pitchCfg = []) {
  const source = asArray(pitchCfg).length ? pitchCfg : PITCHES;
  return new Map(
    asArray(source).map((pitch, index) => {
      const id = String(pitch.id || pitch.pitchId || pitch.name || `pitch-${index + 1}`);
      return [id, {
        id,
        label: pitch.label || pitch.name || id,
        description: pitch.desc || pitch.description || pitch.format || "",
        raw: pitch,
      }];
    })
  );
}

function buildTeamMap(teamCfg = []) {
  return new Map(
    asArray(teamCfg).map((team, index) => {
      const name = String(team.name || team.teamName || team.label || `Team ${index + 1}`).trim();
      return [normaliseText(name), { name, raw: team }];
    })
  );
}

function normaliseFixture({ fixture = {}, status = "", day = {}, entry = {}, club = {}, pitchMap }) {
  const resolvedStatus = fixtureStatus(fixture, status);
  const start = fixtureStart(fixture);
  const duration = fixtureDuration(fixture);
  const end = parseClock(fixture.endMins ?? fixture.finishMins ?? fixture.endTime) ??
    (start == null ? null : start + duration);
  const rawHome = fixture.homeTeam || fixture.team || fixture.home || "Home team";
  const homeTeam = cleanName(rawHome, club?.name) || String(rawHome);
  const awayTeam = String(fixture.awayTeam || fixture.opponent || fixture.away || "Opposition TBC").trim();
  const pitchId = fixturePitchId(fixture);
  const pitch = pitchMap.get(pitchId);
  const referee = officialName(fixture);
  const refStatus = officialStatus(fixture);
  const format = fixtureFormat(fixture);
  const explicitCars = finiteNumber(fixture.carEstimate, null);
  const estimatedCars = Math.max(0, explicitCars ?? finiteNumber(club?.avgCars?.[format] ?? AVG_CARS[format], 8));

  return {
    id: stableFixtureKey(fixture, day.key),
    raw: fixture,
    entryId: entry.id,
    entryKind: entry.kind,
    entryLabel: entry.fullLabel || entry.label,
    day: day.key,
    dayLabel: day.label || dayLabel(day.key),
    date: day.date || entry.dateValue || "",
    dateLabel: day.dateLabel || day.label || entry.fullLabel || entry.label,
    status: resolvedStatus,
    statusLabel:
      resolvedStatus === "delivered"
        ? "Scheduled"
        : resolvedStatus.charAt(0).toUpperCase() + resolvedStatus.slice(1),
    homeTeam,
    awayTeam,
    fixtureLabel: awayTeam ? `${homeTeam} vs ${awayTeam}` : homeTeam,
    format,
    pitchId,
    pitchLabel: pitch?.label || pitchId || "Unassigned",
    pitchDescription: pitch?.description || "",
    koMins: start,
    koTime: start == null ? "TBC" : formatClock(start),
    endMins: end,
    endTime: end == null ? "TBC" : formatClock(end),
    durationMins: duration,
    referee,
    refPhone: String(fixture.refPhone || fixture.officialPhone || "").trim(),
    refEmail: String(fixture.refEmail || fixture.officialEmail || "").trim(),
    officialStatus: refStatus,
    officialConfirmed: Boolean(referee) && refStatus === "confirmed",
    estimatedCars,
    weatherRisk: weatherRisk(fixture),
    isCup: Boolean(fixture.isCup || fixture.cup || fixture.competitionType === "cup"),
    siteId: fixture.siteId || fixture.venueId || fixture.groundId || club.primarySiteId || "primary",
  };
}

function dedupeRows(rows = []) {
  const map = new Map();
  rows.forEach((row) => {
    const current = map.get(row.id);
    if (!current || (STATUS_RANK[row.status] || 0) >= (STATUS_RANK[current.status] || 0)) {
      map.set(row.id, current ? { ...current, ...row, raw: { ...current.raw, ...row.raw } } : row);
    }
  });
  return [...map.values()].sort((a, b) => {
    const aTime = a.koMins == null ? Number.MAX_SAFE_INTEGER : a.koMins;
    const bTime = b.koMins == null ? Number.MAX_SAFE_INTEGER : b.koMins;
    return aTime - bTime || a.homeTeam.localeCompare(b.homeTeam);
  });
}

function dayFromCollections({ key, label, date = "", dateLabel = "", hasRun = false, scheduled = [], postponed = [], cancelled = [], unresolved = [] }) {
  return {
    key: normaliseDayKey(key),
    label: label || dayLabel(normaliseDayKey(key)),
    date,
    dateLabel: dateLabel || label || dayLabel(normaliseDayKey(key)),
    hasRun: Boolean(hasRun),
    scheduled: asArray(scheduled),
    postponed: asArray(postponed),
    cancelled: asArray(cancelled),
    unresolved: asArray(unresolved),
  };
}

export function createCurrentMatchweekEntry({
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
  satDate = "",
  sunDate = "",
  midweekDate = "",
  satDateLabel = "Saturday",
  sunDateLabel = "Sunday",
  midweekDateLabel = "Midweek",
  midweekEnabled = true,
} = {}) {
  const split = (fixtures) => ({
    scheduled: asArray(fixtures).filter((fixture) => !["postponed", "cancelled"].includes(fixtureStatus(fixture))),
    postponed: asArray(fixtures).filter((fixture) => fixtureStatus(fixture) === "postponed"),
    cancelled: asArray(fixtures).filter((fixture) => fixtureStatus(fixture) === "cancelled"),
  });
  const sat = split(satFinal);
  const sun = split(sunFinal);
  const mid = split(midweekFinal);
  const dates = [midweekDate, satDate, sunDate].filter(Boolean).sort();
  const firstDate = parseLocalDate(dates[0], new Date());
  const lastDate = parseLocalDate(dates.at(-1), firstDate);
  const label = dates.length > 1
    ? `${shortDate(firstDate)} – ${shortDate(lastDate)}`
    : formatDate(firstDate, "Current matchweek");

  return {
    id: "current",
    kind: "current",
    label: "Current matchweek",
    fullLabel: `Current matchweek · ${label}`,
    date: firstDate,
    dateValue: dates[0] || "",
    raw: {},
    days: [
      ...(midweekEnabled ? [dayFromCollections({ key: "midweek", label: "Midweek", date: midweekDate, dateLabel: midweekDateLabel, hasRun: midweekHasRun, ...mid, unresolved: midweekUnresolved })] : []),
      dayFromCollections({ key: "saturday", label: "Saturday", date: satDate, dateLabel: satDateLabel, hasRun: satHasRun, ...sat, unresolved: satUnresolved }),
      dayFromCollections({ key: "sunday", label: "Sunday", date: sunDate, dateLabel: sunDateLabel, hasRun: sunHasRun, ...sun, unresolved: sunUnresolved }),
    ],
  };
}

function legacyDays(entry = {}) {
  return [
    dayFromCollections({
      key: "saturday",
      label: "Saturday",
      date: entry.satDate || entry.date || "",
      dateLabel: entry.satDateLabel || entry.dateLabel || "Saturday",
      hasRun: asArray(entry.scheduled).length > 0 || asArray(entry.postponedGames).length > 0,
      scheduled: entry.scheduled,
      postponed: entry.postponedGames,
      cancelled: entry.cancelledGames,
      unresolved: entry.unresolvedGames,
    }),
    dayFromCollections({
      key: "sunday",
      label: "Sunday",
      date: entry.sunDate || "",
      dateLabel: entry.sunDateLabel || "Sunday",
      hasRun: asArray(entry.sunScheduled).length > 0 || asArray(entry.sunPostponed).length > 0,
      scheduled: entry.sunScheduled,
      postponed: entry.sunPostponed,
      cancelled: entry.sunCancelled,
      unresolved: entry.sunUnresolved,
    }),
    dayFromCollections({
      key: "midweek",
      label: "Midweek",
      date: entry.midweekDate || "",
      dateLabel: entry.midweekDateLabel || "Midweek",
      hasRun: asArray(entry.midweekScheduled).length > 0 || asArray(entry.midweekPostponed).length > 0,
      scheduled: entry.midweekScheduled,
      postponed: entry.midweekPostponed,
      cancelled: entry.midweekCancelled,
      unresolved: entry.midweekUnresolved,
    }),
  ];
}

export function normaliseSavedMatchday(entry = {}, index = 0) {
  const fallbackDate = new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000);
  const date = parseLocalDate(entry.date || entry.satDate || entry.savedAt || entry.dateLabel, fallbackDate);
  const days = asArray(entry.fixtureDays).length
    ? entry.fixtureDays.map((day) => dayFromCollections({
        key: day.key || day.day,
        label: day.label,
        date: day.date || "",
        dateLabel: day.dateLabel || day.label,
        hasRun: day.hasRun ?? true,
        scheduled: day.scheduled || day.final,
        postponed: day.postponed,
        cancelled: day.cancelled,
        unresolved: day.unresolved,
      }))
    : legacyDays(entry);

  return {
    id: String(entry.id || entry.savedAt || `${entry.dateLabel || "matchday"}-${index}`),
    kind: "history",
    label: entry.dateLabel || shortDate(date, `Saved matchday ${index + 1}`),
    fullLabel: formatDate(date, entry.dateLabel || "Saved matchday"),
    date,
    dateValue: entry.date || entry.satDate || "",
    savedAt: entry.savedAt || "",
    parkingCapacity: finiteNumber(entry.parking?.capacity ?? entry.carParkSpaces, null),
    parkingSettings: entry.parking || null,
    raw: entry,
    days,
  };
}

export function normaliseSavedHistory(history = []) {
  return asArray(history)
    .map(normaliseSavedMatchday)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function clubWithEntryParking(club = {}, entry = {}) {
  const capacity = finiteNumber(entry.parkingSettings?.capacity ?? entry.parkingCapacity, null);
  const avgCars = entry.parkingSettings?.avgCars;
  const maxConcurrent = finiteNumber(entry.parkingSettings?.maxConcurrent, null);
  const enabled = entry.parkingSettings?.enabled;
  if (capacity == null && !avgCars && maxConcurrent == null && enabled == null) return club;

  const primary = getPrimarySite(club);
  const primaryId = club.primarySiteId || primary?.id;
  const sites = asArray(club.sites).length
    ? club.sites.map((site, index) => {
        const isPrimary = site.id === primaryId || site.isPrimary || (!primaryId && index === 0);
        return isPrimary && capacity != null ? { ...site, carParkSpaces: capacity } : site;
      })
    : club.sites;

  return {
    ...club,
    ...(capacity == null ? {} : { carParkSpaces: capacity }),
    ...(maxConcurrent == null ? {} : { maxConcurrent }),
    ...(avgCars ? { avgCars } : {}),
    ...(sites ? { sites } : {}),
    features: {
      ...club.features,
      ...(enabled == null ? {} : { parkingEnabled: Boolean(enabled) }),
    },
  };
}

function normaliseEntryRows(entry, club, pitchMap, scope) {
  const reportClub = clubWithEntryParking(club, entry);
  return entry.days
    .filter((day) => scopeIncludesDay(scope, day.key))
    .map((day) => {
      const rows = dedupeRows([
        ...day.scheduled.map((fixture) => normaliseFixture({ fixture, day, entry, club: reportClub, pitchMap })),
        ...day.postponed.map((fixture) => normaliseFixture({ fixture, status: "postponed", day, entry, club: reportClub, pitchMap })),
        ...day.cancelled.map((fixture) => normaliseFixture({ fixture, status: "cancelled", day, entry, club: reportClub, pitchMap })),
        ...day.unresolved.map((fixture) => normaliseFixture({ fixture, status: "unresolved", day, entry, club: reportClub, pitchMap })),
      ]);
      return { ...day, rows };
    });
}

function groupStats(rows, keyFn, seed = []) {
  const map = new Map(seed.map((item) => [item.key, { ...item.value }]));
  rows.forEach((row) => {
    const key = keyFn(row);
    if (!key) return;
    const current = map.get(key) || {
      key,
      label: key,
      delivered: 0,
      postponed: 0,
      cancelled: 0,
      unresolved: 0,
      total: 0,
      facilityMinutes: 0,
      officialConfirmed: 0,
      officialRequired: 0,
      matchdays: new Set(),
    };
    current[row.status] = (current[row.status] || 0) + 1;
    current.total += 1;
    if (row.status === "delivered") {
      current.facilityMinutes += row.durationMins;
      current.officialRequired += 1;
      if (row.officialConfirmed) current.officialConfirmed += 1;
    }
    current.matchdays.add(row.entryId);
    map.set(key, current);
  });
  return [...map.values()].map((item) => {
    const outcomes = item.delivered + item.postponed + item.cancelled;
    return {
      ...item,
      matchdays: item.matchdays instanceof Set ? item.matchdays.size : item.matchdays || 0,
      facilityHours: Math.round((item.facilityMinutes / 60) * 10) / 10,
      scheduled: item.delivered,
      deliveryRate: outcomes ? Math.round((item.delivered / outcomes) * 100) : 0,
      scheduleCompletionRate: outcomes ? Math.round((item.delivered / outcomes) * 100) : 0,
      postponementRate: outcomes ? Math.round((item.postponed / outcomes) * 100) : 0,
      officialCoverage: item.officialRequired
        ? Math.round((item.officialConfirmed / item.officialRequired) * 100)
        : 0,
    };
  });
}

function applyFixtureFilters(rows, filters = {}) {
  return rows.filter((row) => {
    if (filters.team && filters.team !== "all" && normaliseText(row.homeTeam) !== filters.team) return false;
    if (filters.pitch && filters.pitch !== "all" && row.pitchId !== filters.pitch) return false;
    if (filters.format && filters.format !== "all" && row.format !== filters.format) return false;
    return true;
  });
}

function buildWeekly(entries, entryDays, club, pitchCfg) {
  return entries.map((entry) => {
    const days = entryDays.get(entry.id) || [];
    const rows = days.flatMap((day) => day.rows);
    const outcomes = rows.filter((row) => row.status !== "unresolved");
    const delivered = rows.filter((row) => row.status === "delivered");
    const postponed = rows.filter((row) => row.status === "postponed");
    const cancelled = rows.filter((row) => row.status === "cancelled");
    const unresolved = rows.filter((row) => row.status === "unresolved");
    const dayParking = days.map((day) => {
      const reportClub = clubWithEntryParking(club, entry);
      const snapshot = getParkingSnapshot({
        fixtures: day.rows
          .filter((row) => row.status === "delivered")
          .map((row) => ({ ...row.raw, __day: row.day })),
        club: reportClub,
        pitchCfg,
        scope: day.key,
      });
      return { day: day.key, dateLabel: day.dateLabel, hasRun: Boolean(day.hasRun), snapshot };
    });
    const peakParking = dayParking.reduce(
      (best, item) => (!best || item.snapshot.utilisation > best.snapshot.utilisation ||
        (item.snapshot.utilisation === best.snapshot.utilisation && item.snapshot.peakCars > best.snapshot.peakCars)
        ? item : best),
      null
    );
    const officialConfirmed = delivered.filter((row) => row.officialConfirmed).length;
    return {
      id: entry.id,
      label: shortDate(entry.date, entry.label),
      fullLabel: entry.fullLabel,
      date: entry.date,
      days,
      rows,
      total: outcomes.length,
      totalWithUnresolved: rows.length,
      delivered: delivered.length,
      scheduled: delivered.length,
      postponed: postponed.length,
      cancelled: cancelled.length,
      unresolved: unresolved.length,
      deliveryRate: outcomes.length ? Math.round((delivered.length / outcomes.length) * 100) : 0,
      scheduleCompletionRate: outcomes.length ? Math.round((delivered.length / outcomes.length) * 100) : 0,
      officialCoverage: delivered.length ? Math.round((officialConfirmed / delivered.length) * 100) : 0,
      parkingPeak: peakParking?.snapshot?.peakCars || 0,
      parkingPeakAt: peakParking?.snapshot?.peakTime || "TBC",
      parkingCapacity: peakParking?.snapshot?.capacity ?? getParkingCapacity(club, 0),
      parkingStatus: peakParking?.snapshot?.status || { key: "healthy", label: "Healthy", variant: "success" },
      parkingOver: Boolean(peakParking?.snapshot?.isOverCapacity || peakParking?.snapshot?.isOverConcurrentLimit),
      parkingEnabled: peakParking?.snapshot?.enabled ?? isParkingEnabled(club),
      dayParking,
    };
  });
}

export function buildOperationalEvidence({
  entries = [],
  scope = "matchweek",
  club = {},
  pitchCfg = [],
  teamCfg = [],
  filters = {},
} = {}) {
  const pitchMap = buildPitchMap(pitchCfg);
  const teamMap = buildTeamMap(teamCfg);
  const entryDays = new Map();

  entries.forEach((entry) => {
    entryDays.set(entry.id, normaliseEntryRows(entry, club, pitchMap, scope));
  });

  const unfilteredRows = entries.flatMap((entry) =>
    (entryDays.get(entry.id) || []).flatMap((day) => day.rows)
  );
  const rows = applyFixtureFilters(unfilteredRows, filters);
  const outcomes = rows.filter((row) => row.status !== "unresolved");
  const delivered = rows.filter((row) => row.status === "delivered");
  const postponed = rows.filter((row) => row.status === "postponed");
  const cancelled = rows.filter((row) => row.status === "cancelled");
  const unresolved = rows.filter((row) => row.status === "unresolved");
  const weekly = buildWeekly(entries, entryDays, club, pitchCfg).map((week) => {
    const filteredWeekRows = applyFixtureFilters(week.rows, filters);
    if (filteredWeekRows.length === week.rows.length) return week;
    const filteredOutcomes = filteredWeekRows.filter((row) => row.status !== "unresolved");
    const filteredDelivered = filteredWeekRows.filter((row) => row.status === "delivered");
    const filteredPostponed = filteredWeekRows.filter((row) => row.status === "postponed");
    const filteredCancelled = filteredWeekRows.filter((row) => row.status === "cancelled");
    const filteredUnresolved = filteredWeekRows.filter((row) => row.status === "unresolved");
    return {
      ...week,
      rows: filteredWeekRows,
      total: filteredOutcomes.length,
      totalWithUnresolved: filteredWeekRows.length,
      delivered: filteredDelivered.length,
      scheduled: filteredDelivered.length,
      postponed: filteredPostponed.length,
      cancelled: filteredCancelled.length,
      unresolved: filteredUnresolved.length,
      deliveryRate: filteredOutcomes.length ? Math.round((filteredDelivered.length / filteredOutcomes.length) * 100) : 0,
      scheduleCompletionRate: filteredOutcomes.length ? Math.round((filteredDelivered.length / filteredOutcomes.length) * 100) : 0,
      officialCoverage: filteredDelivered.length
        ? Math.round((filteredDelivered.filter((row) => row.officialConfirmed).length / filteredDelivered.length) * 100)
        : 0,
    };
  });

  const pitchSeed = [...pitchMap.values()].map((pitch) => ({
    key: pitch.id,
    value: {
      key: pitch.id,
      pitchId: pitch.id,
      label: pitch.label,
      description: pitch.description,
      delivered: 0,
      postponed: 0,
      cancelled: 0,
      unresolved: 0,
      total: 0,
      facilityMinutes: 0,
      officialConfirmed: 0,
      officialRequired: 0,
      matchdays: new Set(),
    },
  }));
  const pitchStats = groupStats(rows, (row) => row.pitchId || "unassigned", pitchSeed)
    .map((item) => ({
      ...item,
      pitchId: item.pitchId || item.key,
      label: item.label || (item.key === "unassigned" ? "Unassigned" : item.key),
      share: rows.length ? Math.round((item.total / rows.length) * 100) : 0,
    }))
    .filter((item) => item.total > 0 || (item.pitchId !== "unassigned" && asArray(pitchCfg).length > 0))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const teamStats = groupStats(rows, (row) => normaliseText(row.homeTeam))
    .map((item) => ({
      ...item,
      teamKey: item.key,
      label: teamMap.get(item.key)?.name || rows.find((row) => normaliseText(row.homeTeam) === item.key)?.homeTeam || item.key,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const formatStats = groupStats(rows, (row) => row.format)
    .map((item) => ({ ...item, format: item.key, label: item.key }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const kickOffMap = new Map();
  outcomes.forEach((row) => {
    if (row.koMins == null) return;
    const label = formatClock(row.koMins);
    kickOffMap.set(label, (kickOffMap.get(label) || 0) + 1);
  });
  const kickOffDistribution = [...kickOffMap.entries()]
    .map(([label, count]) => ({ label, count, minutes: parseClock(label) }))
    .sort((a, b) => a.minutes - b.minutes);

  const heatmapDays = DAY_ORDER.filter((key) => scopeIncludesDay(scope, key));
  const dayTimeHeatmap = heatmapDays.map((key) => ({
    day: key,
    label: dayLabel(key),
    values: kickOffDistribution.map((slot) => ({
      slot: slot.label,
      count: outcomes.filter((row) => row.day === key && row.koTime === slot.label).length,
    })),
  }));

  const pitchHeatmap = pitchStats
    .filter((pitch) => pitch.total > 0)
    .map((pitch) => ({
      pitchId: pitch.pitchId,
      label: pitch.label,
      values: weekly.map((week) => ({
        weekId: week.id,
        label: week.label,
        count: week.rows.filter((row) => row.pitchId === pitch.pitchId).length,
      })),
      total: pitch.total,
    }));

  const officialConfirmedCount = delivered.filter((row) => row.officialConfirmed).length;
  const weatherKnown = delivered.filter((row) => row.weatherRisk !== "unknown");
  const weatherHigh = weatherKnown.filter((row) => row.weatherRisk === "high").length;
  const weatherWatch = weatherKnown.filter((row) => row.weatherRisk === "watch").length;
  const busiestSlot = kickOffDistribution.reduce((best, item) => !best || item.count > best.count ? item : best, null);
  const busiestPitch = pitchStats.find((item) => item.total > 0) || null;
  const busiestTeam = teamStats[0] || null;
  const peakParkingWeek = weekly.reduce(
    (best, item) => !best || item.parkingPeak > best.parkingPeak ? item : best,
    null
  );
  const parkingOverCapacity = weekly.filter((week) => week.parkingOver).length;
  const totalFacilityMinutes = delivered.reduce((sum, row) => sum + row.durationMins, 0);

  const filterOptions = {
    teams: [
      { value: "all", label: "All teams" },
      ...[...new Map(unfilteredRows.map((row) => [normaliseText(row.homeTeam), row.homeTeam])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label })),
    ],
    pitches: [
      { value: "all", label: "All pitches" },
      ...[...pitchMap.values()].map((pitch) => ({ value: pitch.id, label: pitch.label })),
    ],
    formats: [
      { value: "all", label: "All formats" },
      ...[...new Set(unfilteredRows.map((row) => row.format))].sort().map((value) => ({ value, label: value })),
    ],
  };

  return {
    entries,
    entryDays,
    scope,
    rows,
    outcomes,
    delivered,
    scheduled: delivered,
    postponed,
    cancelled,
    unresolved,
    weekly,
    pitchStats,
    teamStats,
    formatStats,
    kickOffDistribution,
    dayTimeHeatmap,
    pitchHeatmap,
    filterOptions,
    summary: {
      total: outcomes.length,
      totalWithUnresolved: rows.length,
      delivered: delivered.length,
      scheduled: delivered.length,
      postponed: postponed.length,
      cancelled: cancelled.length,
      unresolved: unresolved.length,
      deliveryRate: outcomes.length ? Math.round((delivered.length / outcomes.length) * 100) : 0,
      scheduleCompletionRate: outcomes.length ? Math.round((delivered.length / outcomes.length) * 100) : 0,
      placementRate: rows.length ? Math.round((outcomes.length / rows.length) * 100) : 0,
      officialConfirmed: officialConfirmedCount,
      officialOutstanding: Math.max(0, delivered.length - officialConfirmedCount),
      officialCoverage: delivered.length ? Math.round((officialConfirmedCount / delivered.length) * 100) : 0,
      facilityHours: Math.round((totalFacilityMinutes / 60) * 10) / 10,
      avgFixtures: entries.length ? Math.round((outcomes.length / entries.length) * 10) / 10 : 0,
      busiestSlot,
      busiestPitch,
      busiestTeam,
      peakParking: peakParkingWeek?.parkingPeak || 0,
      peakParkingLabel: peakParkingWeek?.fullLabel || "No saved peak",
      parkingOverCapacity,
      parkingConfigured: weekly.filter((week) => !week.parkingEnabled || week.parkingCapacity > 0).length,
      weatherCoverage: delivered.length ? Math.round((weatherKnown.length / delivered.length) * 100) : 0,
      weatherHigh,
      weatherWatch,
    },
  };
}

export function getSourceOptions({ currentEntry, history = [] } = {}) {
  return [
    ...(currentEntry ? [{ value: currentEntry.id, label: currentEntry.fullLabel, kind: currentEntry.kind }] : []),
    ...normaliseSavedHistory(history).map((entry) => ({
      value: entry.id,
      label: entry.fullLabel,
      kind: entry.kind,
    })),
  ];
}

export { DAY_ORDER, scopeIncludesDay, dayLabel, formatDate, shortDate };
