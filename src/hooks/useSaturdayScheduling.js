import { useMemo } from "react";
import { isMini } from "../lib/scheduler.js";
import { AVG_CARS } from "../lib/constants.js";

export function useSaturdayScheduling({
  satScheduled,
  satOverrides,
  satUnresolved,
  pitchCfg,
  club,
}) {
  const satFinal = useMemo(
    () => satScheduled.map((game, index) => ({
      ...game,
      ...(satOverrides[index] || {}),
    })),
    [satScheduled, satOverrides]
  );

  const satActive = useMemo(
    () => satFinal.filter((game) => game.status !== "postponed"),
    [satFinal]
  );

  const satPostponed = useMemo(
    () => satFinal.filter((game) => game.status === "postponed"),
    [satFinal]
  );

  const refWarnings = useMemo(
    () =>
      satFinal.filter(
        (game) =>
          game.status !== "postponed" &&
          String(game.refStatus || "").toLowerCase() !== "confirmed"
      ).length,
    [satFinal]
  );

  const satConflicts = useMemo(() => {
    const out = [];
    const games = satActive.filter(
      (game) => game.koMins != null && game.endMins != null
    );

    for (let a = 0; a < games.length; a++) {
      for (let b = a + 1; b < games.length; b++) {
        const g1 = games[a];
        const g2 = games[b];

        const p1 = pitchCfg.find((pitch) => pitch.id === g1.pitchId);
        const p2 = pitchCfg.find((pitch) => pitch.id === g2.pitchId);

        const linked =
          g1.pitchId === g2.pitchId ||
          (p1 && p1.innerOf === g2.pitchId) ||
          (p2 && p2.innerOf === g1.pitchId);

        if (linked && g1.koMins < g2.endMins && g2.koMins < g1.endMins) {
          out.push({ a: g1, b: g2 });
        }
      }
    }

    return out;
  }, [satActive, pitchCfg]);

  const peakCars = useMemo(() => {
    const games = satActive.filter(
      (game) => game.koMins != null && game.endMins != null
    );

    if (!games.length) return 0;

    let peak = 0;
    const cars = club.avgCars || AVG_CARS;

    for (let t = 0; t < 24 * 60; t += 15) {
      const current = games
        .filter((game) => game.koMins <= t && game.endMins > t)
        .reduce(
          (sum, game) =>
            sum +
            ((cars && cars[game.cfg?.format]) ||
              AVG_CARS[game.cfg?.format] ||
              8),
          0
        );

      if (current > peak) peak = current;
    }

    return peak;
  }, [satActive, club.avgCars]);

  const carCap = club.carParkSpaces || 57;
  const parkingOver = peakCars > carCap;

  const readiness = useMemo(() => {
    const checks = [];

    checks.push({
      key: "clashes",
      ok: satConflicts.length === 0,
      okText: "No clashes detected",
      badText:
        satConflicts.length +
        " pitch clash" +
        (satConflicts.length > 1 ? "es" : "") +
        " detected",
    });

    checks.push({
      key: "parking",
      ok: !parkingOver,
      okText: "Parking monitored",
      badText: "Parking over capacity (" + peakCars + "/" + carCap + ")",
    });

    checks.push({
      key: "officials",
      ok: refWarnings === 0,
      okText: "Officials allocated",
      badText:
        refWarnings +
        " referee" +
        (refWarnings > 1 ? "s" : "") +
        " unconfirmed",
    });

    checks.push({
      key: "unresolved",
      ok: satUnresolved.length === 0,
      okText: "All fixtures placed",
      badText:
        satUnresolved.length +
        " fixture" +
        (satUnresolved.length > 1 ? "s" : "") +
        " need assignment",
    });

    const passed = checks.filter((check) => check.ok).length;
    const pct = checks.length ? Math.round((passed / checks.length) * 100) : 0;

    return {
      checks,
      pct,
      allReady: passed === checks.length,
    };
  }, [satConflicts, parkingOver, peakCars, carCap, refWarnings, satUnresolved]);

  return {
    satFinal,
    satActive,
    satPostponed,
    refWarnings,
    satConflicts,
    peakCars,
    carCap,
    parkingOver,
    readiness,
  };
}