import { useMemo } from "react";

export function useSundayScheduling({
  sunScheduled,
  sunOverrides,
}) {
  const sunFinal = useMemo(
    () =>
      sunScheduled.map((game, index) => ({
        ...game,
        ...(sunOverrides[index] || {}),
      })),
    [sunScheduled, sunOverrides]
  );

  return {
    sunFinal,
  };
}