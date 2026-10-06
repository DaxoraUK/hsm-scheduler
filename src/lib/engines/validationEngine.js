import {
  buildFixtureRules,
  getFixtureChangeType,
  runRules,
} from "./rulesEngine.js";
import { createPitchRegistry } from "../registry/pitchRegistry.js";
import { isFixtureSchedulingDemand } from "../domain/fixtureLifecycle.js";
import { getFixtureOccupancyMinutes } from "../scheduling/fixtureTiming.js";
import { getFixtureFlowIdentity } from "../domain/fixtureVenueFlow.js";

export function normaliseStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isFixtureActive(fixture = {}) {
  return isFixtureSchedulingDemand(fixture);
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

export function getFixtureDuration(fixture = {}, options = {}) {
  return getFixtureOccupancyMinutes(fixture, options);
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
  fixtureIdentity,
  matchDate,
  resourceContext,
} = {}) {
  if (fixtureIdentity) {
    const matches = fixtures.map((f,i)=>getFixtureFlowIdentity(f)===fixtureIdentity?i:-1).filter(i=>i>=0);
    if(matches.length!==1) return {ok:false,type:"stale_fixture",reason:"This fixture is missing or ambiguous. Refresh the schedule."};
    fixtureIndex=matches[0];
  }
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
    fixtureIdentity: fixtureIdentity || getFixtureFlowIdentity(current),
    matchDate,
    resourceContext,
  });

  return runRules(rules);
}
