export const INACTIVITY_WARNING_MS = 25 * 60 * 1000;
export const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;
export const INACTIVITY_ACTIVITY_KEY = "daxora:last-user-activity";

export function serialiseActivity(userId, at = Date.now()) {
  return JSON.stringify({ userId: String(userId || ""), at: Number(at) });
}

export function parseActivity(value, userId = "") {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (String(parsed?.userId || "") !== String(userId || "")) return null;
    return Number.isFinite(Number(parsed?.at)) ? Number(parsed.at) : null;
  } catch {
    return null;
  }
}

export function getInactivityState(lastActivityAt, now = Date.now()) {
  const elapsed = Math.max(0, Number(now) - Number(lastActivityAt || now));
  const remainingMs = Math.max(0, INACTIVITY_LOGOUT_MS - elapsed);
  return {
    status: elapsed >= INACTIVITY_LOGOUT_MS
      ? "expired"
      : elapsed >= INACTIVITY_WARNING_MS
        ? "warning"
        : "active",
    elapsedMs: elapsed,
    remainingMs,
  };
}
