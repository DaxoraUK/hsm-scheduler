import { useCallback, useEffect, useRef, useState } from "react";
import { Auth } from "../lib/supabase.js";
import { getSessionRefreshDelay } from "../lib/errors/recovery.js";
import {
  INACTIVITY_ACTIVITY_KEY,
  INACTIVITY_WARNING_MS,
  INACTIVITY_LOGOUT_MS,
} from "../lib/security/inactivityPolicy.js";

const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const FALLBACK_CHECK_MS = 60 * 1000;

function sessionExpiryMs(session) {
  const seconds = Number(session?.expires_at || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

export function useSessionLifecycle({ session, onSession, onExpired, onInactivityWarning }) {
  const [status, setStatus] = useState(session?.access_token ? "active" : "signed-out");
  const timerRef = useRef(null);
  const refreshingRef = useRef(false);
  const inactivityTimersRef = useRef({ warning: null, logout: null });
  const lastActivityWriteRef = useRef(0);
  const warningShownRef = useRef(false);

  const expire = useCallback((message = "Your secure session has expired. Sign in again to continue.") => {
    Auth.clearSession();
    setStatus("expired");
    onSession?.(null);
    onExpired?.(message);
  }, [onExpired, onSession]);

  const refresh = useCallback(async ({ force = false } = {}) => {
    if (!session?.access_token || refreshingRef.current) return null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("offline");
      return session;
    }

    refreshingRef.current = true;
    setStatus("refreshing");
    try {
      const next = await Auth.getValidSession({ forceRefresh: force });
      if (!next?.access_token) {
        expire();
        return null;
      }
      onSession?.(next);
      setStatus("active");
      return next;
    } catch (error) {
      if ([401, 403].includes(Number(error?.status)) || ["SESSION_EXPIRED", "AUTH_REQUIRED"].includes(error?.code)) {
        expire(error?.message);
        return null;
      }
      setStatus(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      return null;
    } finally {
      refreshingRef.current = false;
    }
  }, [expire, onSession, session]);

  useEffect(() => {
    if (!session?.access_token) {
      setStatus("signed-out");
      return undefined;
    }

    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const expiry = sessionExpiryMs(session);
      const delay = getSessionRefreshDelay(session, {
        bufferMs: REFRESH_BUFFER_MS,
        fallbackMs: FALLBACK_CHECK_MS,
      });
      timerRef.current = window.setTimeout(async () => {
        const shouldForce = expiry > 0 && expiry - Date.now() <= REFRESH_BUFFER_MS;
        await refresh({ force: shouldForce });
        if (!cancelled) schedule();
      }, delay);
    };

    const verifyVisibleSession = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const syncAcrossTabs = () => {
      const stored = Auth.getSession();
      if (!stored?.access_token) {
        expire("This account was signed out in another browser tab.");
        return;
      }
      onSession?.(stored);
      setStatus("active");
    };

    const handleOnline = () => refresh({ force: false });
    const handleOffline = () => setStatus("offline");

    setStatus("active");
    schedule();
    window.addEventListener("focus", verifyVisibleSession);
    window.addEventListener("storage", syncAcrossTabs);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", verifyVisibleSession);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      window.removeEventListener("focus", verifyVisibleSession);
      window.removeEventListener("storage", syncAcrossTabs);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", verifyVisibleSession);
    };
  }, [expire, onSession, refresh, session]);

  useEffect(() => {
    if (!session?.access_token || typeof window === "undefined") return undefined;
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll"];

    const clearTimers = () => {
      window.clearTimeout(inactivityTimersRef.current.warning);
      window.clearTimeout(inactivityTimersRef.current.logout);
    };
    const scheduleInactivity = (lastActivityAt = Date.now()) => {
      clearTimers();
      warningShownRef.current = false;
      const elapsed = Math.max(0, Date.now() - lastActivityAt);
      inactivityTimersRef.current.warning = window.setTimeout(() => {
        if (warningShownRef.current) return;
        warningShownRef.current = true;
        onInactivityWarning?.(INACTIVITY_LOGOUT_MS - INACTIVITY_WARNING_MS);
      }, Math.max(0, INACTIVITY_WARNING_MS - elapsed));
      inactivityTimersRef.current.logout = window.setTimeout(() => {
        expire("You were signed out after 30 minutes without activity.");
      }, Math.max(0, INACTIVITY_LOGOUT_MS - elapsed));
    };
    const recordActivity = () => {
      const now = Date.now();
      scheduleInactivity(now);
      if (now - lastActivityWriteRef.current < 1000) return;
      lastActivityWriteRef.current = now;
      try { window.localStorage.setItem(INACTIVITY_ACTIVITY_KEY, String(now)); } catch { /* optional cross-tab sync */ }
    };
    const syncActivity = (event) => {
      if (event.key !== INACTIVITY_ACTIVITY_KEY) return;
      const recordedAt = Number(event.newValue);
      if (Number.isFinite(recordedAt)) scheduleInactivity(recordedAt);
    };

    scheduleInactivity(Date.now());
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("storage", syncActivity);
    return () => {
      clearTimers();
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("storage", syncActivity);
    };
  }, [expire, onInactivityWarning, session?.access_token]);

  return { status, refresh };
}
