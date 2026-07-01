import {
  pitchClashRule,
  pitchClosedRule,
  pitchSuitabilityRule,
} from "../intelligence/pitch/pitchRules.js";
import { refereeClashRule } from "../intelligence/officials/officialRules.js";
import { parkingConcurrencyRule } from "../intelligence/parking/parkingRules.js";
import { getKickOffRuleFailure } from "../intelligence/scheduling/kickOffRules.js";

const SCHEDULE_FIELDS = ["pitchId", "pitchLabel", "koTime", "koMins", "endMins"];
const OFFICIAL_FIELDS = ["referee", "refPhone", "refStatus"];

function getChangedFields(current = {}, patch = {}) {
  return Object.keys(patch).filter((field) => patch[field] !== current[field]);
}

export function getFixtureChangeType(current = {}, patch = {}) {
  const changedFields = getChangedFields(current, patch);
  const hasScheduleChange = changedFields.some((field) => SCHEDULE_FIELDS.includes(field));
  const hasOfficialChange = changedFields.some((field) => OFFICIAL_FIELDS.includes(field));

  if (hasScheduleChange) return "schedule";
  if (hasOfficialChange) return "official";

  return "metadata";
}

export function normaliseRuleFailure(failure = null) {
  if (!failure) return null;

  return {
    ok: false,
    severity: failure.severity || "blocked",
    type: failure.type || failure.rule || "rule_failure",
    rule: failure.rule || failure.type || "ruleFailure",
    reason: failure.reason || failure.detail || "This change failed an operational rule.",
    title: failure.title || "Operational rule failed",
    detail: failure.detail || failure.reason || "This change failed an operational rule.",
    action: failure.action || "Review the change and choose a validated alternative.",
    clash: failure.clash || null,
    meta: failure.meta || null,
  };
}

export function getCompetitionRules({ current = {}, next = {}, club = {} } = {}) {
  return [
    {
      id: "competition.kickoffWindow",
      stage: "schedule",
      source: "timingSettings",
      run: () =>
        getKickOffRuleFailure({
          fixture: next,
          koTime: next.koTime,
          club,
        }),
    },
  ];
}

export function getScheduleRules({ fixtures = [], fixtureIndex, next = {}, pitchCfg = [], closedPitches = [], club = {} } = {}) {
  return [
    ...getCompetitionRules({ current: fixtures[fixtureIndex], next, club }),
    {
      id: "pitch.closed",
      stage: "schedule",
      source: "pitchAvailability",
      run: () => pitchClosedRule({ next, pitchCfg, closedPitches }),
    },
    {
      id: "pitch.suitability",
      stage: "schedule",
      source: "pitchConfiguration",
      run: () => pitchSuitabilityRule({ next, pitchCfg }),
    },
    {
      id: "pitch.clash",
      stage: "schedule",
      source: "fixturePlan",
      run: () => pitchClashRule({ fixtures, fixtureIndex, next, pitchCfg }),
    },
  ];
}

export function getOfficialRules({ fixtures = [], fixtureIndex, next = {}, refs = [] } = {}) {
  return [
    {
      id: "official.clash",
      stage: "official",
      source: "fixturePlan",
      run: () => refereeClashRule({ fixtures, fixtureIndex, next, refs }),
    },
  ];
}

export function getParkingRules({ fixtures = [], fixtureIndex, next = {}, club = {}, pitchCfg = [] } = {}) {
  return [
    {
      id: "parking.concurrency",
      stage: "parking",
      source: "parkingSettings",
      run: () => parkingConcurrencyRule({ fixtures, fixtureIndex, next, club, pitchCfg }),
    },
  ];
}

export function buildFixtureRules({
  fixtures = [],
  fixtureIndex,
  next = {},
  pitchCfg = [],
  closedPitches = [],
  club = {},
  validateParking = true,
  changeType = "metadata",
  refs = [],
} = {}) {
  const rules = [];

  if (changeType === "schedule") {
    rules.push(
      ...getScheduleRules({ fixtures, fixtureIndex, next, pitchCfg, closedPitches, club })
    );
  }

  if (changeType === "schedule" || changeType === "official") {
    rules.push(...getOfficialRules({ fixtures, fixtureIndex, next, refs }));
  }

  if (changeType === "schedule" && validateParking) {
    rules.push(...getParkingRules({ fixtures, fixtureIndex, next, club, pitchCfg }));
  }

  return rules;
}

export function runRules(rules = []) {
  for (const rule of rules) {
    const failure = normaliseRuleFailure(rule.run?.());

    if (failure) {
      return {
        ...failure,
        ruleId: rule.id,
        stage: rule.stage,
        source: rule.source,
      };
    }
  }

  return { ok: true, type: "valid" };
}
