import { Auth, isSupaConfigured, supaFetch } from "../supabase.js";

const LOCAL_PREFIX = "gc_funding_impact_v1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `impact_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function localKey(clubId) {
  return `${LOCAL_PREFIX}:${String(clubId || "local-club")}`;
}

function remoteEligible(clubId) {
  return Boolean(clubId && isSupaConfigured() && Auth.getSession()?.access_token);
}

function encodeFilter(value) {
  return encodeURIComponent(String(value));
}

function numeric(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function readLocal(clubId) {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    return asArray(JSON.parse(window.localStorage.getItem(localKey(clubId)) || "[]"));
  } catch {
    return [];
  }
}

function writeLocal(clubId, rows) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(localKey(clubId), JSON.stringify(asArray(rows)));
}

export function normaliseFundingImpactRecord(row = {}) {
  const data = row.data && typeof row.data === "object" ? row.data : row;
  return {
    id: row.id || data.id || createId(),
    clubId: row.club_id || row.clubId || data.clubId || "",
    projectId: row.project_id || row.projectId || data.projectId || "",
    periodStart: row.period_start || row.periodStart || data.periodStart || "",
    periodEnd: row.period_end || row.periodEnd || data.periodEnd || "",
    status: row.status || data.status || "draft",
    evidenceMethod: row.evidence_method || row.evidenceMethod || data.evidenceMethod || "manual_count",
    sourceLabel: row.source_label || row.sourceLabel || data.sourceLabel || "",
    completedSessions: numeric(row.completed_sessions ?? row.completedSessions ?? data.completedSessions),
    attendanceVisits: numeric(row.attendance_visits ?? row.attendanceVisits ?? data.attendanceVisits),
    uniqueParticipants: numeric(row.unique_participants ?? row.uniqueParticipants ?? data.uniqueParticipants),
    youthParticipants: numeric(row.youth_participants ?? row.youthParticipants ?? data.youthParticipants),
    womenGirlsParticipants: numeric(row.women_girls_participants ?? row.womenGirlsParticipants ?? data.womenGirlsParticipants),
    disabilityParticipants: numeric(row.disability_participants ?? row.disabilityParticipants ?? data.disabilityParticipants),
    communitySessions: numeric(row.community_sessions ?? row.communitySessions ?? data.communitySessions),
    cancelledSessions: numeric(row.cancelled_sessions ?? row.cancelledSessions ?? data.cancelledSessions),
    volunteerCount: numeric(row.volunteer_count ?? row.volunteerCount ?? data.volunteerCount),
    volunteerHours: numeric(row.volunteer_hours ?? row.volunteerHours ?? data.volunteerHours),
    outcomeSummary: row.outcome_summary || row.outcomeSummary || data.outcomeSummary || "",
    notes: row.notes || data.notes || "",
    verifiedBy: row.verified_by_label || row.verifiedBy || data.verifiedBy || "",
    verifiedAt: row.verified_at || row.verifiedAt || data.verifiedAt || "",
    createdAt: row.created_at || row.createdAt || data.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || data.updatedAt || null,
    local: Boolean(row.local || data.local),
  };
}

export function createFundingImpactDraft(projectId = "") {
  const today = new Date().toISOString().slice(0, 10);
  return normaliseFundingImpactRecord({
    id: "",
    projectId,
    periodStart: today,
    periodEnd: today,
    status: "draft",
    evidenceMethod: "manual_count",
  });
}

export function validateFundingImpactRecord(record = {}) {
  const errors = [];
  if (!record.projectId) errors.push("Save and select a funding project first.");
  if (!record.periodStart || !record.periodEnd) errors.push("Record a start and end date.");
  if (record.periodStart && record.periodEnd && record.periodEnd < record.periodStart) errors.push("The end date must not be before the start date.");
  if (numeric(record.uniqueParticipants) > numeric(record.attendanceVisits) && numeric(record.attendanceVisits) > 0) {
    errors.push("Unique participants cannot exceed total attendance visits.");
  }
  if (record.status === "verified" && !String(record.sourceLabel || "").trim()) {
    errors.push("Verified evidence needs a clear source label.");
  }
  if (record.status === "verified" && !String(record.verifiedBy || "").trim()) {
    errors.push("Record who checked the figures before marking the evidence verified.");
  }
  const unique = numeric(record.uniqueParticipants);
  [
    ["Under-18 participants", record.youthParticipants],
    ["Women and girls participants", record.womenGirlsParticipants],
    ["Disabled participants", record.disabilityParticipants],
  ].forEach(([label, value]) => {
    if (unique > 0 && numeric(value) > unique) errors.push(`${label} cannot exceed unique participants.`);
  });
  return errors;
}

export function summariseFundingImpactEvidence(records = []) {
  const rows = asArray(records).map(normaliseFundingImpactRecord);
  const verified = rows.filter((row) => row.status === "verified");
  const sum = (key) => verified.reduce((total, row) => total + numeric(row[key]), 0);
  return {
    totalRecords: rows.length,
    verifiedRecords: verified.length,
    draftRecords: rows.length - verified.length,
    completedSessions: sum("completedSessions"),
    attendanceVisits: sum("attendanceVisits"),
    uniqueParticipants: sum("uniqueParticipants"),
    youthParticipants: sum("youthParticipants"),
    womenGirlsParticipants: sum("womenGirlsParticipants"),
    disabilityParticipants: sum("disabilityParticipants"),
    communitySessions: sum("communitySessions"),
    cancelledSessions: sum("cancelledSessions"),
    volunteerCount: sum("volunteerCount"),
    volunteerHours: Number(sum("volunteerHours").toFixed(2)),
    periodStart: verified.map((row) => row.periodStart).filter(Boolean).sort()[0] || "",
    periodEnd: verified.map((row) => row.periodEnd).filter(Boolean).sort().slice(-1)[0] || "",
    sources: [...new Set(verified.map((row) => row.sourceLabel).filter(Boolean))],
    records: rows,
    verified,
  };
}

export async function loadFundingImpactEvidence(clubId, projectId = "") {
  if (!remoteEligible(clubId)) {
    const records = readLocal(clubId).map((row) => normaliseFundingImpactRecord({ ...row, local: true }));
    return { mode: "local", records: projectId ? records.filter((row) => row.projectId === projectId) : records };
  }
  try {
    const projectFilter = projectId ? `&project_id=eq.${encodeFilter(projectId)}` : "";
    const rows = await supaFetch("GET", `funding_impact_records?select=*&club_id=eq.${encodeFilter(clubId)}${projectFilter}&order=period_end.desc,updated_at.desc`);
    return { mode: "remote", records: asArray(rows).map(normaliseFundingImpactRecord) };
  } catch (error) {
    const missingSchema = [400, 404].includes(Number(error?.status || 0)) || /funding_impact_records/i.test(String(error?.message || ""));
    if (!missingSchema) throw error;
    const records = readLocal(clubId).map((row) => normaliseFundingImpactRecord({ ...row, local: true }));
    return {
      mode: "local",
      reason: "Impact evidence migration is not installed. Records are stored only in this browser.",
      records: projectId ? records.filter((row) => row.projectId === projectId) : records,
    };
  }
}

export async function saveFundingImpactEvidence(clubId, record, mode = "remote") {
  const now = new Date().toISOString();
  const normalised = normaliseFundingImpactRecord({
    ...record,
    id: record?.id || createId(),
    clubId,
    verifiedAt: record?.status === "verified" ? record?.verifiedAt || now : "",
    updatedAt: now,
    createdAt: record?.createdAt || now,
  });
  const errors = validateFundingImpactRecord(normalised);
  if (errors.length) {
    const error = new Error(errors[0]);
    error.validationErrors = errors;
    throw error;
  }

  if (mode !== "remote" || !remoteEligible(clubId)) {
    const records = readLocal(clubId);
    writeLocal(clubId, [
      { ...normalised, local: true },
      ...records.filter((row) => row.id !== normalised.id),
    ]);
    return { ...normalised, local: true };
  }

  const payload = {
    id: normalised.id,
    club_id: clubId,
    project_id: normalised.projectId,
    period_start: normalised.periodStart,
    period_end: normalised.periodEnd,
    status: normalised.status,
    evidence_method: normalised.evidenceMethod,
    source_label: normalised.sourceLabel,
    completed_sessions: normalised.completedSessions,
    attendance_visits: normalised.attendanceVisits,
    unique_participants: normalised.uniqueParticipants,
    youth_participants: normalised.youthParticipants,
    women_girls_participants: normalised.womenGirlsParticipants,
    disability_participants: normalised.disabilityParticipants,
    community_sessions: normalised.communitySessions,
    cancelled_sessions: normalised.cancelledSessions,
    volunteer_count: normalised.volunteerCount,
    volunteer_hours: normalised.volunteerHours,
    outcome_summary: normalised.outcomeSummary,
    notes: normalised.notes,
    verified_by_label: normalised.verifiedBy,
    verified_at: normalised.verifiedAt || null,
  };
  const rows = await supaFetch("POST", "funding_impact_records?on_conflict=id", payload, {
    Prefer: "resolution=merge-duplicates,return=representation",
  });
  return normaliseFundingImpactRecord(asArray(rows)[0] || payload);
}

export async function deleteFundingImpactEvidence(clubId, recordId, mode = "remote") {
  if (mode !== "remote" || !remoteEligible(clubId)) {
    writeLocal(clubId, readLocal(clubId).filter((row) => row.id !== recordId));
    return true;
  }
  await supaFetch("DELETE", `funding_impact_records?id=eq.${encodeFilter(recordId)}&club_id=eq.${encodeFilter(clubId)}`, null, {
    Prefer: "return=minimal",
  });
  return true;
}
