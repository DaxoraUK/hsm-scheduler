import { AVG_CARS, PITCHES } from "../constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(number(value, 0))));
}

function parseClock(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatClock(minutes) {
  if (!Number.isFinite(minutes)) return "Unscheduled";
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.round(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function fixtureStart(fixture = {}) {
  return parseClock(
    fixture.koMins ??
      fixture.kickOffMins ??
      fixture.startMins ??
      fixture.koTime ??
      fixture.kickOff ??
      fixture.time
  );
}

function fixtureDuration(fixture = {}) {
  const start = fixtureStart(fixture);
  const end = parseClock(fixture.endMins ?? fixture.finishMins ?? fixture.endTime);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) return end - start;

  const configured = number(
    fixture.cfg?.gameMins ?? fixture.gameMins ?? fixture.durationMins ?? fixture.duration,
    0
  );
  return configured > 0 ? configured : 60;
}

function fixturePitchId(fixture = {}) {
  return String(
    fixture.pitchId || fixture.pitch || fixture.pitchName || fixture.pitchLabel || ""
  ).trim();
}

function fixtureFormat(fixture = {}) {
  return String(
    fixture.cfg?.format || fixture.format || fixture.gameFormat || fixture.pitchFormat || ""
  ).trim();
}

function fixtureStatus(fixture = {}) {
  const status = normalise(fixture.status || fixture.fixtureStatus || fixture.outcome);
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("postpone")) return "postponed";
  return "delivered";
}

function officialConfirmed(fixture = {}) {
  const status = normalise(
    fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || fixture.assignmentStatus
  );
  return status === "confirmed" || status === "accepted" || status === "assigned";
}

function parseEntryDate(entry = {}, fallbackIndex = 0) {
  const candidates = [entry.savedAt, entry.date, entry.satDate, entry.dateLabel];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(Date.now() - fallbackIndex * 7 * DAY_MS);
}

function shortDate(date, fallback = "Saved week") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fullDate(date, fallback = "Saved matchday") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function monthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Unknown month";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function withDay(fixtures, day, source) {
  return asArray(fixtures).map((fixture) => ({ ...fixture, __day: day, __source: source }));
}

function entryFixtureDays(entry = {}) {
  if (asArray(entry.fixtureDays).length) {
    return asArray(entry.fixtureDays).map((day) => ({
      key: String(day.key || day.day || "matchday").toLowerCase(),
      scheduled: asArray(day.scheduled),
      postponed: asArray(day.postponed),
      cancelled: asArray(day.cancelled),
    }));
  }

  return [
    {
      key: "saturday",
      scheduled: asArray(entry.scheduled),
      postponed: asArray(entry.postponedGames),
      cancelled: [],
    },
    {
      key: "sunday",
      scheduled: asArray(entry.sunScheduled),
      postponed: asArray(entry.sunPostponed),
      cancelled: [],
    },
    {
      key: "midweek",
      scheduled: asArray(entry.midweekScheduled),
      postponed: asArray(entry.midweekPostponed),
      cancelled: [],
    },
  ];
}

function entryFixtures(entry = {}, dayFilter = "matchweek") {
  const days = entryFixtureDays(entry);
  const selectedDays = days.filter((day) => {
    if (dayFilter === "matchweek" || dayFilter === "all") return true;
    if (dayFilter === "weekend") return ["saturday", "sunday"].includes(day.key);
    return day.key === dayFilter;
  });

  return selectedDays
    .flatMap((day) => [
      ...withDay(day.scheduled, day.key, "scheduled"),
      ...withDay(day.postponed, day.key, "postponed"),
      ...withDay(day.cancelled, day.key, "cancelled"),
    ])
    .map((fixture) => {
      const sourceStatus =
        fixture.__source === "postponed"
          ? "postponed"
          : fixture.__source === "cancelled"
            ? "cancelled"
            : fixtureStatus(fixture);
      return { ...fixture, __status: sourceStatus };
    });
}

function estimateCars(fixture = {}, club = {}) {
  const format = fixtureFormat(fixture);
  return number(club?.avgCars?.[format] ?? AVG_CARS[format], 8);
}

function calculateParkingPeak(fixtures = [], club = {}) {
  const active = fixtures.filter((fixture) => fixture.__status === "delivered");
  const points = new Set();

  active.forEach((fixture) => {
    const start = fixtureStart(fixture);
    if (!Number.isFinite(start)) return;
    points.add(start);
    points.add(start + fixtureDuration(fixture));
  });

  let peak = 0;
  let peakAt = null;
  [...points]
    .sort((a, b) => a - b)
    .forEach((point) => {
      const occupancy = active.reduce((total, fixture) => {
        const start = fixtureStart(fixture);
        if (!Number.isFinite(start)) return total;
        const end = start + fixtureDuration(fixture);
        return start <= point && end > point ? total + estimateCars(fixture, club) : total;
      }, 0);

      if (occupancy > peak) {
        peak = occupancy;
        peakAt = point;
      }
    });

  return { peak, peakAt };
}

function buildPitchMap(pitchCfg = []) {
  const source = asArray(pitchCfg).length ? asArray(pitchCfg) : asArray(PITCHES);
  return new Map(
    source.map((pitch) => [
      String(pitch.id || pitch.pitchId || pitch.label || ""),
      {
        id: String(pitch.id || pitch.pitchId || pitch.label || ""),
        label: pitch.label || pitch.name || pitch.id || "Unknown pitch",
        description: pitch.desc || pitch.description || pitch.format || "",
      },
    ])
  );
}

function makePeriodOptions(entries = []) {
  const options = [
    { value: "all", label: "All saved matchdays" },
    { value: "last-4", label: "Last 4 matchdays" },
    { value: "last-8", label: "Last 8 matchdays" },
    { value: "last-12", label: "Last 12 matchdays" },
  ];

  const seen = new Set();
  entries.forEach((entry) => {
    const key = monthKey(entry.date);
    if (key === "unknown" || seen.has(key)) return;
    seen.add(key);
    options.push({ value: `month:${key}`, label: monthLabel(entry.date) });
  });

  return options;
}

function filterEntries(entries, period = "all", matchday = "all") {
  let result = entries;

  if (matchday !== "all") {
    result = entries.filter((entry) => entry.id === matchday);
  } else if (period.startsWith("last-")) {
    const limit = number(period.replace("last-", ""), entries.length);
    result = entries.slice(-limit);
  } else if (period.startsWith("month:")) {
    const key = period.replace("month:", "");
    result = entries.filter((entry) => monthKey(entry.date) === key);
  }

  return result;
}

function insightSentence({ total, deliveryRate, busiestSlot, busiestPitch, parkingOverCapacity, weeks }) {
  if (!weeks) return "Save completed matchdays to begin building trend evidence.";

  const parts = [
    `${total} fixture${total === 1 ? "" : "s"} recorded across ${weeks} matchday${weeks === 1 ? "" : "s"}`,
    `${deliveryRate}% delivered as planned`,
  ];

  if (busiestSlot?.label) parts.push(`${busiestSlot.label} is the busiest kick-off window`);
  if (busiestPitch?.label) parts.push(`${busiestPitch.label} carries the highest pitch load`);
  if (parkingOverCapacity > 0) {
    parts.push(`${parkingOverCapacity} matchday${parkingOverCapacity === 1 ? "" : "s"} exceeded parking capacity`);
  }

  return `${parts.join(". ")}.`;
}

export function buildAnalyticsVisualisationModel({
  history = [],
  club = {},
  pitchCfg = [],
  period = "all",
  matchday = "all",
  day = "matchweek",
} = {}) {
  const pitchMap = buildPitchMap(pitchCfg);
  const entries = asArray(history)
    .map((entry, index) => {
      const date = parseEntryDate(entry, index);
      return {
        raw: entry,
        id: String(entry.id || entry.savedAt || `${entry.dateLabel || "week"}-${index}`),
        date,
        label: shortDate(date, entry.dateLabel),
        fullLabel: fullDate(date, entry.dateLabel),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const selectedEntries = filterEntries(entries, period, matchday);
  const capacity = Math.max(0, number(club.carParkSpaces, 0));

  const weekly = selectedEntries.map((entry) => {
    const fixtures = entryFixtures(entry.raw, day);
    const delivered = fixtures.filter((fixture) => fixture.__status === "delivered");
    const postponed = fixtures.filter((fixture) => fixture.__status === "postponed");
    const cancelled = fixtures.filter((fixture) => fixture.__status === "cancelled");
    const officialConfirmedCount = delivered.filter(officialConfirmed).length;
    const parking = calculateParkingPeak(fixtures, club);

    return {
      ...entry,
      fixtures,
      delivered: delivered.length,
      postponed: postponed.length,
      cancelled: cancelled.length,
      total: fixtures.length,
      officialCoverage: delivered.length
        ? Math.round((officialConfirmedCount / delivered.length) * 100)
        : 0,
      parkingPeak: parking.peak,
      parkingPeakAt: parking.peakAt,
      parkingCapacity: number(entry.raw.carParkSpaces, capacity),
    };
  });

  const fixtures = weekly.flatMap((week) => week.fixtures.map((fixture) => ({ ...fixture, __weekId: week.id })));
  const delivered = fixtures.filter((fixture) => fixture.__status === "delivered");
  const postponed = fixtures.filter((fixture) => fixture.__status === "postponed");
  const cancelled = fixtures.filter((fixture) => fixture.__status === "cancelled");
  const total = fixtures.length;
  const deliveryRate = total ? Math.round((delivered.length / total) * 100) : 0;
  const officialConfirmedCount = delivered.filter(officialConfirmed).length;
  const officialCoverage = delivered.length
    ? Math.round((officialConfirmedCount / delivered.length) * 100)
    : 0;

  const kickOffMap = new Map();
  fixtures.forEach((fixture) => {
    const start = fixtureStart(fixture);
    if (!Number.isFinite(start)) return;
    const key = formatClock(start);
    kickOffMap.set(key, (kickOffMap.get(key) || 0) + 1);
  });
  const kickOffDistribution = [...kickOffMap.entries()]
    .map(([label, count]) => ({ label, count, minutes: parseClock(label) }))
    .sort((a, b) => a.minutes - b.minutes);

  const busiestSlot = kickOffDistribution.reduce(
    (best, item) => (!best || item.count > best.count ? item : best),
    null
  );

  const pitchStatsMap = new Map();
  fixtures.forEach((fixture) => {
    const pitchId = fixturePitchId(fixture);
    if (!pitchId) return;
    const current = pitchStatsMap.get(pitchId) || {
      pitchId,
      label: pitchMap.get(pitchId)?.label || pitchId,
      description: pitchMap.get(pitchId)?.description || "",
      delivered: 0,
      postponed: 0,
      cancelled: 0,
      total: 0,
    };
    current[fixture.__status] += 1;
    current.total += 1;
    pitchStatsMap.set(pitchId, current);
  });

  const pitchUtilisation = [...pitchStatsMap.values()]
    .map((pitch) => ({
      ...pitch,
      share: total ? Math.round((pitch.total / total) * 100) : 0,
      postponementRate: pitch.total ? Math.round((pitch.postponed / pitch.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  const busiestPitch = pitchUtilisation[0] || null;

  const pitchHeatmap = pitchUtilisation.map((pitch) => ({
    pitchId: pitch.pitchId,
    label: pitch.label,
    values: weekly.map((week) => ({
      weekId: week.id,
      label: week.label,
      count: week.fixtures.filter((fixture) => fixturePitchId(fixture) === pitch.pitchId).length,
    })),
    total: pitch.total,
  }));

  const allSlots = [...new Set(kickOffDistribution.map((item) => item.label))].sort(
    (a, b) => parseClock(a) - parseClock(b)
  );
  const heatmapDays =
    day === "saturday"
      ? ["saturday"]
      : day === "sunday"
        ? ["sunday"]
        : day === "midweek"
          ? ["midweek"]
          : day === "weekend"
            ? ["saturday", "sunday"]
            : ["midweek", "saturday", "sunday"];
  const dayTimeHeatmap = heatmapDays.map((dayName) => ({
    day: dayName,
    label: dayName === "saturday" ? "Saturday" : dayName === "sunday" ? "Sunday" : "Midweek",
    values: allSlots.map((slot) => ({
      slot,
      count: fixtures.filter(
        (fixture) => fixture.__day === dayName && formatClock(fixtureStart(fixture)) === slot
      ).length,
    })),
  }));

  const parkingOverCapacity = weekly.filter(
    (week) => week.parkingPeak > week.parkingCapacity
  ).length;
  const peakParkingWeek = weekly.reduce(
    (best, item) => (!best || item.parkingPeak > best.parkingPeak ? item : best),
    null
  );

  const matchdayOptions = [
    { value: "all", label: "All matchdays" },
    ...entries
      .slice()
      .reverse()
      .map((entry) => ({ value: entry.id, label: entry.fullLabel })),
  ];

  const avgFixtures = weekly.length ? Math.round((total / weekly.length) * 10) / 10 : 0;
  const facilityHours = Math.round(
    delivered.reduce((sum, fixture) => sum + fixtureDuration(fixture), 0) / 60
  );

  const evidenceScore = clamp(
    Math.min(40, weekly.length * 5) +
      (total > 0 ? 20 : 0) +
      (pitchUtilisation.length > 0 ? 15 : 0) +
      (kickOffDistribution.length > 0 ? 10 : 0) +
      (officialConfirmedCount > 0 ? 10 : 0) +
      (weekly.some((week) => week.parkingPeak > 0) ? 5 : 0)
  );

  return {
    filters: {
      periodOptions: makePeriodOptions(entries),
      matchdayOptions,
      selectedPeriod: period,
      selectedMatchday: matchday,
      selectedDay: day,
    },
    hasData: weekly.length > 0 && total > 0,
    savedMatchdays: entries.length,
    selectedMatchdays: weekly.length,
    summary: {
      total,
      delivered: delivered.length,
      postponed: postponed.length,
      cancelled: cancelled.length,
      deliveryRate,
      officialCoverage,
      avgFixtures,
      facilityHours,
      evidenceScore,
      busiestSlot,
      busiestPitch,
      parkingOverCapacity,
      peakParking: peakParkingWeek?.parkingPeak || 0,
      peakParkingLabel: peakParkingWeek?.fullLabel || "No saved peak",
      insight: insightSentence({
        total,
        deliveryRate,
        busiestSlot,
        busiestPitch,
        parkingOverCapacity,
        weeks: weekly.length,
      }),
    },
    weekly,
    kickOffDistribution,
    pitchUtilisation,
    pitchHeatmap,
    dayTimeHeatmap,
    parkingCapacity: capacity,
  };
}
