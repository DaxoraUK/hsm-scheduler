const STORAGE_KEY = "gc_pitch_closures_v2";
const LEGACY_KEYS = ["hsm_closed_pitches", "hsm_closedpitches", "gc_closed_pitches"];

function dateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayDateValue() {
  return dateOnly(new Date());
}

function makeId(pitchId = "pitch") {
  const random = Math.random().toString(36).slice(2, 8);
  return `closure_${String(pitchId).replace(/[^a-z0-9]+/gi, "_")}_${Date.now()}_${random}`;
}

function normaliseMode(record = {}) {
  if (record.untilReopened === true || record.mode === "untilReopened") return "untilReopened";
  if (record.mode === "range" || (record.effectiveTo && record.effectiveTo !== record.effectiveFrom)) return "range";
  return "matchday";
}

export function normalisePitchClosure(record, fallbackDate = todayDateValue()) {
  if (!record) return null;

  if (typeof record === "string") {
    const pitchId = record.trim();
    if (!pitchId) return null;
    return {
      id: makeId(pitchId),
      pitchId,
      mode: "untilReopened",
      effectiveFrom: fallbackDate,
      effectiveTo: null,
      untilReopened: true,
      reason: "Existing closure",
      notes: "Migrated from the previous pitch closure format.",
      createdAt: new Date().toISOString(),
      createdBy: "Migration",
      reopenedAt: null,
      reopenedBy: null,
    };
  }

  const pitchId = String(record.pitchId || record.pitch || record.id || "").trim();
  if (!pitchId) return null;

  const mode = normaliseMode(record);
  const effectiveFrom = dateOnly(record.effectiveFrom || record.fromDate || record.date || fallbackDate) || fallbackDate;
  const effectiveTo = mode === "range"
    ? dateOnly(record.effectiveTo || record.toDate || effectiveFrom) || effectiveFrom
    : mode === "matchday"
      ? effectiveFrom
      : null;

  return {
    id: String(record.id || makeId(pitchId)),
    pitchId,
    mode,
    effectiveFrom,
    effectiveTo,
    untilReopened: mode === "untilReopened",
    reason: String(record.reason || "Pitch unavailable").trim() || "Pitch unavailable",
    notes: String(record.notes || "").trim(),
    createdAt: record.createdAt || new Date().toISOString(),
    createdBy: record.createdBy || "Ground Control user",
    reopenedAt: record.reopenedAt || null,
    reopenedBy: record.reopenedBy || null,
    reopenedReason: record.reopenedReason || null,
  };
}

export function normalisePitchClosures(records = [], fallbackDate = todayDateValue()) {
  const list = Array.isArray(records)
    ? records
    : Object.entries(records || {})
        .filter(([, value]) => Boolean(value))
        .map(([pitchId]) => pitchId);

  return list
    .map((record) => normalisePitchClosure(record, fallbackDate))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function loadPitchClosures() {
  if (typeof localStorage === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalisePitchClosures(JSON.parse(stored));

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (!legacy) continue;
      const migrated = normalisePitchClosures(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.warn("Could not load pitch closures", error);
  }

  return [];
}

export function persistPitchClosures(records = []) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalisePitchClosures(records)));
  } catch (error) {
    console.warn("Could not save pitch closures", error);
  }
}

export function isPitchClosureActive(record, activeDate = todayDateValue()) {
  const closure = normalisePitchClosure(record, activeDate);
  if (!closure || closure.reopenedAt) return false;

  const date = dateOnly(activeDate) || todayDateValue();
  if (closure.effectiveFrom && date < closure.effectiveFrom) return false;
  if (closure.untilReopened) return true;
  if (!closure.effectiveTo) return date === closure.effectiveFrom;
  return date <= closure.effectiveTo;
}

export function getActivePitchClosures(records = [], activeDate = todayDateValue()) {
  return normalisePitchClosures(records, activeDate).filter((record) =>
    isPitchClosureActive(record, activeDate)
  );
}

export function getActiveClosedPitchIds(records = [], activeDate = todayDateValue()) {
  return [...new Set(getActivePitchClosures(records, activeDate).map((record) => record.pitchId))];
}

export function getUpcomingPitchClosures(records = [], activeDate = todayDateValue()) {
  const date = dateOnly(activeDate) || todayDateValue();
  return normalisePitchClosures(records, date)
    .filter((record) => !record.reopenedAt && record.effectiveFrom > date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function endBoundary(record) {
  if (record.untilReopened) return "9999-12-31";
  return record.effectiveTo || record.effectiveFrom;
}

function rangesOverlap(a, b) {
  return a.effectiveFrom <= endBoundary(b) && b.effectiveFrom <= endBoundary(a);
}

export function addPitchClosure(records = [], input = {}) {
  const createdAt = new Date().toISOString();
  const nextClosure = normalisePitchClosure(
    {
      ...input,
      id: input.id || makeId(input.pitchId),
      createdAt: input.createdAt || createdAt,
    },
    input.effectiveFrom || todayDateValue()
  );

  if (!nextClosure) return normalisePitchClosures(records);

  const updated = normalisePitchClosures(records).map((record) => {
    if (
      !record.reopenedAt &&
      record.pitchId === nextClosure.pitchId &&
      rangesOverlap(record, nextClosure)
    ) {
      return {
        ...record,
        reopenedAt: createdAt,
        reopenedBy: input.createdBy || "Ground Control user",
        reopenedReason: "Replaced by an updated closure",
      };
    }
    return record;
  });

  return normalisePitchClosures([nextClosure, ...updated]);
}

export function reopenPitchClosures(
  records = [],
  pitchIds = [],
  activeDate = todayDateValue(),
  metadata = {}
) {
  const ids = new Set((Array.isArray(pitchIds) ? pitchIds : [pitchIds]).map(String));
  if (!ids.size) return normalisePitchClosures(records);

  const reopenedAt = new Date().toISOString();
  return normalisePitchClosures(records).map((record) => {
    if (
      ids.has(String(record.pitchId)) &&
      isPitchClosureActive(record, activeDate)
    ) {
      return {
        ...record,
        reopenedAt,
        reopenedBy: metadata.reopenedBy || "Ground Control user",
        reopenedReason: metadata.reopenedReason || "Manually reopened",
      };
    }
    return record;
  });
}

export function describePitchClosure(record = {}) {
  const closure = normalisePitchClosure(record);
  if (!closure) return "Pitch unavailable";
  if (closure.untilReopened) return `From ${closure.effectiveFrom} until manually reopened`;
  if (closure.effectiveFrom === closure.effectiveTo) return `Closed on ${closure.effectiveFrom}`;
  return `${closure.effectiveFrom} to ${closure.effectiveTo}`;
}

export function getPitchClosureStorageKey() {
  return STORAGE_KEY;
}
