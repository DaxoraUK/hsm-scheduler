/**
 * Fixture Day Domain
 *
 * Canonical configuration for every schedulable day in Ground Control.
 * Saturday, Sunday and Midweek are now configurations of the same model,
 * rather than separate scheduler implementations.
 */

export const FIXTURE_DAY_KEYS = Object.freeze({
  SATURDAY: "saturday",
  SUNDAY: "sunday",
  MIDWEEK: "midweek",
});

export const FIXTURE_DAY_RULE_PROFILES = Object.freeze({
  WEEKEND: "weekend",
  FLEXIBLE: "flexible",
});

const DEFAULT_DEFINITIONS = Object.freeze({
  [FIXTURE_DAY_KEYS.SATURDAY]: Object.freeze({
    key: FIXTURE_DAY_KEYS.SATURDAY,
    label: "Saturday",
    shortLabel: "Sat",
    ruleProfile: FIXTURE_DAY_RULE_PROFILES.WEEKEND,
    rules: Object.freeze({
      fixedAdultKickOffMins: 14 * 60,
    }),
    defaultWindow: Object.freeze({ startMins: 8 * 60 + 30, endMins: 11 * 60 + 30 }),
    testStorageKey: "testSaturday",
    remoteConfigKey: "testsat",
    fetchStrategy: "saturday",
  }),
  [FIXTURE_DAY_KEYS.SUNDAY]: Object.freeze({
    key: FIXTURE_DAY_KEYS.SUNDAY,
    label: "Sunday",
    shortLabel: "Sun",
    ruleProfile: FIXTURE_DAY_RULE_PROFILES.WEEKEND,
    rules: Object.freeze({
      fixedAdultKickOffMins: 14 * 60,
    }),
    defaultWindow: Object.freeze({ startMins: 8 * 60 + 30, endMins: 11 * 60 + 30 }),
    testStorageKey: "testSunday",
    remoteConfigKey: "testsun",
    fetchStrategy: "sunday",
  }),
  [FIXTURE_DAY_KEYS.MIDWEEK]: Object.freeze({
    key: FIXTURE_DAY_KEYS.MIDWEEK,
    label: "Midweek",
    shortLabel: "Mid",
    ruleProfile: FIXTURE_DAY_RULE_PROFILES.FLEXIBLE,
    rules: Object.freeze({
      fixedAdultKickOffMins: null,
    }),
    defaultWindow: Object.freeze({ startMins: 18 * 60, endMins: 21 * 60 + 30 }),
    testStorageKey: "testMidweek",
    remoteConfigKey: "testmidweek",
    fetchStrategy: "all",
  }),
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validMinutes(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normaliseFixtureDayKey(value = FIXTURE_DAY_KEYS.SATURDAY) {
  const key = String(value || "").trim().toLowerCase();
  if (["sun", "sunday"].includes(key)) return FIXTURE_DAY_KEYS.SUNDAY;
  if (["mid", "midweek", "weekday"].includes(key)) return FIXTURE_DAY_KEYS.MIDWEEK;
  return FIXTURE_DAY_KEYS.SATURDAY;
}

export function getFixtureDayDefinition(value) {
  const key = normaliseFixtureDayKey(value);
  return DEFAULT_DEFINITIONS[key];
}

export function getFixtureDayRules(value, overrides = {}) {
  const definition = getFixtureDayDefinition(value);
  return {
    ...definition.rules,
    ...(overrides || {}),
  };
}

export function createFixtureDayModel({
  key,
  date = "",
  dateLabel,
  startMins,
  endMins,
  operatingWindow: suppliedOperatingWindow = null,
  rules = {},
  testFixtures = [],
  hasRun = false,
  scheduled = [],
  unresolved = [],
  final = [],
  metadata = {},
} = {}) {
  const definition = getFixtureDayDefinition(key);
  const operatingWindow = {
    startMins: validMinutes(
      startMins ?? suppliedOperatingWindow?.startMins,
      definition.defaultWindow.startMins
    ),
    endMins: validMinutes(
      endMins ?? suppliedOperatingWindow?.endMins,
      definition.defaultWindow.endMins
    ),
  };

  return {
    ...definition,
    date,
    dateLabel: dateLabel || definition.label,
    operatingWindow,
    rules: getFixtureDayRules(definition.key, rules),
    testFixtures: asArray(testFixtures).map((fixture) => ({ ...fixture })),
    hasRun: Boolean(hasRun),
    scheduled: asArray(scheduled),
    unresolved: asArray(unresolved),
    final: asArray(final),
    metadata: {
      ...(metadata || {}),
      modelVersion: 1,
    },
  };
}

export function decorateFixturesForDay(fixtures = [], key) {
  const dayKey = normaliseFixtureDayKey(key);
  return asArray(fixtures).map((fixture) => ({
    ...fixture,
    fixtureDayKey: fixture?.fixtureDayKey || dayKey,
    __day: fixture?.__day || dayKey,
  }));
}

export function validateFixtureDayDefinitions() {
  const errors = [];
  const definitions = Object.values(DEFAULT_DEFINITIONS);

  const storageKeys = definitions.map((item) => item.testStorageKey);
  const remoteKeys = definitions.map((item) => item.remoteConfigKey);

  if (new Set(storageKeys).size !== storageKeys.length) {
    errors.push("Fixture-day test storage keys must be unique.");
  }

  if (new Set(remoteKeys).size !== remoteKeys.length) {
    errors.push("Fixture-day remote config keys must be unique.");
  }

  [FIXTURE_DAY_KEYS.SATURDAY, FIXTURE_DAY_KEYS.SUNDAY].forEach((key) => {
    if (DEFAULT_DEFINITIONS[key].rules.fixedAdultKickOffMins !== 14 * 60) {
      errors.push(`${DEFAULT_DEFINITIONS[key].label} must keep the explicit 14:00 adult rule.`);
    }
  });

  if (DEFAULT_DEFINITIONS[FIXTURE_DAY_KEYS.MIDWEEK].rules.fixedAdultKickOffMins !== null) {
    errors.push("Midweek must not inherit the weekend 14:00 adult rule.");
  }

  definitions.forEach((definition) => {
    if (definition.defaultWindow.endMins <= definition.defaultWindow.startMins) {
      errors.push(`${definition.label} operating window is invalid.`);
    }
  });

  return errors;
}

const definitionErrors = validateFixtureDayDefinitions();
if (definitionErrors.length) {
  throw new Error(`Fixture-day configuration invalid: ${definitionErrors.join(" ")}`);
}

export default createFixtureDayModel;
