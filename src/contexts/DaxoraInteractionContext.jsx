import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import DaxoraConfirmDialog from "../components/system/DaxoraConfirmDialog.jsx";
import DaxoraPromptDialog from "../components/system/DaxoraPromptDialog.jsx";

const DaxoraInteractionContext = createContext({
  confirm: async () => false,
  prompt: async () => null,
});

function normaliseConfirmOptions(options) {
  if (typeof options === "string") return { title: "Confirm action", description: options };
  return {
    title: "Confirm action",
    description: "Please confirm that you want to continue.",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    tone: "warning",
    ...options,
  };
}

function normalisePromptOptions(options) {
  if (typeof options === "string") return { title: "Add details", description: options };
  return {
    title: "Add details",
    description: "Enter the information required to continue.",
    label: "Details",
    confirmLabel: "Continue",
    cancelLabel: "Cancel",
    defaultValue: "",
    multiline: true,
    required: false,
    minLength: 0,
    ...options,
  };
}

export function DaxoraInteractionProvider({ children }) {
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [promptRequest, setPromptRequest] = useState(null);
  const activeResolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    activeResolver.current?.(false);
    activeResolver.current = resolve;
    setPromptRequest(null);
    setConfirmRequest(normaliseConfirmOptions(options));
  }), []);

  const prompt = useCallback((options) => new Promise((resolve) => {
    activeResolver.current?.(null);
    activeResolver.current = resolve;
    setConfirmRequest(null);
    setPromptRequest(normalisePromptOptions(options));
  }), []);

  const settleConfirm = useCallback((value) => {
    const resolve = activeResolver.current;
    activeResolver.current = null;
    setConfirmRequest(null);
    resolve?.(Boolean(value));
  }, []);

  const settlePrompt = useCallback((value) => {
    const resolve = activeResolver.current;
    activeResolver.current = null;
    setPromptRequest(null);
    resolve?.(value);
  }, []);

  const value = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DaxoraInteractionContext.Provider value={value}>
      {children}
      <DaxoraConfirmDialog request={confirmRequest} onCancel={() => settleConfirm(false)} onConfirm={() => settleConfirm(true)} />
      <DaxoraPromptDialog request={promptRequest} onCancel={() => settlePrompt(null)} onConfirm={settlePrompt} />
    </DaxoraInteractionContext.Provider>
  );
}

export function useDaxoraConfirm() {
  const context = useContext(DaxoraInteractionContext);
  return context.confirm;
}

export function useDaxoraPrompt() {
  const context = useContext(DaxoraInteractionContext);
  return context.prompt;
}
