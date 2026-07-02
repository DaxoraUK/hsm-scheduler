import { useCallback } from "react";

function clearFixtureDayState(day = {}) {
  day.setScheduled?.([]);
  day.setUnresolved?.([]);
  day.setOverrides?.({});
  day.setManual?.([]);
  day.setFetchStatus?.([]);
  day.setHasRun?.(false);
  day.setShowManual?.(false);
}

export function useOperationsActions({
  fixtureDayResetters = [],
  // Compatibility props for older callers.
  setSatScheduled,
  setSatUnresolved,
  setSatOverrides,
  setSatManual,
  setSatFetchStatus,
  setSatHasRun,
  setUseAstro,
}) {
  const resetAll = useCallback(() => {
    const resetters = fixtureDayResetters.length
      ? fixtureDayResetters
      : [
          {
            setScheduled: setSatScheduled,
            setUnresolved: setSatUnresolved,
            setOverrides: setSatOverrides,
            setManual: setSatManual,
            setFetchStatus: setSatFetchStatus,
            setHasRun: setSatHasRun,
          },
        ];

    resetters.forEach(clearFixtureDayState);
    // Facility closures are persistent operational records and must not be
    // cleared when a schedule is reset.
    setUseAstro(false);
  }, [
    fixtureDayResetters,
    setSatScheduled,
    setSatUnresolved,
    setSatOverrides,
    setSatManual,
    setSatFetchStatus,
    setSatHasRun,
    setUseAstro,
  ]);

  return { resetAll };
}
