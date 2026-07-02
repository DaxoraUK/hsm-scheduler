import {
  getCompatiblePitchFormats as getRegistryCompatiblePitchFormats,
  getPitchDisplayFormat as getRegistryPitchDisplayFormat,
  normalisePitch,
} from "../../registry/pitchRegistry.js";

function normaliseFormat(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function getFixtureFormat(fixture = {}) {
  return normaliseFormat(
    fixture.cfg?.format || fixture.manualFormat || fixture.format || fixture.gameFormat || ""
  );
}

export function getPitchFormat(pitch = {}) {
  return normaliseFormat(normalisePitch(pitch).format || "");
}

export function getPreferredPitchIds(fixture = {}) {
  return [
    fixture.cfg?.defaultPitch,
    fixture.cfg?.altPitch,
    fixture.defaultPitch,
    fixture.altPitch,
    fixture.manualPitch,
  ].filter(Boolean);
}

export function getCompatiblePitchFormats(fixture = {}) {
  return getRegistryCompatiblePitchFormats(getFixtureFormat(fixture));
}

export function isPitchSuitableForFixture(pitch = {}, fixture = {}) {
  if (!pitch?.id) return false;

  const pitchFormat = getPitchFormat(pitch);
  const compatibleFormats = getCompatiblePitchFormats(fixture);

  if (!pitchFormat || compatibleFormats.length === 0) {
    return false;
  }

  return compatibleFormats.includes(pitchFormat);
}

export function getPitchDisplayFormat(pitch = {}) {
  return getRegistryPitchDisplayFormat(normalisePitch(pitch));
}

export function getPitchSuitabilityScore(pitch = {}, fixture = {}, currentPitchId) {
  const normalisedPitch = normalisePitch(pitch);
  const preferredPitchIds = getPreferredPitchIds(fixture);
  const fixtureFormat = getFixtureFormat(fixture);
  const pitchFormat = getPitchFormat(normalisedPitch);

  let score = 0;

  if (normalisedPitch.id === fixture.cfg?.defaultPitch || normalisedPitch.id === fixture.defaultPitch) {
    score -= 100;
  }

  if (normalisedPitch.id === fixture.cfg?.altPitch || normalisedPitch.id === fixture.altPitch) {
    score -= 80;
  }

  if (pitchFormat && fixtureFormat && pitchFormat === fixtureFormat) {
    score -= 40;
  }

  if (preferredPitchIds.includes(normalisedPitch.id)) {
    score -= 30;
  }

  if (normalisedPitch.id === currentPitchId) {
    score += 100;
  }

  if (normalisedPitch.innerOf) {
    score += 10;
  }

  if (normalisedPitch.astroOnly) {
    score += 15;
  }

  return score;
}

export function getSuitablePitchesForFixture({ fixture = {}, pitchCfg = [] } = {}) {
  return pitchCfg.filter((pitch) => isPitchSuitableForFixture(pitch, fixture));
}

export function getPitchSuitabilityReason(pitch = {}, fixture = {}) {
  const fixtureFormat = getFixtureFormat(fixture) || "this fixture";
  const pitchLabel = pitch.label || pitch.id || "this pitch";

  return `${pitchLabel} is not suitable for ${fixtureFormat}. Choose a pitch configured for this format.`;
}
