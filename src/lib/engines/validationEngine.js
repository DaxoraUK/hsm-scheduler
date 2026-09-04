import {
  buildFixtureRules,
  getFixtureChangeType,
  runRules,
} from "./rulesEngine.js";
import { createPitchRegistry } from "../registry/pitchRegistry.js";
import { getFixtureOccupancy } from "../domain/fixtureOccupancy.js";

export function normaliseStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isFixtureActive(fixture = {}) {
  const status = normaliseStatus(fixture.status || "active");
  return status !== "postponed"
    && status !== "cancelled"
    && status !== "away"
    && fixture.isAwayFixture !== true
    && fixture.requiresScheduling !== false;
}

export function timeToMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
}

export function minutesToTime(totalMins) {
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getFixtureDuration(fixture = {}, timing = {}) {
  return getFixtureOccupancy({ fixture, timing }).occupancyMins;
}

export function getLinkedPitchIds(pitchId, pitchCfg = []) {
  return createPitchRegistry(pitchCfg).getLinkedPitchIds(pitchId);
}

export { getFixtureChangeType };

export function validateFixtureUpdate({
  fixtures = [],
  fixtureIndex,
  patch = {},
  pitchCfg = [],
  closedPitches = [],
  club = {},
  validateParking = true,
  changeType,
} = {}) {
  const current = fixtures[fixtureIndex];

  if (!current) {
    return { ok: true, type: "valid" };
  }

  const next = {
    ...current,
    ...patch,
  };

  if (!isFixtureActive(next)) {
    return { ok: true, type: "valid" };
  }

  const resolvedChangeType = changeType || getFixtureChangeType(current, patch);
  const rules = buildFixtureRules({
    fixtures,
    fixtureIndex,
    next,
    pitchCfg,
    closedPitches,
    club,
    validateParking,
    changeType: resolvedChangeType,
  });

  return runRules(rules);
}
