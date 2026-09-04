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
    ...allocation,
    ...(lastKickOffPatch && !lastPatchProvidesEnd ? { endMins: undefined } : {}),
  };
  const occupancy = getFixtureOccupancy({ fixture: fixtureWithAllocation, timing });

  return {
    ...fixtureWithAllocation,
    koMins: occupancy.koMins ?? fixtureWithAllocation.koMins ?? null,
    endMins: lastKickOffPatch && !lastPatchProvidesEnd
      ? occupancy.endMins
      : fixtureWithAllocation.endMins ?? occupancy.endMins,
  };
}
