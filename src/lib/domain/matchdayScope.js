export const MATCHDAY_SCOPES = Object.freeze({
  WEEKEND: "weekend",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
});

export const MATCHDAY_SCOPE_OPTIONS = Object.freeze([
  { key: MATCHDAY_SCOPES.WEEKEND, label: "Weekend", shortLabel: "Weekend" },
  { key: MATCHDAY_SCOPES.SATURDAY, label: "Saturday", shortLabel: "Sat" },
  { key: MATCHDAY_SCOPES.SUNDAY, label: "Sunday", shortLabel: "Sun" },
]);

export function normaliseMatchdayScope(scope = MATCHDAY_SCOPES.WEEKEND) {
  const value = String(scope || "").toLowerCase();
  if (["sat", "saturday"].includes(value)) return MATCHDAY_SCOPES.SATURDAY;
  if (["sun", "sunday"].includes(value)) return MATCHDAY_SCOPES.SUNDAY;
  return MATCHDAY_SCOPES.WEEKEND;
}

export function getMatchdayScopeLabel(scope = MATCHDAY_SCOPES.WEEKEND) {
  const normalised = normaliseMatchdayScope(scope);
  return MATCHDAY_SCOPE_OPTIONS.find((option) => option.key === normalised)?.label || "Weekend";
}

export function getMatchdayScopeShortLabel(scope = MATCHDAY_SCOPES.WEEKEND) {
  const normalised = normaliseMatchdayScope(scope);
  return MATCHDAY_SCOPE_OPTIONS.find((option) => option.key === normalised)?.shortLabel || "Weekend";
}

export function getDayTabFromScope(scope = MATCHDAY_SCOPES.WEEKEND, fallback = MATCHDAY_SCOPES.SATURDAY) {
  const normalised = normaliseMatchdayScope(scope);
  if (normalised === MATCHDAY_SCOPES.SUNDAY) return MATCHDAY_SCOPES.SUNDAY;
  if (normalised === MATCHDAY_SCOPES.SATURDAY) return MATCHDAY_SCOPES.SATURDAY;
  return fallback === MATCHDAY_SCOPES.SUNDAY ? MATCHDAY_SCOPES.SUNDAY : MATCHDAY_SCOPES.SATURDAY;
}

export function decorateFixtureDay(fixtures = [], day) {
  return (Array.isArray(fixtures) ? fixtures : []).map((fixture) => ({
    ...fixture,
    __day: fixture?.__day || day,
  }));
}

export function getScopedMatchdayData({
  scope = MATCHDAY_SCOPES.WEEKEND,
  satFinal = [],
  sunFinal = [],
  satHasRun = false,
  sunHasRun = false,
} = {}) {
  const normalised = normaliseMatchdayScope(scope);
  const includeSaturday = normalised !== MATCHDAY_SCOPES.SUNDAY;
  const includeSunday = normalised !== MATCHDAY_SCOPES.SATURDAY;

  const saturday = includeSaturday && satHasRun ? decorateFixtureDay(satFinal, MATCHDAY_SCOPES.SATURDAY) : [];
  const sunday = includeSunday && sunHasRun ? decorateFixtureDay(sunFinal, MATCHDAY_SCOPES.SUNDAY) : [];
  const fixtures = [...saturday, ...sunday];
  const activeFixtures = fixtures.filter((fixture) => fixture?.status !== "postponed");

  return {
    scope: normalised,
    label: getMatchdayScopeLabel(normalised),
    includeSaturday,
    includeSunday,
    satHasRun: includeSaturday && satHasRun,
    sunHasRun: includeSunday && sunHasRun,
    satFinal: saturday,
    sunFinal: sunday,
    fixtures,
    activeFixtures,
    scheduleBuilt: Boolean((includeSaturday && satHasRun) || (includeSunday && sunHasRun)),
  };
}
