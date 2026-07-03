import {
  analyseParkingPressure,
  getEstimatedCarsForFixture,
  getFixtureWindow,
  getParkingSettings,
  pitchAffectsParking,
} from "../intelligence/parking/parkingService.js";

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseScope(scope = "auto") {
  const value = String(scope || "auto").toLowerCase();
  if (["saturday", "sat"].includes(value)) return "saturday";
  if (["sunday", "sun"].includes(value)) return "sunday";
  if (["weekend", "all"].includes(value)) return "weekend";
  return "auto";
}

function getFixtureDayKey(fixture = {}) {
  const raw =
    fixture.__day ||
    fixture.day ||
    fixture.matchday ||
    fixture.matchDay ||
    fixture.fixtureDay ||
    fixture.dateLabel ||
    fixture.date ||
    fixture.kickoffDate ||
    fixture.kickOffDate ||
    "matchday";

  const value = String(raw || "matchday").toLowerCase();

  if (value.includes("sat")) return "saturday";
  if (value.includes("sun")) return "sunday";

  return value || "matchday";
}

function filterByScope(fixtures = [], scope = "auto") {
  const normalised = normaliseScope(scope);

  if (normalised === "saturday" || normalised === "sunday") {
    return fixtures.filter((fixture) => getFixtureDayKey(fixture) === normalised);
  }

  return fixtures;
}

function groupFixturesByDay(fixtures = []) {
  return fixtures.reduce((groups, fixture) => {
    const key = getFixtureDayKey(fixture);
    if (!groups[key]) groups[key] = [];
    groups[key].push(fixture);
    return groups;
  }, {});
}

function hasMultipleDayGroups(fixtures = []) {
  return Object.keys(groupFixturesByDay(fixtures)).length > 1;
}

function getStatus({
  enabled = true,
  utilisation = 0,
  overCapacity = false,
  overConcurrent = false,
  capacityConfigured = true,
  pressureThresholdPct = 85,
} = {}) {
  if (!enabled) {
    return {
      key: "disabled",
      label: "Off",
      variant: "neutral",
      score: 100,
    };
  }

  if (!capacityConfigured) {
    return {
      key: "configure",
      label: "Configure",
      variant: "warning",
      score: 60,
    };
  }

  if (overCapacity || utilisation > 100) {
    return {
      key: "critical",
      label: "Over capacity",
      variant: "danger",
      score: 35,
    };
  }

  if (overConcurrent || utilisation >= pressureThresholdPct) {
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

function analyseSingleScope({ fixtures = [], club = {}, pitchCfg = [], startMins, slotMins, scopeLabel = "matchday" } = {}) {
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
    enabled: settings.enabled,
    utilisation,
    overCapacity: analysis.isOverCapacity,
    overConcurrent: analysis.isOverConcurrentLimit,
    capacityConfigured: capacity > 0,
    pressureThresholdPct: settings.parkingPressureThresholdPct,
  });

  return {
    enabled: settings.enabled,
    configured: settings.configured,
    scope: scopeLabel,
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
    isHighPressure: analysis.isHighPressure,
    overCapacitySlots: analysis.overCapacitySlots || [],
    overConcurrentSlots: analysis.overConcurrentSlots || [],
    highPressureSlots: analysis.highPressureSlots || [],
    suggestedMaxConcurrent: analysis.suggestedMaxConcurrent,
    canIncreaseConcurrentLimit: analysis.canIncreaseConcurrentLimit,
    timeline: analysis.slots || [],
    analysis,
  };
}

function mergeWeekendSnapshot(daySnapshots = []) {
  const valid = daySnapshots.filter(Boolean);

  if (!valid.length) {
    return analyseSingleScope({ fixtures: [], scopeLabel: "weekend" });
  }

  const highestPeak = [...valid].sort((a, b) => {
    if (b.utilisation !== a.utilisation) return b.utilisation - a.utilisation;
    return b.peakCars - a.peakCars;
  })[0];

  const status = getStatus({
    enabled: highestPeak.enabled,
    utilisation: highestPeak.utilisation,
    overCapacity: highestPeak.isOverCapacity,
    overConcurrent: highestPeak.isOverConcurrentLimit,
    capacityConfigured: highestPeak.capacity > 0,
    pressureThresholdPct:
      highestPeak.analysis?.settings?.parkingPressureThresholdPct || 85,
  });

  return {
    ...highestPeak,
    scope: "weekend",
    sourceScope: highestPeak.scope,
    daySnapshots: valid,
    status,
    statusKey: status.key,
    statusLabel: status.label,
    variant: status.variant,
    healthScore: status.score,
    detailScopeLabel:
      highestPeak.scope === "saturday"
        ? "Saturday peak"
        : highestPeak.scope === "sunday"
          ? "Sunday peak"
          : "Busiest daily peak",
  };
}

export function getParkingSnapshot({
  fixtures = [],
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  scope = "auto",
} = {}) {
  const normalisedScope = normaliseScope(scope);
  const scopedFixtures = filterByScope(fixtures, normalisedScope);

  if (
    normalisedScope === "weekend" ||
    (normalisedScope === "auto" && hasMultipleDayGroups(scopedFixtures))
  ) {
    const groups = groupFixturesByDay(scopedFixtures);
    const daySnapshots = Object.entries(groups).map(([day, dayFixtures]) =>
      analyseSingleScope({
        fixtures: dayFixtures,
        club,
        pitchCfg,
        startMins,
        slotMins,
        scopeLabel: day,
      })
    );

    if (!daySnapshots.length) {
      return analyseSingleScope({
        fixtures: [],
        club,
        pitchCfg,
        startMins,
        slotMins,
        scopeLabel: "weekend",
      });
    }

    return mergeWeekendSnapshot(daySnapshots);
  }

  const label = normalisedScope === "auto" ? getFixtureDayKey(scopedFixtures[0]) : normalisedScope;

  return analyseSingleScope({
    fixtures: scopedFixtures,
    club,
    pitchCfg,
    startMins,
    slotMins,
    scopeLabel: label,
  });
}

export function getParkingSummary(args = {}) {
  const snapshot = getParkingSnapshot(args);
  const scopeLabel = snapshot.detailScopeLabel || snapshot.scope || "matchday";

  return {
    ...snapshot,
    headline:
      !snapshot.enabled
        ? "Parking is switched off"
        : snapshot.capacity <= 0
          ? "Parking capacity not configured"
        : snapshot.peakCars <= 0
          ? "No parking demand yet"
          : `${snapshot.peakCars}/${snapshot.capacity} spaces at ${snapshot.peakTime}`,
    detail:
      !snapshot.enabled
        ? "Parking is excluded from readiness, validation and recommendations."
        : snapshot.capacity <= 0
          ? "Add parking capacity in Settings before reviewing parking readiness."
        : `${snapshot.utilisation}% peak use based on the ${scopeLabel}.`,
  };
}

function applyFixturePatch(fixtures = [], fixtureIndex, patch = {}, replacementFixture = null) {
  if (!Array.isArray(fixtures)) return [];

  const index = Number(fixtureIndex);

  if (Number.isInteger(index) && index >= 0 && index < fixtures.length) {
    return fixtures.map((fixture, itemIndex) =>
      itemIndex === index ? { ...fixture, ...(replacementFixture || {}), ...patch } : fixture
    );
  }

  if (replacementFixture) {
    const candidateId = replacementFixture.id || replacementFixture.fixtureId || replacementFixture.key;

    if (candidateId) {
      return fixtures.map((fixture) => {
        const fixtureId = fixture.id || fixture.fixtureId || fixture.key;
        return fixtureId === candidateId ? { ...fixture, ...replacementFixture, ...patch } : fixture;
      });
    }
  }

  return fixtures;
}

function normaliseImpactSnapshot(snapshot = {}) {
  return {
    ...snapshot,
    estimatedCars: Number(snapshot.peakCars || 0),
    percentage: Number(snapshot.percentage ?? snapshot.utilisation ?? 0),
    games: Number(snapshot.fixtureCount || 0),
    label: snapshot.peakTime || snapshot.scope || "matchday",
  };
}

function buildParkingImpact(beforeSnapshot, afterSnapshot) {
  const before = normaliseImpactSnapshot(beforeSnapshot);
  const after = normaliseImpactSnapshot(afterSnapshot);

  const beforeCars = Number(before.estimatedCars || 0);
  const afterCars = Number(after.estimatedCars || 0);
  const beforePct = Number(before.percentage || 0);
  const afterPct = Number(after.percentage || 0);
  const beforeGames = Number(before.games || 0);
  const afterGames = Number(after.games || 0);

  return {
    before,
    after,
    carDelta: Math.max(0, beforeCars - afterCars),
    percentDelta: Math.max(0, beforePct - afterPct),
    gameDelta: Math.max(0, beforeGames - afterGames),
    deltaCars: afterCars - beforeCars,
    deltaUtilisation: afterPct - beforePct,
  };
}

export function getMatchdayParkingImpact({
  fixtures = [],
  fixtureIndex,
  patch = {},
  club = {},
  pitchCfg = [],
  scope = "auto",
  startMins,
  slotMins,
} = {}) {
  const before = getParkingSnapshot({ fixtures, club, pitchCfg, scope, startMins, slotMins });
  const afterFixtures = applyFixturePatch(fixtures, fixtureIndex, patch);
  const after = getParkingSnapshot({ fixtures: afterFixtures, club, pitchCfg, scope, startMins, slotMins });

  return buildParkingImpact(before, after);
}

export function getFixtureParkingImpact({
  fixture,
  fixtures = [],
  fixtureIndex,
  current = null,
  patch = {},
  club = {},
  pitchCfg = [],
  scope = "auto",
  startMins,
  slotMins,
} = {}) {
  const replacementFixture = fixture || current || null;
  const before = getParkingSnapshot({ fixtures, club, pitchCfg, scope, startMins, slotMins });
  const afterFixtures = applyFixturePatch(fixtures, fixtureIndex, patch, replacementFixture);
  const after = getParkingSnapshot({ fixtures: afterFixtures, club, pitchCfg, scope, startMins, slotMins });

  return buildParkingImpact(before, after);
}

export function getDayScopedParkingSummary({ fixtures = [], club = {}, pitchCfg = [], startMins, slotMins } = {}) {
  const groups = groupFixturesByDay(fixtures);

  return Object.fromEntries(
    Object.entries(groups).map(([day, dayFixtures]) => [
      day,
      getParkingSummary({
        fixtures: dayFixtures,
        club,
        pitchCfg,
        startMins,
        slotMins,
        scope: day,
      }),
    ])
  );
}



function formatParkingTime(totalMinutes) {
  const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function allocateWeightedCars(totalCars, weights = []) {
  const total = Math.max(0, Math.round(Number(totalCars) || 0));
  if (!weights.length || total === 0) return weights.map(() => 0);

  const raw = weights.map((weight) => total * Number(weight || 0));
  const allocation = raw.map((value) => Math.floor(value));
  let remaining = total - allocation.reduce((sum, value) => sum + value, 0);

  raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => {
      if (remaining <= 0) return;
      allocation[index] += 1;
      remaining -= 1;
    });

  return allocation;
}

function getParkingFixtureName(fixture = {}) {
  return fixture.homeTeam || fixture.team || fixture.fixture || fixture.title || "Fixture";
}

function groupContiguousSlots(slots = [], slotMins = 15) {
  if (!slots.length) return [];

  const sorted = [...slots].sort((a, b) => a.mins - b.mins);
  const groups = [];

  sorted.forEach((slot) => {
    const current = groups[groups.length - 1];
    const last = current?.slots?.[current.slots.length - 1];

    if (!current || !last || slot.mins - last.mins > slotMins) {
      groups.push({ slots: [slot] });
      return;
    }

    current.slots.push(slot);
  });

  return groups.map((group, index) => {
    const first = group.slots[0];
    const last = group.slots[group.slots.length - 1];
    const peak = [...group.slots].sort((a, b) => {
      const bValue = Number(b.estimatedCars ?? b.arrivalCars ?? 0);
      const aValue = Number(a.estimatedCars ?? a.arrivalCars ?? 0);
      return bValue - aValue;
    })[0];

    return {
      id: `parking-window-${index}-${first.mins}`,
      startMins: first.mins,
      endMins: last.mins + slotMins,
      start: first.label || formatParkingTime(first.mins),
      end: formatParkingTime(last.mins + slotMins),
      label: `${first.label || formatParkingTime(first.mins)}–${formatParkingTime(last.mins + slotMins)}`,
      slots: group.slots,
      peak,
    };
  });
}

/**
 * Models arrival and departure waves separately from occupancy. The existing
 * parking snapshot remains the source of truth for capacity checks; this
 * forecast gives matchday staff a practical view of when vehicle movements
 * are likely to be heaviest.
 */
export function buildParkingArrivalForecast({
  fixtures = [],
  club = {},
  pitchCfg = [],
  slotMins = 15,
} = {}) {
  const capacity = Math.max(0, Number(getParkingSettings(club).carParkSpaces || 0));
  const activeFixtures = (fixtures || [])
    .filter(
      (fixture) =>
        fixture &&
        fixture.status !== "postponed" &&
        pitchAffectsParking(fixture, pitchCfg, club)
    )
    .map((fixture) => ({
      fixture,
      window: getFixtureWindow(fixture),
      cars: getEstimatedCarsForFixture(fixture, club, pitchCfg),
    }))
    .filter((item) => item.window && item.cars > 0);

  if (!activeFixtures.length) {
    return {
      slots: [],
      peakArrivalSlot: null,
      peakDepartureSlot: null,
      highArrivalWindows: [],
      turnoverSlots: [],
      totalEstimatedArrivals: 0,
      threshold: 0,
    };
  }

  const earliest = Math.min(...activeFixtures.map((item) => item.window.start - 45));
  const latest = Math.max(...activeFixtures.map((item) => item.window.end + 30));
  const start = Math.floor(earliest / slotMins) * slotMins;
  const end = Math.ceil(latest / slotMins) * slotMins;
  const slotMap = new Map();

  for (let mins = start; mins <= end; mins += slotMins) {
    slotMap.set(mins, {
      mins,
      label: formatParkingTime(mins),
      arrivalCars: 0,
      departureCars: 0,
      netFlow: 0,
      arrivalFixtures: [],
      departureFixtures: [],
    });
  }

  const arrivalOffsets = [-45, -30, -15, 0];
  const arrivalWeights = [0.15, 0.35, 0.35, 0.15];
  const departureOffsets = [0, 15];
  const departureWeights = [0.7, 0.3];

  activeFixtures.forEach(({ fixture, window, cars }) => {
    const arrivalAllocation = allocateWeightedCars(cars, arrivalWeights);
    const departureAllocation = allocateWeightedCars(cars, departureWeights);
    const fixtureName = getParkingFixtureName(fixture);

    arrivalOffsets.forEach((offset, index) => {
      const mins = Math.floor((window.start + offset) / slotMins) * slotMins;
      const slot = slotMap.get(mins);
      const allocatedCars = arrivalAllocation[index] || 0;
      if (!slot || allocatedCars <= 0) return;

      slot.arrivalCars += allocatedCars;
      slot.arrivalFixtures.push({ fixture, name: fixtureName, cars: allocatedCars });
    });

    departureOffsets.forEach((offset, index) => {
      const mins = Math.floor((window.end + offset) / slotMins) * slotMins;
      const slot = slotMap.get(mins);
      const allocatedCars = departureAllocation[index] || 0;
      if (!slot || allocatedCars <= 0) return;

      slot.departureCars += allocatedCars;
      slot.departureFixtures.push({ fixture, name: fixtureName, cars: allocatedCars });
    });
  });

  const slots = [...slotMap.values()].map((slot) => ({
    ...slot,
    netFlow: slot.arrivalCars - slot.departureCars,
  }));
  const peakArrivalSlot = [...slots].sort((a, b) => b.arrivalCars - a.arrivalCars)[0] || null;
  const peakDepartureSlot = [...slots].sort((a, b) => b.departureCars - a.departureCars)[0] || null;
  const threshold = Math.max(6, Math.ceil(capacity * 0.18));
  const highArrivalSlots = slots.filter((slot) => slot.arrivalCars >= threshold);
  const highArrivalWindows = groupContiguousSlots(highArrivalSlots, slotMins);
  const turnoverSlots = slots.filter(
    (slot) => slot.arrivalCars > 0 && slot.departureCars > 0
  );

  return {
    slots,
    peakArrivalSlot,
    peakDepartureSlot,
    highArrivalWindows,
    turnoverSlots,
    totalEstimatedArrivals: activeFixtures.reduce((sum, item) => sum + item.cars, 0),
    threshold,
  };
}

export function buildParkingPressureWindows(snapshot = {}) {
  const slots = snapshot.timeline || snapshot.analysis?.slots || [];
  if (!slots.length) return [];

  const interval = slots.length > 1
    ? Math.max(15, Number(slots[1].mins) - Number(slots[0].mins))
    : 30;
  const pressureSlots = slots.filter(
    (slot) => slot.overCapacity || slot.highPressure || slot.overConcurrentLimit
  );

  return groupContiguousSlots(pressureSlots, interval).map((window) => {
    const peak = [...window.slots].sort(
      (a, b) => Number(b.occupancyPct || 0) - Number(a.occupancyPct || 0)
    )[0];
    const critical = window.slots.some((slot) => slot.overCapacity);

    return {
      ...window,
      peak,
      tone: critical ? "critical" : "warning",
      peakCars: Number(peak?.estimatedCars || 0),
      peakPct: Number(peak?.occupancyPct || 0),
      fixtureCount: Math.max(...window.slots.map((slot) => Number(slot.fixtureCount || 0))),
    };
  });
}

export function getParkingOperationalPlan({
  snapshot = null,
  fixtures = [],
  club = {},
  pitchCfg = [],
} = {}) {
  const parkingSnapshot = snapshot || getParkingSnapshot({ fixtures, club, pitchCfg });
  const arrivalForecast = buildParkingArrivalForecast({ fixtures, club, pitchCfg });
  const pressureWindows = buildParkingPressureWindows(parkingSnapshot);
  const primaryPressureWindow = pressureWindows[0] || null;
  const peakSlot = parkingSnapshot.peakSlot || parkingSnapshot.analysis?.peakSlot || null;
  const peakMins = Number(peakSlot?.mins || 0);
  const operationalStart = primaryPressureWindow?.startMins || peakMins;
  const operationalEnd = primaryPressureWindow?.endMins || (peakMins ? peakMins + 30 : 0);
  const peakFixtures = peakSlot?.parkingFixtures || parkingSnapshot.peakFixtures || [];

  const pressureDrivers = [...peakFixtures]
    .map((fixture) => ({
      id: fixture.id || fixture.fixtureId || `${fixture.pitchId}-${fixture.koMins}-${getParkingFixtureName(fixture)}`,
      name: getParkingFixtureName(fixture),
      koTime: fixture.koTime || formatParkingTime(getFixtureWindow(fixture)?.start),
      pitch: fixture.pitchLabel || fixture.pitchName || fixture.pitchId || "Pitch TBC",
      cars: getEstimatedCarsForFixture(fixture, club, pitchCfg),
    }))
    .sort((a, b) => b.cars - a.cars)
    .slice(0, 4);

  const actions = [];

  if (!parkingSnapshot.capacity) {
    actions.push({
      id: "configure-capacity",
      tone: "warning",
      time: "Settings",
      title: "Set the car park capacity",
      detail: "Capacity is required before Ground Control can judge operational pressure accurately.",
    });
  } else if (parkingSnapshot.isOverCapacity) {
    actions.push(
      {
        id: "open-overflow",
        tone: "critical",
        time: formatParkingTime(Math.max(0, operationalStart - 30)),
        title: "Open overflow parking",
        detail: `Have overflow capacity ready before the ${primaryPressureWindow?.label || parkingSnapshot.peakTime} pressure window.`,
      },
      {
        id: "deploy-marshals",
        tone: "warning",
        time: formatParkingTime(Math.max(0, operationalStart - 30)),
        title: "Deploy parking marshals",
        detail: `Cover the entrance and pedestrian routes until ${formatParkingTime(operationalEnd + 15)}.`,
      },
      {
        id: "send-arrival-message",
        tone: "neutral",
        time: formatParkingTime(Math.max(0, operationalStart - 90)),
        title: "Send arrival guidance",
        detail: "Ask teams to arrive within their allocated window and avoid early congregation on site.",
      }
    );
  } else if (parkingSnapshot.isHighPressure || parkingSnapshot.isOverConcurrentLimit) {
    actions.push(
      {
        id: "marshal-window",
        tone: "warning",
        time: formatParkingTime(Math.max(0, operationalStart - 20)),
        title: "Cover the peak arrival window",
        detail: `Use a marshal through ${primaryPressureWindow?.label || parkingSnapshot.peakTime} to keep traffic moving.`,
      },
      {
        id: "protect-access",
        tone: "neutral",
        time: formatParkingTime(Math.max(0, operationalStart - 30)),
        title: "Protect emergency and pedestrian access",
        detail: "Keep turning areas, gates and emergency access clear before the busiest arrivals begin.",
      }
    );
  } else if (parkingSnapshot.peakCars > 0) {
    actions.push({
      id: "standard-cover",
      tone: "positive",
      time: formatParkingTime(Math.max(0, peakMins - 20)),
      title: "Standard parking cover",
      detail: `Parking is controlled. Monitor the entrance around ${parkingSnapshot.peakTime}.`,
    });
  }

  const peakArrival = arrivalForecast.peakArrivalSlot;
  const peakArrivalLabel = peakArrival
    ? `${peakArrival.label}–${formatParkingTime(peakArrival.mins + 15)}`
    : "—";

  return {
    arrivalForecast,
    pressureWindows,
    primaryPressureWindow,
    pressureDrivers,
    actions,
    peakArrivalLabel,
    peakArrivalCars: Number(peakArrival?.arrivalCars || 0),
    turnoverCount: arrivalForecast.turnoverSlots.length,
    headline: parkingSnapshot.isOverCapacity
      ? `Parking exceeds capacity during ${primaryPressureWindow?.label || parkingSnapshot.peakTime}.`
      : parkingSnapshot.isHighPressure || parkingSnapshot.isOverConcurrentLimit
        ? `Parking pressure is highest during ${primaryPressureWindow?.label || parkingSnapshot.peakTime}.`
        : parkingSnapshot.peakCars > 0
          ? `Parking remains controlled; the busiest occupancy is at ${parkingSnapshot.peakTime}.`
          : "Parking is waiting for scheduled fixtures.",
  };
}

export default getParkingSnapshot;
