// scheduler.js
// Pure scheduling logic - no React, no DOM, no network.

import {
  PITCHES,
  INDEPENDENT_PITCHES,
  MINI_FORMATS,
  MINI_KW,
} from "./constants.js";

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
  const n = (name || "").toLowerCase();
  return cfgList.find((t) =>
    n.includes(t.name.toLowerCase().replace("hsm ", ""))
  );
}

function getPitch(pitchCfg, pitchId) {
  return pitchCfg.find((pitch) => pitch.id === pitchId);
}

function getPitchSurface(pitch) {
  if (!pitch) return "grass";

  const explicit = String(pitch.surface || "").toLowerCase();

  if (explicit) return explicit;

  const text = `${pitch.id || ""} ${pitch.name || ""} ${pitch.label || ""} ${
    pitch.desc || ""
  } ${pitch.type || ""}`.toLowerCase();

  if (text.includes("astro")) return "astro";
  if (text.includes("3g")) return "3g";
  if (text.includes("4g")) return "4g";

  return "grass";
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

function formatCanUsePitch(teamFormat, pitch) {
  if (!pitch) return false;

  if (!pitch.format) return true;
  if (pitch.format === teamFormat) return true;

  const sizeRank = {
    "3v3": 1,
    "5v5": 2,
    "7v7": 3,
    "9v9": 4,
    "11v11-youth": 5,
    "11v11-small": 5,
    "11v11": 6,
  };

  const need = sizeRank[teamFormat] || 6;
  const have = sizeRank[pitch.format] || 6;

  return have >= need;
}

function pitchAvailableBySurface(pitchCfg, pitchId, useAstro) {
  const artificial = isArtificialPitch(pitchCfg, pitchId);

  if (artificial && !useAstro) return false;

  return true;
}

function getLinkedPitchIds(pitchCfg, pitchId) {
  const linked = new Set([pitchId]);
  const pitch = getPitch(pitchCfg, pitchId);

  if (pitch?.innerOf) linked.add(pitch.innerOf);

  pitchCfg.forEach((candidate) => {
    if (candidate.innerOf === pitchId) linked.add(candidate.id);
    if (pitch?.innerOf && candidate.innerOf === pitch.innerOf) linked.add(candidate.id);
  });

  return [...linked];
}

function buildClosedPitchSet(pitchCfg, closedPitches = []) {
  const closed = new Set();

  (Array.isArray(closedPitches) ? closedPitches : Object.keys(closedPitches || {}))
    .filter(Boolean)
    .forEach((pitchId) => {
      getLinkedPitchIds(pitchCfg, pitchId).forEach((linkedId) => closed.add(linkedId));
    });

  return closed;
}

export function scheduleSat(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3
) {
  const pitchCfg = pitchCfgArg && pitchCfgArg.length ? pitchCfgArg : PITCHES;
  const closedPitchSet = buildClosedPitchSet(pitchCfg, closedPitches);

  const active = fixtures.filter((fixture) => fixture.status === "active");

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
  const adultKo = 14 * 60;

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

    if (isAdult(fixture.homeTeam)) {
      let placed = false;

      for (const pitchId of [cfg.defaultPitch, cfg.altPitch].filter(Boolean)) {
        if (!(pitchId in slots)) continue;

        if (free(pitchId, adultKo, adultKo + duration)) {
          book(pitchId, adultKo, adultKo + duration);

          scheduled.push({
            ...fixture,
            pitchId,
            koTime: t2s(adultKo),
            koMins: adultKo,
            endMins: adultKo + duration,
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
          reason: "No valid adult 2pm slot. Preferred pitches may be closed, wrong surface, or already occupied.",
        });
      }

      continue;
    }

    const preferredOptions = [cfg.defaultPitch, cfg.altPitch]
      .filter(Boolean)
      .filter((pitchId) => pitchId in slots);

    let options = [...preferredOptions];

    if (MINI_FORMATS.includes(cfg.format)) {
      pitchCfg.forEach((pitch) => {
        const canUse =
          pitch.independent &&
          pitch.id in slots &&
          !options.includes(pitch.id) &&
          (!pitch.format ||
            pitch.format === cfg.format ||
            MINI_FORMATS.includes(pitch.format));

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
            return MINI_FORMATS.includes(cfg.format);
          }

          return formatCanUsePitch(cfg.format, pitch);
        })
        .map((pitch) => pitch.id);
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

export function scheduleSun(
  fixtures,
  useAstro,
  closedPitches,
  cfgList,
  bufMap,
  startMins,
  endMins,
  pitchCfgArg = PITCHES,
  maxConcurrent = 3
) {
  return scheduleSat(
    fixtures,
    useAstro,
    closedPitches,
    cfgList,
    bufMap,
    startMins,
    endMins,
    pitchCfgArg,
    maxConcurrent
  );
}