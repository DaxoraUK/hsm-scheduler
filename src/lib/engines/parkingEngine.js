import { analyseParkingPressure, getParkingLoad, getParkingSettings } from "../intelligence/parking/parkingService.js";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getStatus({ utilisation = 0, overCapacity = false, overConcurrent = false } = {}) {
  if (overCapacity || utilisation > 100) {
    return {
      key: "critical",
      label: "Over capacity",
      variant: "danger",
      score: 35,
    };
  }

  if (overConcurrent || utilisation >= 85) {
    return {
      key: "watch",
      label: "Watch",
      variant: "warning",
      score: 70,
    };
  }

  return {
    key: "healthy",
    label: "Healthy",
    variant: "success",
    score: 100,
  };
}

function cleanKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function labelForDay(key, fallback = "Matchday") {
  const clean = cleanKey(key);
  if (clean.includes("sat")) return "Saturday";
  if (clean.includes("sun")) return "Sunday";
  return fallback || String(key || "Matchday");
}

function getSingleDayParkingSnapshot({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  dayKey = "matchday",
  dayLabel = "Matchday",
} = {}) {
  const settings = getParkingSettings(club);
  const analysis = analyseParkingPressure({
    fixtures,
    club,
    pitchCfg,
    startMins,
    slotMins,
  });

  const capacity = Math.max(0, toNumber(settings.carParkSpaces, 0));
  const peakSlot = analysis.peakSlot || null;
  const peakCars = peakSlot ? toNumber(peakSlot.estimatedCars, 0) : 0;
  const utilisation = capacity > 0 ? Math.round((peakCars / capacity) * 100) : 0;
  const peakTime = peakSlot?.label || "TBC";
  const peakFixtures = peakSlot?.parkingFixtures || [];
  const activeFixtures = analysis.parkingFixtures || [];
  const status = getStatus({
    utilisation,
    overCapacity: analysis.isOverCapacity,
    overConcurrent: analysis.isOverConcurrentLimit,
  });

  return {
    capacity,
    peakCars,
    utilisation,
    percentage: utilisation,
    peakTime,
    peakSlot,
    peakFixtures,
    activeFixtures,
    fixtureCount: activeFixtures.length,
    status,
    statusKey: status.key,
    statusLabel: status.label,
    variant: status.variant,
    healthScore: status.score,
    isOverCapacity: analysis.isOverCapacity || utilisation > 100,
    isOverConcurrentLimit: analysis.isOverConcurrentLimit,
    isHighPressure: analysis.isHighPressure || utilisation >= 85,
    overCapacitySlots: analysis.overCapacitySlots || [],
    overConcurrentSlots: analysis.overConcurrentSlots || [],
    highPressureSlots: analysis.highPressureSlots || [],
    suggestedMaxConcurrent: analysis.suggestedMaxConcurrent,
    canIncreaseConcurrentLimit: analysis.canIncreaseConcurrentLimit,
    timeline: analysis.slots || [],
    analysis,
    dayKey: cleanKey(dayKey) || "matchday",
    dayLabel: dayLabel || labelForDay(dayKey),
    scope: "single-day",
  };
}

function getFixtureDayKey(fixture = {}) {
  return (
    fixture.__parkingDay ||
    fixture.parkingDay ||
    fixture.dayKey ||
    fixture.__day ||
    fixture.day ||
    fixture.matchday ||
    fixture.fixtureDay ||
    fixture.dateLabel ||
    fixture.matchDate ||
    fixture.date ||
    null
  );
}

function normaliseDayGroups({ fixtures = [], fixturesByDay, satFixtures, sunFixtures } = {}) {
  const groups = [];
  const addGroup = (key, label, dayFixtures) => {
    if (!Array.isArray(dayFixtures) || dayFixtures.length === 0) return;
    const normalisedKey = cleanKey(key || label || `day-${groups.length + 1}`) || `day-${groups.length + 1}`;
    if (groups.some((group) => group.key === normalisedKey)) return;
    groups.push({
      key: normalisedKey,
      label: label || labelForDay(normalisedKey, `Day ${groups.length + 1}`),
      fixtures: dayFixtures,
    });
  };

  // Priority 1: explicit day groups. Do not also add the combined fixtures array.
  if (Array.isArray(fixturesByDay)) {
    fixturesByDay.forEach((group, index) => {
      const dayFixtures = Array.isArray(group) ? group : group?.fixtures;
      addGroup(group?.key || group?.id || group?.day || `day-${index + 1}`, group?.label || group?.name || group?.dayLabel, dayFixtures);
    });
    if (groups.length) return groups;
  }

  if (fixturesByDay && typeof fixturesByDay === "object") {
    Object.entries(fixturesByDay).forEach(([key, value]) => {
      const dayFixtures = Array.isArray(value) ? value : value?.fixtures;
      addGroup(key, value?.label || value?.name || labelForDay(key), dayFixtures);
    });
    if (groups.length) return groups;
  }

  // Priority 2: Saturday/Sunday arrays. This is the dashboard/twin path and prevents weekend summing.
  const hasExplicitSatSun = Array.isArray(satFixtures) || Array.isArray(sunFixtures);
  if (hasExplicitSatSun) {
    addGroup("saturday", "Saturday", satFixtures || []);
    addGroup("sunday", "Sunday", sunFixtures || []);
    if (groups.length) return groups;
  }

  // Priority 3: infer day from fixture metadata.
  if (Array.isArray(fixtures) && fixtures.length) {
    const grouped = new Map();
    let hasExplicitDayKeys = true;

    fixtures.forEach((fixture) => {
      const rawKey = getFixtureDayKey(fixture);
      if (!rawKey) {
        hasExplicitDayKeys = false;
        return;
      }

      const key = cleanKey(rawKey);
      if (!key) {
        hasExplicitDayKeys = false;
        return;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { key, label: labelForDay(key, String(rawKey)), fixtures: [] });
      }
      grouped.get(key).fixtures.push(fixture);
    });

    if (hasExplicitDayKeys && grouped.size > 1) {
      groups.push(...grouped.values());
    } else {
      groups.push({ key: "matchday", label: "Matchday", fixtures });
    }
  }

  return groups;
}

function choosePeakSnapshot(snapshots = []) {
  return snapshots.reduce((best, snapshot) => {
    if (!best) return snapshot;
    if ((snapshot.peakCars || 0) > (best.peakCars || 0)) return snapshot;
    if ((snapshot.peakCars || 0) === (best.peakCars || 0) && (snapshot.utilisation || 0) > (best.utilisation || 0)) return snapshot;
    return best;
  }, null);
}

export function getWeekendParkingSnapshot({
  fixtures = [],
  fixturesByDay,
  satFixtures,
  sunFixtures,
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  selectedDayKey = null,
} = {}) {
  const groups = normaliseDayGroups({ fixtures, fixturesByDay, satFixtures, sunFixtures });

  if (!groups.length) {
    return getSingleDayParkingSnapshot({ fixtures: [], club, pitchCfg, startMins, slotMins });
  }

  const daySnapshots = groups.map((group) =>
    getSingleDayParkingSnapshot({
      fixtures: group.fixtures,
      club,
      pitchCfg,
      startMins,
      slotMins,
      dayKey: group.key,
      dayLabel: group.label,
    })
  );

  const selectedKey = cleanKey(selectedDayKey);
  const selected = selectedKey
    ? daySnapshots.find((day) => day.dayKey === selectedKey || cleanKey(day.dayLabel) === selectedKey)
    : null;

  if (selected) {
    return {
      ...selected,
      dayBreakdown: daySnapshots,
      days: daySnapshots,
      scope: "selected-day",
      scopeLabel: selected.dayLabel,
      selectedDayKey: selected.dayKey,
      selectedDayLabel: selected.dayLabel,
    };
  }

  if (daySnapshots.length === 1) {
    return {
      ...daySnapshots[0],
      dayBreakdown: daySnapshots,
      days: daySnapshots,
      scope: "single-day",
      scopeLabel: daySnapshots[0].dayLabel,
    };
  }

  // Weekend parking must be the highest daily peak. It must never add Saturday + Sunday together.
  const peak = choosePeakSnapshot(daySnapshots) || daySnapshots[0];
  const status = getStatus({
    utilisation: peak.utilisation,
    overCapacity: peak.isOverCapacity,
    overConcurrent: peak.isOverConcurrentLimit,
  });

  return {
    ...peak,
    status,
    statusKey: status.key,
    statusLabel: status.label,
    variant: status.variant,
    healthScore: status.score,
    isOverCapacity: peak.isOverCapacity,
    isOverConcurrentLimit: peak.isOverConcurrentLimit,
    isHighPressure: peak.isHighPressure || peak.utilisation >= 85,
    dayBreakdown: daySnapshots,
    days: daySnapshots,
    scope: "weekend-peak",
    scopeLabel: "Weekend peak",
    peakDayKey: peak.dayKey,
    peakDayLabel: peak.dayLabel,
    detailByDay: daySnapshots.map((day) => ({
      key: day.dayKey,
      label: day.dayLabel,
      peakCars: day.peakCars,
      capacity: day.capacity,
      utilisation: day.utilisation,
      peakTime: day.peakTime,
      status: day.statusKey,
    })),
  };
}

export function getParkingSnapshot(args = {}) {
  if (args.fixturesByDay || Array.isArray(args.satFixtures) || Array.isArray(args.sunFixtures) || args.selectedDayKey) {
    return getWeekendParkingSnapshot(args);
  }

  const groups = normaliseDayGroups(args);
  if (groups.length > 1) {
    return getWeekendParkingSnapshot({ ...args, fixturesByDay: groups });
  }

  return getSingleDayParkingSnapshot(args);
}

function applyFixtureParkingPatch(fixtures = [], fixtureIndex, patch = {}) {
  return fixtures.map((fixture, index) => (index === fixtureIndex ? { ...fixture, ...patch } : fixture));
}

export function getFixtureParkingLoad({
  fixtures = [],
  fixtureIndex,
  fixture = {},
  patch = {},
  club = {},
  pitchCfg = [],
} = {}) {
  const current = fixture || fixtures[fixtureIndex] || {};
  const next = { ...current, ...patch };
  const load = getParkingLoad({
    fixtures,
    fixtureIndex,
    next,
    club,
    pitchCfg,
  });

  const capacity = Math.max(0, toNumber(getParkingSettings(club).carParkSpaces, 0));
  const estimatedCars = toNumber(load.estimatedCars, 0);
  const utilisation = capacity > 0 ? Math.round((estimatedCars / capacity) * 100) : 0;

  return {
    ...load,
    capacity,
    estimatedCars,
    utilisation,
    percentage: utilisation,
    peakCars: estimatedCars,
    fixtureCount: toNumber(load.concurrentGames, 0),
    overCapacity: Boolean(load.overCapacity || (capacity > 0 && estimatedCars > capacity)),
  };
}

export function getFixtureParkingImpact({
  fixtures = [],
  fixtureIndex,
  current = {},
  patch = {},
  club = {},
  pitchCfg = [],
} = {}) {
  const before = getFixtureParkingLoad({
    fixtures,
    fixtureIndex,
    fixture: current || fixtures[fixtureIndex] || {},
    patch: {},
    club,
    pitchCfg,
  });

  const after = getFixtureParkingLoad({
    fixtures,
    fixtureIndex,
    fixture: current || fixtures[fixtureIndex] || {},
    patch,
    club,
    pitchCfg,
  });

  return {
    before,
    after,
    carDelta: before.estimatedCars - after.estimatedCars,
    gameDelta: before.fixtureCount - after.fixtureCount,
    percentDelta: before.percentage - after.percentage,
  };
}

export function getMatchdayParkingImpact({
  fixtures = [],
  fixtureIndex,
  patch = {},
  club = {},
  pitchCfg = [],
} = {}) {
  const before = getParkingSnapshot({ fixtures, club, pitchCfg });
  const afterFixtures = applyFixtureParkingPatch(fixtures, fixtureIndex, patch);
  const after = getParkingSnapshot({ fixtures: afterFixtures, club, pitchCfg });

  return {
    before: {
      ...before,
      estimatedCars: before.peakCars,
      percentage: before.utilisation,
      concurrentGames: before.peakSlot?.fixtureCount || 0,
      label: before.peakTime,
    },
    after: {
      ...after,
      estimatedCars: after.peakCars,
      percentage: after.utilisation,
      concurrentGames: after.peakSlot?.fixtureCount || 0,
      label: after.peakTime,
    },
    carDelta: before.peakCars - after.peakCars,
    gameDelta: (before.peakSlot?.fixtureCount || 0) - (after.peakSlot?.fixtureCount || 0),
    percentDelta: before.utilisation - after.utilisation,
    beforeAnalysis: before.analysis,
    afterAnalysis: after.analysis,
  };
}

export function getParkingSummary(args = {}) {
  const snapshot = getParkingSnapshot(args);

  return {
    ...snapshot,
    headline:
      snapshot.capacity <= 0
        ? "Parking capacity not configured"
        : snapshot.peakCars <= 0
          ? "No parking demand yet"
          : `${snapshot.peakCars}/${snapshot.capacity} spaces at ${snapshot.peakTime}`,
    detail:
      snapshot.capacity <= 0
        ? "Add parking capacity in Settings before reviewing parking readiness."
        : snapshot.scope === "weekend-peak"
          ? `${snapshot.utilisation}% weekend peak use on ${snapshot.peakDayLabel || "the busiest day"} at ${snapshot.peakTime}.`
          : `${snapshot.utilisation}% peak use based on the busiest active parking window.`,
  };
}

export default getParkingSnapshot;
