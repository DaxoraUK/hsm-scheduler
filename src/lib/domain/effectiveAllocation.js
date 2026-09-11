import { getFixtureOccupancy } from "./fixtureOccupancy.js";

const allocationFields = ["pitchId", "pitchLabel", "koTime", "koMins", "endMins"];

function allocationPatch(source = {}) {
  return allocationFields.reduce((patch, field) => {
    if (source[field] != null && source[field] !== "") patch[field] = source[field];
    return patch;
  }, {});
}

function updatesKickOff(patch = {}) {
  return Object.prototype.hasOwnProperty.call(patch, "koMins") ||
    Object.prototype.hasOwnProperty.call(patch, "koTime");
}

export function resolveEffectiveAllocation({
  fixture = {},
  derivedAllocation = {},
  intent = {},
  pendingPatch = {},
  timing = {},
} = {}) {
  const lockedPatch = intent?.allocation?.mode === "locked"
    ? allocationPatch(intent.allocation)
    : {};
  const pendingAllocation = allocationPatch(pendingPatch);
  const patchLayers = [allocationPatch(derivedAllocation), lockedPatch, pendingAllocation];
  const allocation = patchLayers.reduce((current, patch) => ({ ...current, ...patch }), {});
  const lastKickOffPatch = [...patchLayers].reverse().find((patch) => updatesKickOff(patch));
  const lastPatchProvidesEnd = Boolean(lastKickOffPatch && Object.prototype.hasOwnProperty.call(lastKickOffPatch, "endMins"));
  const fixtureWithAllocation = {
    ...fixture,
    // Configuration is derived evidence, not a new provider fixture or intent.
    ...(derivedAllocation.cfg ? { cfg: derivedAllocation.cfg } : {}),
    ...(derivedAllocation.occupancyTiming ? { occupancyTiming: derivedAllocation.occupancyTiming } : {}),
    ...allocation,
    ...(lastKickOffPatch && "koTime" in lastKickOffPatch && !("koMins" in lastKickOffPatch)
      ? { koMins: undefined } : {}),
    ...(lastKickOffPatch && "koMins" in lastKickOffPatch && !("koTime" in lastKickOffPatch)
      ? { koTime: `${String(Math.floor(lastKickOffPatch.koMins / 60)).padStart(2, "0")}:${String(lastKickOffPatch.koMins % 60).padStart(2, "0")}` } : {}),
    ...(lastKickOffPatch && !lastPatchProvidesEnd ? { endMins: undefined } : {}),
  };
  const occupancy = getFixtureOccupancy({ fixture: fixtureWithAllocation, timing });

  return {
    ...fixtureWithAllocation,
    koMins: occupancy.koMins ?? fixtureWithAllocation.koMins ?? null,
    endMins: fixtureWithAllocation.occupancyTiming || (lastKickOffPatch && !lastPatchProvidesEnd)
      ? occupancy.endMins
      : fixtureWithAllocation.endMins ?? occupancy.endMins,
  };
}
