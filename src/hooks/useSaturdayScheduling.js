import { useFixtureDayScheduling } from "./useFixtureDayScheduling.js";

export function useSaturdayScheduling({
  satScheduled,
  satOverrides,
  satUnresolved,
  pitchCfg,
  club,
}) {
  return useFixtureDayScheduling({
    dayKey: "saturday",
    scheduled: satScheduled,
    overrides: satOverrides,
    unresolved: satUnresolved,
    pitchCfg,
    club,
  });
}
