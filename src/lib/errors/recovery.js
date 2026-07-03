export function createSupportReference({ now = new Date(), random = Math.random() } = {}) {
  const date = now instanceof Date ? now : new Date(now);
  const stamp = Number.isNaN(date.getTime())
    ? "UNKNOWN"
    : date.toISOString().replace(/\D/g, "").slice(0, 14);
  const randomValue = typeof random === "function" ? random() : random;
  const suffix = Number(randomValue || 0).toString(36).replace(/^0\./, "").slice(0, 5).toUpperCase().padEnd(5, "0");
  return `GC-${stamp}-${suffix}`;
}

export function getSessionRefreshDelay(
  session,
  { now = Date.now(), bufferMs = 120_000, fallbackMs = 60_000 } = {}
) {
  const expiresAt = Number(session?.expires_at || 0) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return fallbackMs;
  return Math.max(1_000, Math.min(expiresAt - Number(now) - bufferMs, fallbackMs));
}


export function isRecoverableAccessVerificationError(
  error,
  { online = typeof navigator === "undefined" ? true : navigator.onLine !== false } = {}
) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || error || "").toLowerCase();

  if ([401, 403].includes(status)) return false;
  if (["AUTH_REQUIRED", "SESSION_EXPIRED", "CLUB_ACCESS_DENIED"].includes(code)) return false;
  if (online === false) return true;
  if ([408, 425, 429].includes(status) || status >= 500) return true;

  return status === 0 && /(failed to fetch|network|load failed|offline|timed? out|connection)/i.test(message);
}

export function getSyncBanner({ online = true, dbStatus = "connected", syncError = "", sessionStatus = "active" } = {}) {
  if (!online) {
    return {
      kind: "offline",
      title: "Offline mode",
      message: "Ground Control remains available, but cloud saves cannot complete until the connection returns.",
      retryable: false,
    };
  }
  if (dbStatus === "error") {
    return {
      kind: "error",
      title: "Cloud sync needs attention",
      message: syncError || "One or more changes are stored on this device but have not reached Supabase.",
      retryable: true,
    };
  }
  if (sessionStatus === "refreshing") {
    return {
      kind: "refreshing",
      title: "Refreshing secure session…",
      message: "",
      retryable: false,
    };
  }
  return null;
}
