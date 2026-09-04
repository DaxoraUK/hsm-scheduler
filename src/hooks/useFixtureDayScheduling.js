import { useMemo } from "react";
import { decorateFixturesForDay, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { getParkingSnapshot } from "../lib/engines/parkingEngine.js";
import { isFixtureOfficialConfirmed } from "../lib/engines/officialsEngine.js";
import { findEffectiveAllocationConflicts } from "../lib/domain/allocationConflicts.js";

export function useFixtureDayScheduling({
  dayKey = "saturday",
  effectiveSchedule = null,
  scheduled = [],
  unresolved = [],
  pitchCfg = [],
  club = {},
} = {}) {
  const key = normaliseFixtureDayKey(dayKey);
  const effectiveScheduled = effectiveSchedule?.scheduled || scheduled;
  const effectiveUnresolved = effectiveSchedule?.unresolved || unresolved;

  const final = useMemo(
    () =>
      decorateFixturesForDay(effectiveScheduled, key),
    [effectiveScheduled, key]
  );

  const active = useMemo(
    () =>
      final.filter(
        (game) => game.status !== "postponed" && game.status !== "cancelled" && game.status !== "away" && !game.isAwayFixture
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
          game.status !== "away" &&
          !game.isAwayFixture &&
          !isFixtureOfficialConfirmed(game)
      ).length,
    [final]
  );

  const conflicts = useMemo(
    () => findEffectiveAllocationConflicts({ fixtures: active, pitchCfg }),
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
        ok: effectiveUnresolved.length === 0,
        okText: "All fixtures placed",
        badText: `${effectiveUnresolved.length} fixture${effectiveUnresolved.length === 1 ? "" : "s"} need assignment`,
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
    effectiveUnresolved,
  ]);

  return {
    dayKey: key,
    effectiveSchedule,
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
