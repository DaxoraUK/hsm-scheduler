function normaliseFormat(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function getFixtureFormat(fixture = {}) {
  return normaliseFormat(
    fixture.cfg?.format || fixture.manualFormat || fixture.format || ""
  );
}

export function getPitchFormat(pitch = {}) {
  return normaliseFormat(pitch.format || pitch.desc || "");
}

export function getPreferredPitchIds(fixture = {}) {
  return [
    fixture.cfg?.defaultPitch,
    fixture.cfg?.altPitch,
    fixture.defaultPitch,
    fixture.altPitch,
  ].filter(Boolean);
}

export function getCompatiblePitchFormats(fixture = {}) {
  const format = getFixtureFormat(fixture);

  const compatibility = {
    "3v3": ["3v3"],
    "5v5": ["5v5", "7v7"],
    "7v7": ["7v7"],
    "9v9": ["9v9"],
    "11v11-youth": ["11v11-youth", "11v11-small"],
    "11v11-small": ["11v11-small", "11v11"],
    "11v11": ["11v11", "11v11-small"],
  };

  return compatibility[format] || (format ? [format] : []);
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
  return (
    pitch.displayFormat ||
    pitch.formatLabel ||
    pitch.format ||
    pitch.desc ||
    pitch.type ||
    "Unconfigured"
  );
}


export function getPitchSuitabilityScore(pitch = {}, fixture = {}, currentPitchId) {
  const preferredPitchIds = getPreferredPitchIds(fixture);
  const fixtureFormat = getFixtureFormat(fixture);
  const pitchFormat = getPitchFormat(pitch);

  let score = 0;

  if (pitch.id === fixture.cfg?.defaultPitch || pitch.id === fixture.defaultPitch) {
    score -= 100;
  }

  if (pitch.id === fixture.cfg?.altPitch || pitch.id === fixture.altPitch) {
    score -= 80;
  }

  if (pitchFormat && fixtureFormat && pitchFormat === fixtureFormat) {
    score -= 40;
  }

  if (preferredPitchIds.includes(pitch.id)) {
    score -= 30;
  }

  if (pitch.id === currentPitchId) {
    score += 100;
  }

  if (pitch.innerOf) {
    score += 10;
  }

  if (pitch.astroOnly) {
    score += 15;
  }

  return score;
}

export function getSuitablePitchesForFixture({
  fixture = {},
  pitchCfg = [],
} = {}) {
  return pitchCfg.filter((pitch) => isPitchSuitableForFixture(pitch, fixture));
}


export function getPitchSuitabilityReason(pitch = {}, fixture = {}) {
  const fixtureFormat = getFixtureFormat(fixture) || "this fixture";
  const pitchLabel = pitch.label || pitch.id || "this pitch";

  return `${pitchLabel} is not suitable for ${fixtureFormat}. Choose a pitch configured for this format.`;
}
