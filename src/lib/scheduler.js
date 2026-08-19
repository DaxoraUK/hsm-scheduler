// scheduler.js
// Pure scheduling logic - no React, no DOM, no network.

import {
  PITCHES,
  INDEPENDENT_PITCHES,
  MINI_FORMATS,
  MINI_KW,
} from "./constants.js";
import { isPitchSuitableForFixture } from "./intelligence/pitch/pitchService.js";
import { createPitchRegistry, normalisePitchRegistry } from "./registry/pitchRegistry.js";

export const t2s = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
    2,
    "0"
  )}`;

export const cleanName = (n, clubName = "HSM") => {
  const escaped = clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (n || "")
    .replace(new RegExp(escaped + "\\s*", "i"), "")
    .replace(/horwich st\.? ?marys?'?s?\s*/i, "")
    .trim();
};

export const isMini = (n) =>
  MINI_KW.some((k) => (n || "").toLowerCase().includes(k));

export const isAdult = (n) =>
  ["hsm 1st team", "hsm reserves", "hsm sunday 1sts", "sunday 1sts"].some(
    (a) => (n || "").toLowerCase().includes(a)
  );

export function findCfg(name, cfgList) {
  const normalise = (value) => String(value || "").toLowerCase().replace(/[.'â€™]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const n = normalise(name);
  return cfgList.find((team) => {
    const configuredNames = [team.name, ...(Array.isArray(team.externalAliases)
      ? team.externalAliases
      : String(team.externalAliases || "").split(","))]
      .map(normalise)
      .filter(Boolean);
    return configuredNames.some((candidate) => n === candidate || n.includes(candidate) || candidate.includes(n));
  });
}

function getPitch(pitchCfg, pitchId) {
  return pitchCfg.find((pitch) => pitch.id === pitchId);
}

function getPitchSurface(pitch) {
  return pitch?.surface || "grass";
}

function isArtificialPitch(pitchCfg, pitchId) {
  const pitch = getPitch(pitchCfg, pitchId);
  const surface = getPitchSurface(pitch);

  return ["astro", "3g", "4g", "artificial"].includes(surface);
}

function isIndependentPitch(pitchCfg, pitchId) {
  const pitch = getPitch(pitchCfg, pitchId);
  return Boolean(pitch?.independent || INDEPENDENT_PITCHES.includes(pitchId));
}

function resolveTeamConfig(fixture, cfgList) {
  const cfg = findCfg(fixture.homeTeam, cfgList);
  if (cfg) return cfg;

  if (fixture.manualFormat) {
    return {
      name: fixture.homeTeam,
      format: fixture.manualFormat,
      defaultPitch: fixture.manualPitch,
      altPitch: null,
      ageOrder: 50,
      gameMins: fixture.manualMins || 60,
    };
  }

  return null;
}

function formatCanUsePitch(teamFormat, pitch, fixture = {}) {
  if (!pitch) return false;

  return isPitchSuitableForFixture(pitch, {
    ...fixture,
    cfg: {
      ...(fixture.cfg || {}),
      format: teamFormat,
    },
    manualFormat: fixture.manualFormat || teamFormat,
    format: fixture.format || teamFormat,
  });
}


function pitchAvailableBySurface(pitchCfg, pitchId, useAstro) {
  const artificial = isArtificialPitch(pitchCfg, pitchId);

  if (artificial && !useAstro) return false;

  return true;
}

function getLinkedPitchIds(pitchCfg, pitchId) {
  return createPitchRegistry(pitchCfg).getLinkedPitchIds(pitchId);
}

function buildClosedPitchSet(pitchCfg, closedPitches = []) {
  const closed = new Set();

  const explicitClosures = Array.isArray(closedPitches)
    ? closedPitches
    : Object.entries(closedPitches || {})
        .filter(([, isClosed]) => Boolean(isClosed))
        .map(([pitchId]) => pitchId);

  explicitClosures
    .map((pitchId) => String(pitchId || "").trim())
    .filter(Boolean)
    .forEach((pitchId) => {
      getLinkedPitchIds(pitchCfg, pitchId).forEach((linkedId) => closed.add(linkedId));
    });

  return closed;
}

function scheduleFixtureDayCore(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3,
  options = {}
) {
  const pitchCfg = normalisePitchRegistry(pitchCfgArg && pitchCfgArg.length ? pitchCfgArg : PITCHES);
  const closedPitchSet = buildClosedPitchSet(pitchCfg, closedPitches);

  const active = fixtures.filter((fixture) => fixture.status === "active").map((fixture) => {
    const mappedTeam = findCfg(fixture.homeTeam, cfgList);
    if (!mappedTeam || mappedTeam.name === fixture.homeTeam) return fixture;
    return {
      ...fixture,
      sourceHomeTeam: fixture.sourceHomeTeam || fixture.homeTeam,
      homeTeam: mappedTeam.name,
      teamId: mappedTeam.id || mappedTeam.teamId || mappedTeam.name,
    };
  });

  const sorted = [...active].sort(
    (a, b) =>
      (resolveTeamConfig(a, cfgList)?.ageOrder || 99) -
      (resolveTeamConfig(b, cfgList)?.ageOrder || 99)
  );

  const slots = {};
  const innerPitchMap = {};
  const innerPitches = [];
  const independentPitches = [];

  pitchCfg.forEach((pitch) => {
    if (pitch.innerOf) {
      innerPitchMap[pitch.id] = pitch.innerOf;
      innerPitches.push(pitch.id);
    }

    if (pitch.independent) {
      independentPitches.push(pitch.id);
    }
  });

  pitchCfg.forEach((pitch) => {
    const closed = closedPitchSet.has(pitch.id);
    const surfaceUnavailable = !pitchAvailableBySurface(
      pitchCfg,
      pitch.id,
      useAstro
    );

    if (!closed && !surfaceUnavailable) {
      slots[pitch.id] = [];
    }
  });

  const maxConcurrentAllowed = maxConcurrent || 3;
  const fixedAdultKickOffMins = Object.prototype.hasOwnProperty.call(
    options,
    "fixedAdultKickOffMins"
  )
    ? options.fixedAdultKickOffMins
    : 14 * 60;

  const free = (pitchId, start, end) => {
    if (!(pitchId in slots)) return false;

    if (slots[pitchId].some((slot) => start < slot.e && end > slot.s)) {
      return false;
    }

    const parentPitch = innerPitchMap[pitchId];

    if (
      parentPitch &&
      (slots[parentPitch] || []).some((slot) => start < slot.e && end > slot.s)
    ) {
      return false;
    }

    const innerPitch = Object.keys(innerPitchMap).find(
      (key) => innerPitchMap[key] === pitchId
    );

    if (
      innerPitch &&
      (slots[innerPitch] || []).some((slot) => start < slot.e && end > slot.s)
    ) {
      return false;
    }

    return true;
  };

  const concurrentCount = (start, end) =>
    Object.entries(slots).filter(
      ([pitchId, pitchSlots]) =>
        !independentPitches.includes(pitchId) &&
        pitchSlots.some((slot) => start < slot.e && end > slot.s)
    ).length;

  const book = (pitchId, start, end) => {
    slots[pitchId].push({ s: start, e: end });
  };

  const sortOptions = (pitchIds) => [
    ...pitchIds.filter((pitchId) => !innerPitches.includes(pitchId)),
    ...pitchIds.filter((pitchId) => innerPitches.includes(pitchId)),
  ];

  const findBest = (pitchIds, duration, earlyFirst) => {
    let best = null;

    const onlyIndependent = pitchIds.every((pitchId) =>
      isIndependentPitch(pitchCfg, pitchId)
    );

    const ordered = sortOptions(pitchIds);

    for (let time = startMins; time <= endMins; time += 15) {
      if (
        !onlyIndependent &&
        concurrentCount(time, time + 1) >= maxConcurrentAllowed
      ) {
        continue;
      }

      for (const pitchId of ordered) {
        if (!pitchId || !(pitchId in slots)) continue;

        if (free(pitchId, time, time + duration)) {
          const innerPitchPenalty = innerPitches.includes(pitchId) ? -500 : 0;

          const score = earlyFirst
            ? -time
            : concurrentCount(time, time + 1) * 1000 +
              (endMins - time) +
              innerPitchPenalty;

          if (!best || score > best.score) {
            best = { time, pitchId, score };
          }
        }
      }
    }

    return best;
  };

  const scheduled = [];
  const unresolved = [];

  const youth = sorted.filter((fixture) => !isAdult(fixture.homeTeam));
  const adults = sorted.filter((fixture) => isAdult(fixture.homeTeam));

  for (const fixture of [...youth, ...adults]) {
    const cfg = resolveTeamConfig(fixture, cfgList);

    if (!cfg) {
      unresolved.push({ ...fixture, reason: "Team not in config" });
      continue;
    }

    const buffer = bufMap[cfg.format] || 15;
    const duration = cfg.gameMins + buffer;
    const fixtureWithCfg = { ...fixture, cfg };
    const configuredSuitablePitches = pitchCfg.filter((pitch) =>
      isPitchSuitableForFixture(pitch, fixtureWithCfg)
    );

    if (configuredSuitablePitches.length === 0) {
      unresolved.push({
        ...fixture,
        reason: `No compatible pitch is configured for ${cfg.format}. Add a suitable pitch in Settings or update the team's playing format.`,
      });
      continue;
    }

    if (isAdult(fixture.homeTeam) && Number.isFinite(fixedAdultKickOffMins)) {
      let placed = false;

      for (const pitchId of [cfg.defaultPitch, cfg.altPitch].filter(Boolean)) {
        if (!(pitchId in slots)) continue;

        const pitch = getPitch(pitchCfg, pitchId);
        if (!isPitchSuitableForFixture(pitch, fixtureWithCfg)) continue;

        if (free(pitchId, fixedAdultKickOffMins, fixedAdultKickOffMins + duration)) {
          book(pitchId, fixedAdultKickOffMins, fixedAdultKickOffMins + duration);

          scheduled.push({
            ...fixture,
            pitchId,
            koTime: t2s(fixedAdultKickOffMins),
            koMins: fixedAdultKickOffMins,
            endMins: fixedAdultKickOffMins + duration,
            cfg,
            usingAlt: pitchId !== cfg.defaultPitch,
            usingAstro: isArtificialPitch(pitchCfg, pitchId),
            usingFallback: false,
            fixedKO: true,
          });

          placed = true;
          break;
        }
      }

      if (!placed) {
        unresolved.push({
          ...fixture,
          reason: `No valid adult ${t2s(fixedAdultKickOffMins)} slot. Preferred pitches may be closed, wrong surface, or already occupied.`,
        });
      }

      continue;
    }

    const preferredOptions = [cfg.defaultPitch, cfg.altPitch]
      .filter(Boolean)
      .filter((pitchId) => {
        if (!(pitchId in slots)) return false;
        const pitch = getPitch(pitchCfg, pitchId);
        return isPitchSuitableForFixture(pitch, fixtureWithCfg);
      });

    let options = [...preferredOptions];

    if (MINI_FORMATS.includes(cfg.format)) {
      pitchCfg.forEach((pitch) => {
        const canUse =
          pitch.independent &&
          pitch.id in slots &&
          !options.includes(pitch.id) &&
          isPitchSuitableForFixture(pitch, fixtureWithCfg);

        if (canUse) options.push(pitch.id);
      });
    }

    const exactFormatOptions = pitchCfg
      .filter(
        (pitch) =>
          pitch.format &&
          pitch.format === cfg.format &&
          pitch.id in slots &&
          !options.includes(pitch.id)
      )
      .map((pitch) => pitch.id);

    let candidatePitches = [...options, ...exactFormatOptions].filter(
      (pitchId) => pitchId in slots
    );

    if (candidatePitches.length === 0) {
      candidatePitches = pitchCfg
        .filter((pitch) => {
          if (!(pitch.id in slots)) return false;

          if (isIndependentPitch(pitchCfg, pitch.id)) {
            return MINI_FORMATS.includes(cfg.format) && isPitchSuitableForFixture(pitch, fixtureWithCfg);
          }

          return formatCanUsePitch(cfg.format, pitch, fixture);
        })
        .map((pitch) => pitch.id);
    }

    if (candidatePitches.length === 0) {
      unresolved.push({
        ...fixture,
        reason: `Compatible ${cfg.format} pitches are closed or unavailable for this matchday.`,
      });
      continue;
    }

    const best = findBest(candidatePitches, duration, cfg.format === "3v3");

    if (best) {
      book(best.pitchId, best.time, best.time + duration);

      scheduled.push({
        ...fixture,
        pitchId: best.pitchId,
        koTime: t2s(best.time),
        koMins: best.time,
        endMins: best.time + duration,
        cfg,
        usingAlt:
          best.pitchId !== cfg.defaultPitch &&
          preferredOptions.includes(best.pitchId),
        usingAstro: isArtificialPitch(pitchCfg, best.pitchId),
        usingFallback: !options.includes(best.pitchId),
      });
    } else {
      const diagnostics = [];

      candidatePitches.forEach((pitchId) => {
        if (!(pitchId in slots)) {
          diagnostics.push(`${pitchId}: inactive`);
          return;
        }

        const pitch = getPitch(pitchCfg, pitchId);
        if (!isPitchSuitableForFixture(pitch, fixtureWithCfg)) {
          diagnostics.push(`${pitchId}: unsuitable format`);
          return;
        }

        let concurrentBlocked = 0;
        let slotBlocked = 0;

        for (let time = startMins; time <= endMins; time += 15) {
          if (
            !isIndependentPitch(pitchCfg, pitchId) &&
            concurrentCount(time, time + 1) >= maxConcurrentAllowed
          ) {
            concurrentBlocked++;
            continue;
          }

          if (!free(pitchId, time, time + duration)) {
            slotBlocked++;
          }
        }

        if (concurrentBlocked > 0 && slotBlocked === 0) {
          diagnostics.push(`${pitchId}: concurrent cap`);
        } else if (slotBlocked > 0) {
          diagnostics.push(`${pitchId}: occupied/locked`);
        } else {
          diagnostics.push(`${pitchId}: unknown`);
        }
      });

      unresolved.push({
        ...fixture,
        reason: `No slot before ${t2s(endMins)}. ${diagnostics.join(" | ")}`,
      });
    }
  }

  return {
    scheduled: scheduled.sort((a, b) => a.koMins - b.koMins),
    unresolved,
  };
}


export function scheduleFixtureDay({
  fixtureDay = {},
  dayKey = fixtureDay.key || "saturday",
  fixtures = [],
  useAstro = false,
  closedPitches = [],
  teamConfig = [],
  cfgList = teamConfig,
  bufferMap = {},
  bufMap = bufferMap,
  operatingWindow = fixtureDay.operatingWindow || {},
  startMins = operatingWindow.startMins,
  endMins = operatingWindow.endMins,
  pitchCfg = PITCHES,
  maxConcurrent = 3,
  rules = fixtureDay.rules || {},
} = {}) {
  const result = scheduleFixtureDayCore(
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg,
    maxConcurrent,
    rules
  );

  const normalisedDayKey = String(dayKey || fixtureDay.key || "saturday").toLowerCase();
  const decorate = (fixture) => ({
    ...fixture,
    fixtureDayKey: fixture.fixtureDayKey || normalisedDayKey,
    __day: fixture.__day || normalisedDayKey,
  });

  return {
    scheduled: result.scheduled.map(decorate),
    unresolved: result.unresolved.map(decorate),
    metadata: {
      dayKey: normalisedDayKey,
      operatingWindow: { startMins, endMins },
      rules: { ...rules },
    },
  };
}

// Compatibility positional API retained while callers migrate to scheduleFixtureDay.
export function scheduleSat(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3,
  options = {}
) {
  return scheduleFixtureDay({
    dayKey: "saturday",
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg: pitchCfgArg,
    maxConcurrent,
    rules: { fixedAdultKickOffMins: 14 * 60, ...options },
  });
}

export function scheduleSun(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3,
  options = {}
) {
  return scheduleFixtureDay({
    dayKey: "sunday",
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfg: pitchCfgArg,
    maxConcurrent,
    rules: { fixedAdultKickOffMins: 14 * 60, ...options },
  });
}
