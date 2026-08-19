import { useCallback, useEffect } from "react";
import { useDaxoraConfirm } from "../contexts/DaxoraInteractionContext.jsx";

const DEFAULT_MESSAGE = "You have unsaved League Manager changes. Leave this area and discard them?";

export function useUnsavedChangesGuard(enabled, message = DEFAULT_MESSAGE) {
  const daxoraConfirm = useDaxoraConfirm();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [enabled]);

  return useCallback(async () => {
    if (!enabled || typeof window === "undefined") return true;
    return daxoraConfirm({
      title: "Discard unsaved changes?",
      description: message,
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
      warning: "This action cannot be undone.",
    });
  }, [confirm, enabled, message]);
}
