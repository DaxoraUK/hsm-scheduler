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
  setClosedPitches,
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
  const toggleClosed = useCallback(
    (pitchId) => {
      setClosedPitches((previous) =>
        previous.includes(pitchId)
          ? previous.filter((id) => id !== pitchId)
          : [...previous, pitchId]
      );
    },
    [setClosedPitches]
  );

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
    setClosedPitches([]);
    setUseAstro(false);
  }, [
    fixtureDayResetters,
    setSatScheduled,
    setSatUnresolved,
    setSatOverrides,
    setSatManual,
    setSatFetchStatus,
    setSatHasRun,
    setClosedPitches,
    setUseAstro,
  ]);

  return {
    toggleClosed,
    resetAll,
  };
}
