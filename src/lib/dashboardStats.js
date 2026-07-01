import { getParkingSummary } from "./engines/parkingEngine.js";

export function getActiveFixtures({ satFinal = [], sunFinal = [], satHasRun, sunHasRun }) {
  return [
    ...(satHasRun ? satFinal : []),
    ...(sunHasRun ? sunFinal : []),
  ].filter((fixture) => fixture.status !== "postponed");
}

export function isRefConfirmed(fixture) {
  return String(fixture.refStatus || "").toLowerCase() === "confirmed";
}

export function getRefereeStats({ satFinal = [], sunFinal = [], satHasRun, sunHasRun }) {
  const fixtures = getActiveFixtures({ satFinal, sunFinal, satHasRun, sunHasRun });

  const confirmed = fixtures.filter(isRefConfirmed).length;
  const outstanding = fixtures.length - confirmed;

  return {
    total: fixtures.length,
    confirmed,
    outstanding,
    pct: fixtures.length ? Math.round((confirmed / fixtures.length) * 100) : 0,
  };
}

export function getParkingStats({
  fixtures = [],
  satFixtures,
  sunFixtures,
  fixturesByDay,
  club = {},
  pitchCfg = [],
  startMins,
  slotMins,
  peakCars = 0,
  carCap = 57,
} = {}) {
  const hasDayFixtures =
    Boolean(fixturesByDay) ||
    Array.isArray(satFixtures) ||
    Array.isArray(sunFixtures);
  const hasFixtures = Array.isArray(fixtures) && fixtures.length > 0;

  if (hasDayFixtures || hasFixtures) {
    const parking = getParkingSummary({
      fixtures: hasDayFixtures ? [] : fixtures,
      satFixtures,
      sunFixtures,
      fixturesByDay,
      club,
      pitchCfg,
      startMins,
      slotMins,
    });

    return {
      peakCars: parking.peakCars,
      carCap: parking.capacity,
      capacity: parking.capacity,
      pct: parking.utilisation,
      utilisation: parking.utilisation,
      peakTime: parking.peakTime,
      status: parking.statusKey,
      statusLabel: parking.statusLabel,
      healthScore: parking.healthScore,
      overCapacity: parking.isOverCapacity,
      isHighPressure: parking.isHighPressure,
      summary: parking.headline,
      detail: parking.detail,
      scope: parking.scope,
      peakDayLabel: parking.peakDayLabel || parking.dayLabel,
      dayBreakdown: parking.detailByDay || parking.dayBreakdown || [],
    };
  }

  const pct = carCap ? Math.round((peakCars / carCap) * 100) : 0;

  return {
    peakCars,
    carCap,
    capacity: carCap,
    pct,
    utilisation: pct,
    peakTime: "Pending",
    status: pct > 100 ? "critical" : pct >= 85 ? "watch" : "healthy",
    statusLabel: pct > 100 ? "Over capacity" : pct >= 85 ? "Watch" : "Healthy",
    healthScore: pct > 100 ? 35 : pct >= 85 ? 70 : 100,
    overCapacity: pct > 100,
    isHighPressure: pct >= 85,
    summary: peakCars ? `${peakCars}/${carCap} spaces` : "Parking pending",
    detail: peakCars ? `${pct}% peak use.` : "Parking forecast will update after schedule build.",
  };
}
