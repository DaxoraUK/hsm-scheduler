import {
  buildFixtureRules,
  getFixtureChangeType,
  runRules,
} from "./rulesEngine.js";
import { createPitchRegistry } from "../registry/pitchRegistry.js";

export function normaliseStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function isFixtureActive(fixture = {}) {
  const status = normaliseStatus(fixture.status || "active");
  return status !== "postponed" && status !== "cancelled";
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

export function getFixtureDuration(fixture = {}) {
  if (fixture.endMins != null && fixture.koMins != null) {
    return fixture.endMins - fixture.koMins;
  }

  const gameMins = fixture.cfg?.gameMins || fixture.gameMins || 70;
  const format = fixture.cfg?.format || fixture.format || "";
  const bufferMins = String(format).includes("11") ? 30 : 15;

  return gameMins + bufferMins;
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
