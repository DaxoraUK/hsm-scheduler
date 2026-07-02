export const MATCHDAY_SCOPES = Object.freeze({
  MATCHWEEK: "matchweek",
  WEEKEND: "weekend",
  MIDWEEK: "midweek",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
});

export const MATCHDAY_SCOPE_OPTIONS = Object.freeze([
  { key: MATCHDAY_SCOPES.MATCHWEEK, label: "Matchweek", shortLabel: "Week" },
  { key: MATCHDAY_SCOPES.WEEKEND, label: "Weekend", shortLabel: "Weekend" },
  { key: MATCHDAY_SCOPES.MIDWEEK, label: "Midweek", shortLabel: "Mid" },
  { key: MATCHDAY_SCOPES.SATURDAY, label: "Saturday", shortLabel: "Sat" },
  { key: MATCHDAY_SCOPES.SUNDAY, label: "Sunday", shortLabel: "Sun" },
]);

export function normaliseMatchdayScope(scope = MATCHDAY_SCOPES.WEEKEND) {
  const value = String(scope || "").toLowerCase();
  if (["week", "matchweek", "match-week"].includes(value)) return MATCHDAY_SCOPES.MATCHWEEK;
  if (["mid", "midweek", "weekday"].includes(value)) return MATCHDAY_SCOPES.MIDWEEK;
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
  if (normalised === MATCHDAY_SCOPES.MIDWEEK) return MATCHDAY_SCOPES.MIDWEEK;
  if (normalised === MATCHDAY_SCOPES.SUNDAY) return MATCHDAY_SCOPES.SUNDAY;
  if (normalised === MATCHDAY_SCOPES.SATURDAY) return MATCHDAY_SCOPES.SATURDAY;
  if ([MATCHDAY_SCOPES.SUNDAY, MATCHDAY_SCOPES.MIDWEEK].includes(fallback)) return fallback;
  return MATCHDAY_SCOPES.SATURDAY;
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
  midweekFinal = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
} = {}) {
  const normalised = normaliseMatchdayScope(scope);
  const matchweek = normalised === MATCHDAY_SCOPES.MATCHWEEK;
  const weekend = normalised === MATCHDAY_SCOPES.WEEKEND;
  const includeSaturday = matchweek || weekend || normalised === MATCHDAY_SCOPES.SATURDAY;
  const includeSunday = matchweek || weekend || normalised === MATCHDAY_SCOPES.SUNDAY;
  const includeMidweek = matchweek || normalised === MATCHDAY_SCOPES.MIDWEEK;

  const saturday = includeSaturday && satHasRun
    ? decorateFixtureDay(satFinal, MATCHDAY_SCOPES.SATURDAY)
    : [];
  const sunday = includeSunday && sunHasRun
    ? decorateFixtureDay(sunFinal, MATCHDAY_SCOPES.SUNDAY)
    : [];
  const midweek = includeMidweek && midweekHasRun
    ? decorateFixtureDay(midweekFinal, MATCHDAY_SCOPES.MIDWEEK)
    : [];
  const fixtures = [...midweek, ...saturday, ...sunday];
  const activeFixtures = fixtures.filter((fixture) => fixture?.status !== "postponed");

  return {
    scope: normalised,
    label: getMatchdayScopeLabel(normalised),
    includeSaturday,
    includeSunday,
    includeMidweek,
    satHasRun: includeSaturday && satHasRun,
    sunHasRun: includeSunday && sunHasRun,
    midweekHasRun: includeMidweek && midweekHasRun,
    satFinal: saturday,
    sunFinal: sunday,
    midweekFinal: midweek,
    fixtures,
    activeFixtures,
    scheduleBuilt: Boolean(
      (includeSaturday && satHasRun) ||
      (includeSunday && sunHasRun) ||
      (includeMidweek && midweekHasRun)
    ),
  };
}
