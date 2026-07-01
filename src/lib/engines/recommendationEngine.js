import {
  getFixtureDuration,
  minutesToTime,
  timeToMinutes,
  validateFixtureUpdate,
} from "./validationEngine.js";
import {
  getPitchSuitabilityScore,
  getSuitablePitchesForFixture,
} from "../intelligence/pitch/pitchService.js";
import { getFixtureParkingImpact, getMatchdayParkingImpact } from "./parkingEngine.js";

function getTimeSortScore(time, currentTime) {
  const timeMins = timeToMinutes(time);
  const currentMins = timeToMinutes(currentTime);

  if (timeMins == null || currentMins == null) return 9999;

  return Math.abs(timeMins - currentMins);
}

function getConflictTitle(type) {
  if (type === "pitch_closed") return "Pitch unavailable";
  if (type === "kickoff_rule") return "Kick-off outside competition rules";
  if (type === "referee_clash") return "Official unavailable";
  if (type === "pitch_clash") return "Move cannot be completed";
  if (type === "pitch_unsuitable") return "Pitch not suitable";
  if (type === "parking_concurrency") return "Parking capacity risk";
  return "Operational conflict";
}

function getConflictAction(type) {
  if (type === "pitch_closed") {
    return "Choose another suitable pitch or reopen the pitch before assigning this fixture.";
  }

  if (type === "kickoff_rule") {
    return "Choose a kick-off inside the timing settings or update the competition timing rules.";
  }

  if (type === "referee_clash") {
    return "Choose a different kick-off time or assign a different official.";
  }

  if (type === "pitch_clash") {
    return "Choose a suitable pitch for this fixture format or choose a different kick-off time.";
  }

  if (type === "pitch_unsuitable") {
    return "Choose a pitch configured for this fixture format.";
  }

  if (type === "parking_concurrency") {
    return "Use a parking-safe kick-off or pitch recommendation. Ground Control will only show fixes that pass all operational checks.";
  }

  return "Review the suggested alternatives before applying this change.";
}

function getClashPitchLabel(clash = {}, pitchCfg = []) {
  const clashPitch = pitchCfg.find((pitch) => pitch.id === clash.pitchId);

  return clashPitch?.label || clash.pitchLabel || clash.pitchId || "TBC";
}

function getTimingWindow({ club = {}, start, end } = {}) {
  const startMins =
    timeToMinutes(start) ??
    (Number.isFinite(Number(club.startHour))
      ? Number(club.startHour) * 60 + Number(club.startMin || 0)
      : null) ??
    8 * 60 + 30;

  const endMins =
    timeToMinutes(end) ??
    (Number.isFinite(Number(club.endHour))
      ? Number(club.endHour) * 60 + Number(club.endMin || 0)
      : null) ??
    11 * 60 + 30;

  return {
    startMins,
    endMins,
  };
}

function buildTimePatch(fixture = {}, koTime) {
  const koMins = timeToMinutes(koTime);
  const duration = getFixtureDuration({
    ...fixture,
    koTime,
    koMins,
    endMins: null,
  });

  return {
    koTime,
    koMins,
    endMins: koMins != null ? koMins + duration : fixture.endMins,
  };
}

function buildCandidatePatch({ fixture = {}, pitch = null, koTime = null, basePatch = {} }) {
  const patch = { ...basePatch };

  if (pitch) {
    patch.pitchId = pitch.id;
    patch.pitchLabel = pitch.label || pitch.id;
  }

  if (koTime) {
    Object.assign(patch, buildTimePatch({ ...fixture, ...patch }, koTime));
  }

  return patch;
}

function getPatchKey(patch = {}) {
  return [patch.pitchId || "", patch.koTime || "", patch.referee || ""].join("|");
}

function describePatch(patch = {}, current = {}) {
  const parts = [];

  if (patch.koTime && patch.koTime !== current.koTime) {
    parts.push(`Move KO to ${patch.koTime}`);
  }

  if (patch.pitchId && patch.pitchId !== current.pitchId) {
    parts.push(`Move to ${patch.pitchLabel || patch.pitchId}`);
  }

  if (patch.referee && patch.referee !== current.referee) {
    parts.push(`Assign ${patch.referee}`);
  }

  return parts.length ? parts.join(" and ") : "Apply validated fix";
}

function getParkingImprovement({ fixtures, fixtureIndex, current, patch, club, pitchCfg }) {
  return getFixtureParkingImpact({
    fixtures,
    fixtureIndex,
    current,
    patch,
    club,
    pitchCfg,
  });
}

function getWholeDayParkingImpact({ fixtures, fixtureIndex, patch, club, pitchCfg }) {
  return getMatchdayParkingImpact({
    fixtures,
    fixtureIndex,
    patch,
    club,
    pitchCfg,
  });
}

function scoreRecommendation({ current = {}, patch = {}, parking = {}, pitchCfg = [] } = {}) {
  let score = 50;

  const percentDelta = Number(parking.percentDelta || 0);
  const gameDelta = Number(parking.gameDelta || 0);
  const carDelta = Number(parking.carDelta || 0);

  if (percentDelta > 0) score += percentDelta;
  if (gameDelta > 0) score += gameDelta * 8;
  if (carDelta > 0) score += Math.round(carDelta / 2);

  if (patch.koTime) score -= Math.round(getTimeSortScore(patch.koTime, current.koTime) / 15);

  const pitch = pitchCfg.find((item) => item.id === patch.pitchId);
  if (pitch?.affectsParking === false) score += 15;
  if (patch.pitchId === current.pitchId) score += 5;

  return Math.max(1, Math.min(100, score));
}

function validateCandidate({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  closedPitches = [],
  club = {},
  patch = {},
  validateParking = true,
} = {}) {
  return validateFixtureUpdate({
    fixtures,
    fixtureIndex,
    pitchCfg,
    closedPitches,
    club,
    patch,
    validateParking,
    changeType: "schedule",
  });
}

export function getFixtureRecommendations(fixture = {}) {
  const recommendations = [];

  if (!fixture.koTime) {
    recommendations.push({
      type: "scheduling",
      severity: "high",
      title: "Set a kick-off time",
      detail: "This fixture cannot be operationally confirmed until a kick-off is set.",
    });
  }

  if (!fixture.pitchId) {
    recommendations.push({
      type: "facilities",
      severity: "high",
      title: "Allocate a pitch",
      detail: "Assign a pitch before publishing the matchday plan.",
    });
  }

  if (fixture.usingFallback) {
    recommendations.push({
      type: "facilities",
      severity: "medium",
      title: "Review emergency pitch allocation",
      detail: "This fixture is using a fallback pitch. Check suitability before matchday.",
    });
  }

  if (fixture.refStatus !== "Confirmed") {
    recommendations.push({
      type: "officials",
      severity: "high",
      title: "Confirm the official",
      detail: "The referee or match official is not confirmed yet.",
    });
  }

  if (!fixture.refPhone && fixture.referee) {
    recommendations.push({
      type: "officials",
      severity: "medium",
      title: "Add official contact number",
      detail: "Adding a contact number reduces matchday communication risk.",
    });
  }

  return recommendations;
}

export function getFixtureClashes({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  patch = {},
  closedPitches = [],
  club = {},
} = {}) {
  const validation = validateFixtureUpdate({
    fixtures,
    fixtureIndex,
    pitchCfg,
    patch,
    closedPitches,
    club,
  });

  if (validation.ok) return [];

  return [
    {
      type: validation.type,
      severity: validation.severity || "blocked",
      title: getConflictTitle(validation.type),
      detail: validation.reason,
      action: getConflictAction(validation.type),
      clash: validation.clash,
    },
  ];
}

export function getAvailablePitchSuggestions({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  next = {},
  koTime,
  limit = 4,
  closedPitches = [],
  club = {},
} = {}) {
  const current = fixtures[fixtureIndex];

  if (!current || !koTime) return [];

  const proposed = {
    ...current,
    ...next,
  };

  return getSuitablePitchesForFixture({
    fixture: proposed,
    pitchCfg,
  })
    .filter((pitch) => !closedPitches.includes(pitch.id))
    .map((pitch) => {
      const patch = buildCandidatePatch({
        fixture: proposed,
        pitch,
        koTime,
        basePatch: next,
      });

      const validation = validateCandidate({
        fixtures,
        fixtureIndex,
        pitchCfg,
        patch,
        closedPitches,
        club,
      });

      return {
        pitchId: pitch.id,
        pitchLabel: pitch.label || pitch.id,
        format: pitch.format || null,
        suitable: true,
        available: validation.ok,
        reason: validation.ok ? "Suitable, available and fully validated" : validation.reason,
        score: getPitchSuitabilityScore(pitch, proposed, current.pitchId),
      };
    })
    .filter((item) => item.pitchId !== current.pitchId)
    .filter((item) => item.available)
    .sort((a, b) => a.score - b.score || a.pitchLabel.localeCompare(b.pitchLabel))
    .slice(0, limit);
}

export function getNextAvailableTimes({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  next = {},
  start,
  end,
  interval = 15,
  limit = 8,
  closedPitches = [],
  club = {},
} = {}) {
  const current = {
    ...(fixtures[fixtureIndex] || {}),
    ...next,
  };

  const { startMins, endMins } = getTimingWindow({ club, start, end });

  if (startMins == null || endMins == null || !current.pitchId) return [];

  const suggestions = [];

  for (let mins = startMins; mins <= endMins; mins += interval) {
    const koTime = minutesToTime(mins);

    if (koTime === current.koTime) continue;

    const patch = buildCandidatePatch({
      fixture: current,
      koTime,
      basePatch: next,
    });

    const validation = validateCandidate({
      fixtures,
      fixtureIndex,
      pitchCfg,
      patch,
      closedPitches,
      club,
    });

    if (validation.ok) {
      suggestions.push({
        koTime,
        score: getTimeSortScore(koTime, current.koTime),
      });
    }
  }

  return suggestions
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((item) => item.koTime);
}

export function getValidatedFixRecommendations({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  closedPitches = [],
  club = {},
  basePatch = {},
  start,
  end,
  interval = 15,
  limit = 5,
  allowParkingImprovement = false,
  minimumCarReduction = 1,
} = {}) {
  const current = fixtures[fixtureIndex];

  if (!current) return [];

  const workingFixture = { ...current, ...basePatch };
  const { startMins, endMins } = getTimingWindow({ club, start, end });

  if (startMins == null || endMins == null) return [];

  const suitablePitches = getSuitablePitchesForFixture({
    fixture: workingFixture,
    pitchCfg,
  }).filter((pitch) => !closedPitches.includes(pitch.id));

  const currentPitch = pitchCfg.find((pitch) => pitch.id === workingFixture.pitchId);
  const candidatePitches = [currentPitch, ...suitablePitches]
    .filter(Boolean)
    .filter(
      (pitch, index, list) => list.findIndex((item) => item.id === pitch.id) === index
    );

  const candidates = new Map();

  for (let mins = startMins; mins <= endMins; mins += interval) {
    const koTime = minutesToTime(mins);

    for (const pitch of candidatePitches) {
      const patch = buildCandidatePatch({
        fixture: workingFixture,
        pitch,
        koTime,
        basePatch,
      });
      const key = getPatchKey(patch);

      if (candidates.has(key)) continue;

      const changedKo = patch.koTime && patch.koTime !== current.koTime;
      const changedPitch = patch.pitchId && patch.pitchId !== current.pitchId;
      if (!changedKo && !changedPitch) continue;

      const validation = validateCandidate({
        fixtures,
        fixtureIndex,
        pitchCfg,
        patch,
        closedPitches,
        club,
        validateParking: !allowParkingImprovement,
      });

      if (!validation.ok) continue;

      const localParking = getParkingImprovement({
        fixtures,
        fixtureIndex,
        current: workingFixture,
        patch,
        club,
        pitchCfg,
      });

      const wholeDayParking = getWholeDayParkingImpact({
        fixtures,
        fixtureIndex,
        patch,
        club,
        pitchCfg,
      });

      const parking = allowParkingImprovement ? wholeDayParking : localParking;
      const carDelta = Number(parking.carDelta || 0);
      const percentDelta = Number(parking.percentDelta || 0);

      if (allowParkingImprovement && carDelta < minimumCarReduction) continue;
      if (allowParkingImprovement && percentDelta <= 0 && carDelta <= 0) continue;

      const score = scoreRecommendation({ current, patch, parking, pitchCfg });
      const fixtureTitle = [current.homeTeam || current.team || current.fixture, current.awayTeam]
        .filter(Boolean)
        .join(" vs ") || "Fixture";
      const recommendedPitch = pitchCfg.find((item) => item.id === patch.pitchId);

      candidates.set(key, {
        id: key,
        fixtureIndex,
        fixtureTitle,
        type: changedKo && changedPitch ? "time_pitch" : changedKo ? "time" : "pitch",
        title: allowParkingImprovement
          ? `${fixtureTitle}`
          : describePatch(patch, current),
        actionTitle: describePatch(patch, current),
        detail: allowParkingImprovement
          ? `Move kick-off ${current.koTime || "TBC"} → ${patch.koTime || current.koTime}. Matchday peak parking ${parking.before.percentage}% → ${parking.after.percentage}%${parking.after.label ? ` at ${parking.after.label}` : ""}. No pitch, official or timing clashes created.`
          : parking.before.percentage > 0
            ? `Parking ${parking.before.percentage}% → ${parking.after.percentage}%. No pitch, official or timing clashes created.`
            : "No pitch, official or timing clashes created.",
        patch,
        score,
        validation,
        pitchScore: recommendedPitch ? getPitchSuitabilityScore(recommendedPitch, workingFixture, current.pitchId) : 999,
        timeDistance: getTimeSortScore(patch.koTime, current.koTime),
        parkingBefore: parking.before,
        parkingAfter: parking.after,
        reduction: Math.max(0, carDelta),
        percentReduction: Math.max(0, percentDelta),
        resolvesParking: parking.after.estimatedCars <= Number(club?.carParkSpaces || 57),
      });
    }
  }

  const sortedCandidates = Array.from(candidates.values()).sort((a, b) =>
    Number(b.reduction || 0) - Number(a.reduction || 0) ||
    Number(b.percentReduction || 0) - Number(a.percentReduction || 0) ||
    Number(b.score || 0) - Number(a.score || 0) ||
    Number(a.timeDistance || 9999) - Number(b.timeDistance || 9999) ||
    Number(a.pitchScore || 999) - Number(b.pitchScore || 999) ||
    String(a.actionTitle || "").localeCompare(String(b.actionTitle || ""))
  );

  if (allowParkingImprovement) {
    return sortedCandidates.slice(0, 1);
  }

  return sortedCandidates.slice(0, limit);
}

export function getOperationsImpact({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  patch = {},
  closedPitches = [],
  club = {},
  start,
  end,
} = {}) {
  const validation = validateFixtureUpdate({
    fixtures,
    fixtureIndex,
    pitchCfg,
    patch,
    closedPitches,
    club,
  });

  if (validation.ok) {
    return {
      ok: true,
      title: "Move available",
      message: "This change does not create any operational conflicts.",
      action: null,
      conflict: null,
      pitchSuggestions: [],
      timeSuggestions: [],
      validatedRecommendations: [],
    };
  }

  const current = fixtures[fixtureIndex] || {};
  const next = {
    ...current,
    ...patch,
  };

  const clash = validation.clash || {};

  const pitchSuggestions = getAvailablePitchSuggestions({
    fixtures,
    fixtureIndex,
    pitchCfg,
    next,
    koTime: next.koTime,
    limit: 4,
    closedPitches,
    club,
  });

  const timeSuggestions = getNextAvailableTimes({
    fixtures,
    fixtureIndex,
    pitchCfg,
    next,
    start,
    end,
    interval: 15,
    limit: 8,
    closedPitches,
    club,
  });

  const validatedRecommendations = getValidatedFixRecommendations({
    fixtures,
    fixtureIndex,
    pitchCfg,
    closedPitches,
    club,
    basePatch: patch,
    start,
    end,
    interval: 15,
    limit: 5,
  });

  return {
    ok: false,
    type: validation.type,
    severity: validation.severity || "blocked",
    title: getConflictTitle(validation.type),
    message: validation.reason,
    action: getConflictAction(validation.type),
    conflict: {
      fixture: clash.homeTeam || "Another fixture",
      opponent: clash.awayTeam || "TBC",
      pitch: getClashPitchLabel(clash, pitchCfg),
      koTime: clash.koTime || "TBC",
      status: clash.status || "active",
      referee: clash.referee || "TBC",
    },
    pendingPatch: patch,
    pitchSuggestions,
    timeSuggestions,
    validatedRecommendations,
  };
}
