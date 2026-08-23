import { useMemo } from "react";
import { decorateFixturesForDay, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { getParkingSnapshot } from "../lib/engines/parkingEngine.js";
import { isFixtureOfficialConfirmed } from "../lib/engines/officialsEngine.js";

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
          !isFixtureOfficialConfirmed(game)
      ).length,
    [final]
  );

  const conflicts = useMemo(
    () => buildPitchConflicts(active, pitchCfg),
    [active, pitchCfg]
  );

  const parkingSnapshot = useMemo(
    () =>
      getParkingSnapshot({
        fixtures: active,
        club,
        pitchCfg,
      }),
    [active, club, pitchCfg]
  );

  const parkingEnabled = parkingSnapshot.enabled !== false;
  const peakCars = parkingSnapshot.peakCars;
  const carCap = parkingSnapshot.capacity;
  const parkingConfigured = parkingEnabled && carCap > 0;
  const parkingOver =
    parkingSnapshot.isOverCapacity ||
    parkingSnapshot.isOverConcurrentLimit;

  const readiness = useMemo(() => {
    const checks = [
      {
        key: "clashes",
        ok: conflicts.length === 0,
        okText: "No clashes detected",
        badText: `${conflicts.length} pitch clash${conflicts.length === 1 ? "" : "es"} detected`,
      },
      ...(parkingEnabled
        ? [{
            key: "parking",
            ok: parkingConfigured && !parkingOver,
            okText: "Parking monitored",
            badText: !parkingConfigured
              ? "Parking capacity not configured"
              : parkingSnapshot.isOverCapacity
                ? `Parking over capacity (${peakCars}/${carCap})`
                : `Parking concurrency limit exceeded (${parkingSnapshot.peakSlot?.fixtureCount || 0}/${parkingSnapshot.analysis?.settings?.maxConcurrent || 0})`,
          }]
        : []),
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
  }, [
    conflicts,
    parkingEnabled,
    parkingConfigured,
    parkingOver,
    parkingSnapshot,
    peakCars,
    carCap,
    officialWarnings,
    unresolved,
  ]);

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
    parkingEnabled,
    parkingSnapshot,
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
