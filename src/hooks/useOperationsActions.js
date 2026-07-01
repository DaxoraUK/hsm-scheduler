import { useCallback } from "react";

export function useOperationsActions({
  setClosedPitches,
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
      setClosedPitches((prev) =>
        prev.includes(pitchId)
          ? prev.filter((id) => id !== pitchId)
          : [...prev, pitchId]
      );
    },
    [setClosedPitches]
  );

  const resetAll = useCallback(() => {
    setSatScheduled([]);
    setSatUnresolved([]);
    setSatOverrides({});
    setSatManual([]);
    setSatFetchStatus([]);
    setSatHasRun(false);
    setClosedPitches([]);
    setUseAstro(false);
  }, [
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