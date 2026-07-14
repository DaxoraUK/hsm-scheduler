import { useEffect, useMemo, useState } from "react";

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function usePersistedWorkspaceState(storageKey, initialValue) {
  const stableInitial = useMemo(() => initialValue, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined" || !storageKey) return stableInitial;
    return safeParse(window.localStorage?.getItem(storageKey), stableInitial);
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    const stored = safeParse(window.localStorage?.getItem(storageKey), stableInitial);
    setValue(stored);
  }, [storageKey, stableInitial]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    try {
      window.localStorage?.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Workspace preferences are helpful but never allowed to block operations.
    }
  }, [storageKey, value]);

  return [value, setValue];
}
