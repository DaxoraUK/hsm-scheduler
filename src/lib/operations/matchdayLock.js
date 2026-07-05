const PREFIX = "ground-control:matchday-lock";

function safePart(value, fallback = "unknown") {
  const text = String(value || "").trim().toLowerCase();
  return text || fallback;
}

export function getMatchdayLockKey({ clubId, day, date } = {}) {
  return [PREFIX, safePart(clubId, "club"), safePart(day, "matchday"), safePart(date, "undated")].join(":");
}

export function readMatchdayLock(input = {}) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getMatchdayLockKey(input)) === "1";
  } catch {
    return false;
  }
}

export function writeMatchdayLock(input = {}, locked = false) {
  if (typeof window === "undefined") return Boolean(locked);
  try {
    const key = getMatchdayLockKey(input);
    if (locked) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
    // A lock remains usable for the current view even when browser storage is unavailable.
  }
  return Boolean(locked);
}
