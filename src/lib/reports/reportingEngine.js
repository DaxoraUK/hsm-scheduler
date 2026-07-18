import {
  buildOperationalEvidence,
  createCurrentMatchweekEntry,
  normaliseSavedHistory,
} from "../engines/operationalEvidenceEngine.js";
import { buildEvidenceQuality } from "../engines/evidenceQualityEngine.js";
import { buildGrantEvidenceFramework } from "../grants/grantEvidenceFramework.js";
import { buildGrantFundingModel } from "../grants/grantMatchingEngine.js";

export const REPORT_TYPES = [
  { id: "facilities", label: "Unified facility usage", description: "Fixtures, training, friendlies, winter provision, closures and unused capacity." },
  { id: "operations", label: "Operations pack", description: "Complete matchday schedule, risks and readiness." },
  { id: "fixtures", label: "Fixture allocations", description: "Kick-offs, teams, pitches, formats and outcomes." },
  { id: "pitches", label: "Pitch usage", description: "Fixture load, hours and postponement pressure by pitch." },
  { id: "parking", label: "Parking", description: "Daily peak demand against configured capacity." },
  { id: "officials", label: "Officials", description: "Appointment coverage and outstanding confirmations." },
  { id: "exceptions", label: "Exceptions", description: "Postponed, cancelled, unresolved and incomplete records." },
  { id: "analytics", label: "Analytics snapshot", description: "Executive operational summary for the selected period." },
  { id: "funding", label: "Funding evidence draft", description: "Evidence provenance, gaps, limitations and a source appendix for human review." },
];

export const REPORT_SCOPES = [
  { value: "matchweek", label: "Matchweek" },
  { value: "weekend", label: "Weekend" },
  { value: "midweek", label: "Midweek" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function reportTitle(type) {
  return REPORT_TYPES.find((item) => item.id === type)?.label || "Operations report";
}

function buildExceptions(evidence) {
  const issues = [];
  evidence.rows.forEach((row) => {
    if (["postponed", "cancelled", "unresolved"].includes(row.status)) {
      issues.push({
        id: `${row.id}:${row.status}`,
        type: row.status,
        typeLabel: row.statusLabel,
        severity: row.status === "cancelled" ? "danger" : row.status === "postponed" ? "warning" : "review",
        day: row.day,
        dayLabel: row.dayLabel,
        date: row.date,
        dateLabel: row.dateLabel,
        koTime: row.koTime,
        fixture: row.fixtureLabel,
        pitch: row.pitchLabel,
        detail:
          row.status === "unresolved"
            ? "No validated pitch and kick-off allocation is currently recorded."
            : `${row.statusLabel} fixture retained in the operational record.`,
      });
    }

    if (row.status === "delivered" && !row.officialConfirmed) {
      issues.push({
        id: `${row.id}:official`,
        type: "official",
        typeLabel: "Official outstanding",
        severity: "warning",
        day: row.day,
        dayLabel: row.dayLabel,
        date: row.date,
        dateLabel: row.dateLabel,
        koTime: row.koTime,
        fixture: row.fixtureLabel,
        pitch: row.pitchLabel,
        detail: row.referee
          ? `${row.referee} is recorded but not confirmed.`
          : "No confirmed match official is recorded.",
      });
    }

    if (row.status === "delivered" && (!row.pitchId || row.koMins == null)) {
      issues.push({
        id: `${row.id}:allocation`,
        type: "allocation",
        typeLabel: "Incomplete allocation",
        severity: "danger",
        day: row.day,
        dayLabel: row.dayLabel,
        date: row.date,
        dateLabel: row.dateLabel,
        koTime: row.koTime,
        fixture: row.fixtureLabel,
        pitch: row.pitchLabel,
        detail: !row.pitchId && row.koMins == null
          ? "Pitch and kick-off are missing."
          : !row.pitchId
            ? "Pitch allocation is missing."
            : "Kick-off time is missing.",
      });
    }
  });

  return issues.sort((a, b) => {
    const severity = { danger: 0, warning: 1, review: 2 };
    return (severity[a.severity] ?? 9) - (severity[b.severity] ?? 9) ||
      String(a.date).localeCompare(String(b.date)) ||
      String(a.koTime).localeCompare(String(b.koTime));
  });
}

function buildParkingRows(evidence) {
  return evidence.weekly.flatMap((week) =>
    week.dayParking.map(({ day, dateLabel, hasRun, snapshot }) => ({
      id: `${week.id}:${day}`,
      matchday: week.fullLabel,
      day,
      dayLabel: day === "saturday" ? "Saturday" : day === "sunday" ? "Sunday" : "Midweek",
      dateLabel,
      assessed: Boolean(hasRun),
      enabled: snapshot.enabled,
      configured: snapshot.configured,
      capacity: snapshot.capacity,
      peakCars: snapshot.peakCars,
      utilisation: snapshot.utilisation,
      peakTime: snapshot.peakTime,
      fixtureCount: snapshot.fixtureCount,
      status: hasRun ? snapshot.status : { key: "pending", label: "Not assessed", variant: "neutral", score: null },
      overCapacity: Boolean(hasRun && snapshot.isOverCapacity),
      overConcurrent: Boolean(hasRun && snapshot.isOverConcurrentLimit),
    }))
  );
}

function readinessSummary(evidence) {
  const blockers = [];
  if (evidence.summary.unresolved) blockers.push(`${evidence.summary.unresolved} unresolved`);
  if (evidence.summary.officialOutstanding) blockers.push(`${evidence.summary.officialOutstanding} officials outstanding`);
  if (evidence.summary.parkingOverCapacity) blockers.push(`${evidence.summary.parkingOverCapacity} parking pressure matchdays`);
  if (evidence.cancelled.length) blockers.push(`${evidence.cancelled.length} cancelled`);

  if (!evidence.rows.length) {
    return {
      status: "neutral",
      label: "No report data",
      score: 0,
      detail: "Build or select a saved matchday to create a report.",
    };
  }

  const penalty =
    evidence.summary.unresolved * 15 +
    evidence.summary.officialOutstanding * 5 +
    evidence.summary.parkingOverCapacity * 10 +
    evidence.cancelled.length * 5;
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const hasCriticalBlocker = evidence.summary.unresolved > 0 || evidence.cancelled.length > 0;
  const hasReviewBlocker = evidence.summary.officialOutstanding > 0 || evidence.summary.parkingOverCapacity > 0;
  const status = hasCriticalBlocker ? "danger" : hasReviewBlocker ? "warning" : "success";
  return {
    status,
    label: status === "success" ? "Operationally ready" : status === "warning" ? "Review required" : "Action required",
    score,
    detail: blockers.length ? blockers.join(" · ") : "No material operational blockers are recorded.",
  };
}

export function buildReportsModel({
  selectedSource = "current",
  scope = "matchweek",
  reportType = "operations",
  history = [],
  club = {},
  pitchCfg = [],
  teamCfg = [],
  refs = [],
  current = {},
} = {}) {
  const currentEntry = createCurrentMatchweekEntry(current);
  const historyEntries = normaliseSavedHistory(history);
  const allSources = [currentEntry, ...historyEntries];
  const selectedEntry = allSources.find((entry) => entry.id === String(selectedSource)) || currentEntry;
  const evidence = buildOperationalEvidence({
    entries: selectedEntry ? [selectedEntry] : [],
    scope,
    club,
    pitchCfg,
    teamCfg,
  });
  const selectedDays = selectedEntry?.days.filter((day) => {
    if (["matchweek", "all"].includes(scope)) return true;
    if (scope === "weekend") return ["saturday", "sunday"].includes(day.key);
    return day.key === scope;
  }) || [];
  const sourceOptions = allSources.map((entry) => ({
    value: entry.id,
    label: entry.fullLabel,
    kind: entry.kind,
  }));
  const parkingRows = buildParkingRows(evidence);
  const exceptions = buildExceptions(evidence);
  const readiness = readinessSummary(evidence);
  const quality = buildEvidenceQuality({
    evidence,
    entries: selectedEntry ? [selectedEntry] : [],
    club,
    pitchCfg,
    teamCfg,
    refs,
  });
  const grantFramework = buildGrantEvidenceFramework({
    club,
    evidence,
    quality,
    pitchCfg,
    teamCfg,
    refs,
    metrics: {
      scheduledFixtures: evidence.summary.scheduled ?? evidence.summary.delivered,
      postponedFixtures: evidence.summary.postponed,
      facilityHours: evidence.summary.facilityHours,
      officialCoverage: evidence.summary.officialCoverage,
      parkingPressureWeeks: evidence.summary.parkingOverCapacity,
    },
  });
  const grantFunding = buildGrantFundingModel({
    club,
    quality,
    framework: grantFramework,
    projectType: "all",
    availability: "current",
  });
  const reportDefinition = REPORT_TYPES.find((item) => item.id === reportType) || REPORT_TYPES[0];

  const officialRows = evidence.delivered.map((row) => ({
    ...row,
    contact: [row.refPhone, row.refEmail].filter(Boolean).join(" · "),
  }));

  return {
    reportType,
    reportTitle: reportTitle(reportType),
    reportDefinition,
    scope,
    selectedSource: selectedEntry?.id || "current",
    sourceKind: selectedEntry?.kind || "current",
    sourceLabel: selectedEntry?.fullLabel || "Current matchweek",
    sourceOptions,
    selectedEntry,
    selectedDays,
    evidence,
    fixtures: evidence.rows,
    activeFixtures: evidence.delivered,
    pitchRows: evidence.pitchStats,
    teamRows: evidence.teamStats,
    formatRows: evidence.formatStats,
    parkingRows,
    officialRows,
    exceptions,
    readiness,
    quality,
    grantFramework,
    funding: grantFunding,
    metrics: {
      scheduledFixtures: evidence.summary.scheduled ?? evidence.summary.delivered,
      teamOpportunitySlots: (evidence.summary.scheduled ?? evidence.summary.delivered) * 2,
      facilityHours: evidence.summary.facilityHours,
      postponedFixtures: evidence.summary.postponed,
      officialCoverage: evidence.summary.officialCoverage,
    },
    sourceRows: evidence.rows,
    narrative: `${club?.name || "The club"} has ${evidence.summary.scheduled ?? evidence.summary.delivered} fixture${(evidence.summary.scheduled ?? evidence.summary.delivered) === 1 ? "" : "s"} scheduled to proceed in this selection, representing ${((evidence.summary.scheduled ?? evidence.summary.delivered) * 2)} team fixture opportunities and ${evidence.summary.facilityHours || 0} scheduled pitch hours. These figures do not prove completed activity, attendance or unique beneficiaries.`,
    configuredOfficials: asArray(refs).length,
    hasData: evidence.rows.length > 0,
    generatedAt: new Date(),
  };
}

export function reportFilename({ clubName = "ground-control", reportType = "operations", sourceLabel = "matchday", extension = "csv" } = {}) {
  const safe = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${safe(clubName) || "ground-control"}-${safe(reportType) || "report"}-${safe(sourceLabel) || "matchday"}.${extension}`;
}
