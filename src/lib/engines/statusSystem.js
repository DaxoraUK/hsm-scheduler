const PLATFORM_STATUS = {
  EXCELLENT: "excellent",
  HEALTHY: "healthy",
  WATCH: "watch",
  ATTENTION: "attention",
  CRITICAL: "critical",
};

const STATUS_META = {
  excellent: {
    key: "excellent",
    label: "Excellent",
    legacyStatus: "success",
    chipVariant: "success",
    weight: 100,
    priority: 0,
  },
  healthy: {
    key: "healthy",
    label: "Healthy",
    legacyStatus: "success",
    chipVariant: "success",
    weight: 90,
    priority: 1,
  },
  watch: {
    key: "watch",
    label: "Watch",
    legacyStatus: "warning",
    chipVariant: "warning",
    weight: 75,
    priority: 2,
  },
  attention: {
    key: "attention",
    label: "Attention",
    legacyStatus: "warning",
    chipVariant: "warning",
    weight: 55,
    priority: 3,
  },
  critical: {
    key: "critical",
    label: "Critical",
    legacyStatus: "danger",
    chipVariant: "danger",
    weight: 25,
    priority: 4,
  },
};

function clampScore(score, fallback = 100) {
  const value = Number(score);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getPlatformStatusFromScore(score, { hasCritical = false, hasAttention = false } = {}) {
  const value = clampScore(score);

  if (hasCritical || value < 55) return STATUS_META[PLATFORM_STATUS.CRITICAL];
  if (hasAttention || value < 70) return STATUS_META[PLATFORM_STATUS.ATTENTION];
  if (value < 85) return STATUS_META[PLATFORM_STATUS.WATCH];
  if (value < 96) return STATUS_META[PLATFORM_STATUS.HEALTHY];
  return STATUS_META[PLATFORM_STATUS.EXCELLENT];
}

export function normalisePlatformStatus(status, fallback = "healthy") {
  const key = String(status || "").toLowerCase();

  if (STATUS_META[key]) return STATUS_META[key];

  if (["danger", "urgent", "error", "needs action", "action required"].includes(key)) {
    return STATUS_META.critical;
  }

  if (["warning", "review", "attention", "needs review", "review required"].includes(key)) {
    return STATUS_META.attention;
  }

  if (["info", "watch", "planned"].includes(key)) {
    return STATUS_META.watch;
  }

  if (["success", "ready", "healthy", "complete", "clear"].includes(key)) {
    return STATUS_META.healthy;
  }

  return STATUS_META[fallback] || STATUS_META.healthy;
}

export function getWorstPlatformStatus(statuses = []) {
  const normalised = statuses.map((status) => normalisePlatformStatus(status));
  return normalised.sort((a, b) => b.priority - a.priority)[0] || STATUS_META.healthy;
}

export function getLegacyStatus(status) {
  return normalisePlatformStatus(status).legacyStatus;
}

export function getStatusLabel(status) {
  return normalisePlatformStatus(status).label;
}

export { PLATFORM_STATUS, STATUS_META };
