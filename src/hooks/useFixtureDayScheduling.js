import { useMemo } from "react";
import { AVG_CARS } from "../lib/constants.js";
import { decorateFixturesForDay, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";

function buildPitchConflicts(active = [], pitchCfg = []) {
  const conflicts = [];
  const games = active.filter(
    (game) => game.koMins != null && game.endMins != null
  );

  for (let a = 0; a < games.length; a += 1) {
    for (let b = a + 1; b < games.length; b += 1) {
      const first = games[a];
      const second = games[b];
      const firstPitch = pitchCfg.find((pitch) => pitch.id === first.pitchId);
      const secondPitch = pitchCfg.find((pitch) => pitch.id === second.pitchId);

      const linked =
        first.pitchId === second.pitchId ||
        firstPitch?.innerOf === second.pitchId ||
        secondPitch?.innerOf === first.pitchId;

      if (
        linked &&
        first.koMins < second.endMins &&
        second.koMins < first.endMins
      ) {
        conflicts.push({ a: first, b: second });
      }
    }
  }

  return conflicts;
}

function calculatePeakCars(active = [], club = {}) {
  const games = active.filter(
    (game) => game.koMins != null && game.endMins != null
  );
  if (!games.length) return 0;

  let peak = 0;
  const cars = club.avgCars || AVG_CARS;

  for (let mins = 0; mins < 24 * 60; mins += 15) {
    const current = games
      .filter((game) => game.koMins <= mins && game.endMins > mins)
      .reduce(
        (sum, game) =>
          sum +
          (cars?.[game.cfg?.format] || AVG_CARS[game.cfg?.format] || 8),
        0
      );

    peak = Math.max(peak, current);
  }

  return peak;
}

export function useFixtureDayScheduling({
  dayKey = "saturday",
  scheduled = [],
  overrides = {},
  unresolved = [],
  pitchCfg = [],
  club = {},
} = {}) {
  const key = normaliseFixtureDayKey(dayKey);

  const final = useMemo(
    () =>
      decorateFixturesForDay(
        scheduled.map((game, index) => ({
          ...game,
          ...(overrides[index] || {}),
        })),
        key
      ),
    [scheduled, overrides, key]
  );

  const active = useMemo(
    () =>
      final.filter(
        (game) => game.status !== "postponed" && game.status !== "cancelled"
      ),
    [final]
  );

  const postponed = useMemo(
    () => final.filter((game) => game.status === "postponed"),
    [final]
  );

  const officialWarnings = useMemo(
    () =>
      final.filter(
        (game) =>
          game.status !== "postponed" &&
          game.status !== "cancelled" &&
          String(game.refStatus || "").toLowerCase() !== "confirmed"
      ).length,
    [final]
  );

  const conflicts = useMemo(
    () => buildPitchConflicts(active, pitchCfg),
    [active, pitchCfg]
  );

  const peakCars = useMemo(
    () => calculatePeakCars(active, club),
    [active, club]
  );

  const carCap = Number(club.carParkSpaces || 57);
  const parkingOver = peakCars > carCap;

  const readiness = useMemo(() => {
    const checks = [
      {
        key: "clashes",
        ok: conflicts.length === 0,
        okText: "No clashes detected",
        badText: `${conflicts.length} pitch clash${conflicts.length === 1 ? "" : "es"} detected`,
      },
      {
        key: "parking",
        ok: !parkingOver,
        okText: "Parking monitored",
        badText: `Parking over capacity (${peakCars}/${carCap})`,
      },
      {
        key: "officials",
        ok: officialWarnings === 0,
        okText: "Officials allocated",
        badText: `${officialWarnings} referee${officialWarnings === 1 ? "" : "s"} unconfirmed`,
      },
      {
        key: "unresolved",
        ok: unresolved.length === 0,
        okText: "All fixtures placed",
        badText: `${unresolved.length} fixture${unresolved.length === 1 ? "" : "s"} need assignment`,
      },
    ];

    const passed = checks.filter((check) => check.ok).length;
    return {
      checks,
      pct: checks.length ? Math.round((passed / checks.length) * 100) : 0,
      allReady: passed === checks.length,
    };
  }, [conflicts, parkingOver, peakCars, carCap, officialWarnings, unresolved]);

  return {
    dayKey: key,
    final,
    active,
    postponed,
    officialWarnings,
    conflicts,
    peakCars,
    carCap,
    parkingOver,
    readiness,

    // Compatibility aliases for older components while the UI is consolidated.
    satFinal: final,
    satActive: active,
    satPostponed: postponed,
    refWarnings: officialWarnings,
    satConflicts: conflicts,
  };
}

export default useFixtureDayScheduling;
