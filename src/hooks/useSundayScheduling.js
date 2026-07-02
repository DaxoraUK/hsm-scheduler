import { useFixtureDayScheduling } from "./useFixtureDayScheduling.js";

export function useSundayScheduling({
  sunScheduled,
  sunOverrides,
  sunUnresolved = [],
  pitchCfg = [],
  club = {},
}) {
  const model = useFixtureDayScheduling({
    dayKey: "sunday",
    scheduled: sunScheduled,
    overrides: sunOverrides,
    unresolved: sunUnresolved,
    pitchCfg,
    club,
  });

  return {
    ...model,
    sunFinal: model.final,
    sunActive: model.active,
    sunPostponed: model.postponed,
    sunConflicts: model.conflicts,
    sunRefWarnings: model.officialWarnings,
  };
}
