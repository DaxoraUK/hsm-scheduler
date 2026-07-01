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

export function getParkingStats({ peakCars = 0, carCap = 57 }) {
  const pct = carCap ? Math.round((peakCars / carCap) * 100) : 0;

  return {
    peakCars,
    carCap,
    pct,
    overCapacity: pct > 100,
  };
}