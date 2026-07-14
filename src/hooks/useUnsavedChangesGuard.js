import { useCallback, useEffect } from "react";

const DEFAULT_MESSAGE = "You have unsaved League Manager changes. Leave this area and discard them?";

export function useUnsavedChangesGuard(enabled, message = DEFAULT_MESSAGE) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [enabled]);

  return useCallback(() => {
    if (!enabled || typeof window === "undefined") return true;
    return window.confirm(message);
  }, [enabled, message]);
}
