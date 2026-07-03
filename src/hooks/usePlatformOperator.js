import { useCallback, useEffect, useRef, useState } from "react";
import { DB } from "../lib/supabase.js";
import { normalisePlatformContext } from "../lib/platform/adminModel.js";
import { isRecoverableAccessVerificationError } from "../lib/errors/recovery.js";

const EMPTY_CONTEXT = normalisePlatformContext({ is_platform_staff: false });

export function usePlatformOperator(authSession) {
  const [context, setContext] = useState(EMPTY_CONTEXT);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const verifiedRef = useRef(EMPTY_CONTEXT);

  const userId = authSession?.user?.id || "";

  const refresh = useCallback(async () => {
    if (!authSession?.access_token || !userId) {
      verifiedRef.current = EMPTY_CONTEXT;
      setContext(EMPTY_CONTEXT);
      setStatus("idle");
      setError("");
      return EMPTY_CONTEXT;
    }

    const previous = verifiedRef.current;
    setStatus(previous.isPlatformStaff ? "ready" : "loading");
    setError("");

    try {
      const next = normalisePlatformContext(await DB.getPlatformOperatorContext());
      verifiedRef.current = next;
      setContext(next);
      setStatus("ready");
      return next;
    } catch (loadError) {
      if (previous.isPlatformStaff && isRecoverableAccessVerificationError(loadError)) {
        setContext(previous);
        setStatus("ready");
        setError("");
        return previous;
      }
      verifiedRef.current = EMPTY_CONTEXT;
      setContext(EMPTY_CONTEXT);
      setStatus("error");
      setError(loadError?.message || "Platform access could not be verified.");
      return EMPTY_CONTEXT;
    }
  }, [authSession?.access_token, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { context, status, error, refresh };
}
