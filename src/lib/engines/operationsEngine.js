export {
  normaliseStatus,
  isFixtureActive,
  timeToMinutes,
  getFixtureDuration,
  getLinkedPitchIds,
  validateFixtureUpdate,
} from "./validationEngine.js";

export {
  getFixtureRecommendations,
  getFixtureClashes,
  getAvailablePitchSuggestions,
  getNextAvailableTimes,
  getOperationsImpact,
} from "./recommendationEngine.js";

export function getPitchCapacity({ pitchCfg = [], closedPitches = [] } = {}) {
  const total = Array.isArray(pitchCfg)
    ? pitchCfg.length
    : Object.keys(pitchCfg || {}).length;

  const closed = Array.isArray(closedPitches)
    ? closedPitches.length
    : Object.keys(closedPitches || {}).length;

  const available = Math.max(total - closed, 0);
  const percentage = total > 0 ? Math.round((available / total) * 100) : 0;

  const variant =
    percentage <= 20 ? "danger" : percentage <= 50 ? "warning" : "success";

  return {
    total,
    closed,
    available,
    percentage,
    variant,
  };
}

export function getOfficialStatus(fixture = {}) {
  const status = fixture.refStatus || "TBC";

  if (status === "Confirmed") {
    return {
      label: "Confirmed",
      variant: "success",
      ok: true,
    };
  }

  if (status === "Awaiting") {
    return {
      label: "Awaiting",
      variant: "warning",
      ok: false,
    };
  }

  return {
    label: "TBC",
    variant: "danger",
    ok: false,
  };
}

export function getPitchStatus(fixture = {}) {
  if (fixture.pitchClosed) {
    return {
      label: "Pitch closed",
      variant: "danger",
      ok: false,
    };
  }

  if (fixture.pitchUnsuitable) {
    return {
      label: "Pitch unsuitable",
      variant: "danger",
      ok: false,
    };
  }

  if (fixture.usingFallback) {
    return {
      label: "Emergency pitch",
      variant: "danger",
      ok: false,
    };
  }

  if (fixture.usingAstro) {
    return {
      label: "Artificial surface",
      variant: "info",
      ok: true,
    };
  }

  if (fixture.usingAlt) {
    return {
      label: "Alternative pitch",
      variant: "warning",
      ok: true,
    };
  }

  if (fixture.pitchId) {
    return {
      label: "Preferred pitch",
      variant: "success",
      ok: true,
    };
  }

  return {
    label: "Pitch TBC",
    variant: "danger",
    ok: false,
  };
}

export function getParkingEstimate(fixture = {}) {
  const format =
    fixture.cfg?.format || fixture.manualFormat || fixture.format || "";

  const base = String(format).includes("11")
    ? 34
    : String(format).includes("9")
    ? 26
    : String(format).includes("7")
    ? 20
    : 16;

  const cars = fixture.carEstimate || base;

  return {
    cars,
    label: `${cars} cars estimated`,
    variant: cars >= 30 ? "warning" : "neutral",
  };
}

export function getFixtureHealth(fixture = {}) {
  const officialStatus = getOfficialStatus(fixture);
  const pitchStatus = getPitchStatus(fixture);

  const healthItems = [
    {
      label: "Pitch allocated",
      ok: !!fixture.pitchId,
      weight: 18,
    },
    {
      label: "Pitch open",
      ok: !fixture.pitchClosed,
      weight: 12,
    },
    {
      label: "Pitch format suitable",
      ok: !fixture.pitchUnsuitable,
      weight: 12,
    },
    {
      label: "Kick-off set",
      ok: !!fixture.koTime,
      weight: 18,
    },
    {
      label: "Official confirmed",
      ok: officialStatus.ok,
      weight: 22,
    },
    {
      label: "No emergency pitch",
      ok: !fixture.usingFallback,
      weight: 10,
    },
    {
      label: "Coach message ready",
      ok: !!fixture.homeTeam && !!fixture.koTime && !!fixture.pitchId,
      weight: 8,
    },
  ];

  const score = healthItems.reduce(
    (total, item) => total + (item.ok ? item.weight : 0),
    0
  );

  const label =
    score >= 90
      ? "Excellent"
      : score >= 75
      ? "Good"
      : score >= 50
      ? "Needs review"
      : "High risk";

  const variant = score >= 75 ? "success" : score >= 50 ? "warning" : "danger";

  return {
    score,
    label,
    variant,
    items: healthItems,
    officialStatus,
    pitchStatus,
    parkingEstimate: getParkingEstimate(fixture),
  };
}

export function getMatchdayHealth({
  hasRun = false,
  unresolvedCount = 0,
  refWarnings = 0,
  pitchCfg = [],
  closedPitches = [],
} = {}) {
  const pitchCapacity = getPitchCapacity({ pitchCfg, closedPitches });

  if (!hasRun) {
    return {
      score: 0,
      label: "Not run",
      variant: "neutral",
      pitchCapacity,
    };
  }

  let score = 100;

  score -= unresolvedCount * 15;
  score -= refWarnings * 8;

  if (pitchCapacity.total > 0) {
    score -= Math.round((100 - pitchCapacity.percentage) * 0.25);
  }

  if (pitchCapacity.total > 0 && pitchCapacity.available === 0) {
    score = 0;
  }

  score = Math.max(0, Math.min(100, score));

  const label =
    score >= 90
      ? "Excellent"
      : score >= 75
      ? "Good"
      : score >= 50
      ? "Needs review"
      : "Critical";

  const variant = score >= 85 ? "success" : score >= 60 ? "warning" : "danger";

  return {
    score,
    label,
    variant,
    pitchCapacity,
  };
}
