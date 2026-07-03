const STORAGE_PREFIX = "gc:v2";
const ACTIVE_CLUB_PREFIX = "gc:active-club";

let tenantContext = {
  userId: "",
  clubId: "",
};

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function safePart(value) {
  return encodeURIComponent(String(value || "").trim());
}

function tenantPrefix(context = tenantContext) {
  if (!context.userId || !context.clubId) return "";
  return `${STORAGE_PREFIX}:${safePart(context.userId)}:${safePart(context.clubId)}`;
}

export function setTenantStorageContext({ userId, clubId } = {}) {
  tenantContext = {
    userId: String(userId || "").trim(),
    clubId: String(clubId || "").trim(),
  };
  return getTenantStorageContext();
}

export function clearTenantStorageContext() {
  tenantContext = { userId: "", clubId: "" };
}

export function getTenantStorageContext() {
  return { ...tenantContext };
}

export function hasTenantStorageContext() {
  return Boolean(tenantContext.userId && tenantContext.clubId);
}

export function getTenantStorageKey(key) {
  const prefix = tenantPrefix();
  return prefix ? `${prefix}:${safePart(key)}` : "";
}

export function tenantGetItem(key, fallback = null) {
  const storage = getStorage();
  const storageKey = getTenantStorageKey(key);
  if (!storage || !storageKey) return fallback;

  try {
    const value = storage.getItem(storageKey);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function tenantSetItem(key, value) {
  const storage = getStorage();
  const storageKey = getTenantStorageKey(key);
  if (!storage || !storageKey) return false;

  try {
    storage.setItem(storageKey, String(value));
    return true;
  } catch {
    return false;
  }
}

export function tenantRemoveItem(key) {
  const storage = getStorage();
  const storageKey = getTenantStorageKey(key);
  if (!storage || !storageKey) return false;

  try {
    storage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

export function tenantGetJson(key, fallback = null) {
  const raw = tenantGetItem(key, null);
  if (raw === null) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function tenantSetJson(key, value) {
  try {
    return tenantSetItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function getUserScopedItem(userId, key, fallback = null) {
  const storage = getStorage();
  if (!storage || !userId) return fallback;

  try {
    const value = storage.getItem(`${ACTIVE_CLUB_PREFIX}:${safePart(userId)}:${safePart(key)}`);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function setUserScopedItem(userId, key, value) {
  const storage = getStorage();
  if (!storage || !userId) return false;

  try {
    storage.setItem(`${ACTIVE_CLUB_PREFIX}:${safePart(userId)}:${safePart(key)}`, String(value));
    return true;
  } catch {
    return false;
  }
}

const LEGACY_KEY_MAP = {
  productionMode: ["hsm_production"],
  matchdayScope: ["gc_matchday_scope"],
  club: ["hsm_club"],
  pitches: ["hsm_pitches"],
  teamConfig: ["hsm_teamcfg"],
  referees: ["hsm_refs"],
  history: ["hsm_history"],
  testSaturday: ["hsm_testsat"],
  testSunday: ["hsm_testsun"],
  testMidweek: ["hsm_testmidweek"],
  pitchClosures: ["gc_pitch_closures_v2", "hsm_closed_pitches", "hsm_closedpitches", "gc_closed_pitches"],
  matchWeekend: ["gc_match_weekend"],
  midweekDate: ["gc_midweek_date"],
  midweekWindow: ["gc_midweek_window"],
};

/**
 * Copies the pre-multi-club browser cache into the currently selected club once.
 * Legacy keys are removed after a successful copy so a second account using the
 * same browser cannot inherit the first club's operational data.
 */
export function migrateLegacyTenantStorage() {
  const storage = getStorage();
  const prefix = tenantPrefix();
  if (!storage || !prefix) return { migrated: false, keys: [] };

  try {
    const markerKey = `${prefix}:legacy-migrated`;
    if (storage.getItem(markerKey) === "1") return { migrated: false, keys: [] };

    const migratedKeys = [];

    for (const [targetKey, legacyKeys] of Object.entries(LEGACY_KEY_MAP)) {
      const destination = getTenantStorageKey(targetKey);
      if (!destination || storage.getItem(destination) !== null) continue;

      for (const legacyKey of legacyKeys) {
        const legacyValue = storage.getItem(legacyKey);
        if (legacyValue === null) continue;
        storage.setItem(destination, legacyValue);
        migratedKeys.push(targetKey);
        break;
      }
    }

    for (const legacyKeys of Object.values(LEGACY_KEY_MAP)) {
      for (const legacyKey of legacyKeys) storage.removeItem(legacyKey);
    }

    // Weather and control-room caches may contain club-specific operational data.
    // They are intentionally discarded rather than guessed into a tenant.
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key?.startsWith("gc_live_weather_v1:") || key?.startsWith("gc_operations_centre_")) {
        storage.removeItem(key);
      }
    }

    storage.setItem(markerKey, "1");
    return { migrated: migratedKeys.length > 0, keys: migratedKeys };
  } catch {
    return { migrated: false, keys: [] };
  }
}
