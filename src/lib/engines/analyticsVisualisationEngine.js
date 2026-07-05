import { getParkingCapacity } from "../domain/clubDomain.js";
import { buildEvidenceQuality } from "./evidenceQualityEngine.js";
import {
  buildOperationalEvidence,
  normaliseSavedHistory,
} from "./operationalEvidenceEngine.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function monthKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Unknown month";
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function makePeriodOptions(entries = []) {
  const options = [
    { value: "all", label: "All saved matchdays" },
    { value: "last-4", label: "Last 4 matchdays" },
    { value: "last-8", label: "Last 8 matchdays" },
    { value: "last-12", label: "Last 12 matchdays" },
  ];
  const seen = new Set();
  entries.forEach((entry) => {
    const key = monthKey(entry.date);
    if (key === "unknown" || seen.has(key)) return;
    seen.add(key);
    options.push({ value: `month:${key}`, label: monthLabel(entry.date) });
  });
  return options;
}

function filterEntries(entries, period = "all", matchday = "all") {
  let result = entries;
  if (matchday !== "all") {
    result = entries.filter((entry) => entry.id === String(matchday));
  } else if (period.startsWith("last-")) {
    const limit = Number(period.replace("last-", ""));
    result = entries.slice(0, Number.isFinite(limit) ? limit : entries.length);
  } else if (period.startsWith("month:")) {
    const key = period.replace("month:", "");
    result = entries.filter((entry) => monthKey(entry.date) === key);
  }
  return result.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
}

function insightSentence(evidence) {
  const { summary } = evidence;
  if (!evidence.entries.length || !evidence.rows.length) {
    return "Save completed matchdays to begin building reliable operational trends.";
  }
  const parts = [
    `${summary.total} fixture${summary.total === 1 ? "" : "s"} recorded across ${evidence.entries.length} matchday${evidence.entries.length === 1 ? "" : "s"}`,
    `${summary.deliveryRate}% scheduled to proceed`,
  ];
  if (summary.busiestSlot?.label) parts.push(`${summary.busiestSlot.label} is the busiest kick-off window`);
  if (summary.busiestPitch?.label) parts.push(`${summary.busiestPitch.label} carries the highest pitch load`);
  if (summary.officialOutstanding) parts.push(`${summary.officialOutstanding} official appointment${summary.officialOutstanding === 1 ? " remains" : "s remain"} outstanding`);
  if (summary.parkingOverCapacity) parts.push(`${summary.parkingOverCapacity} selected matchday${summary.parkingOverCapacity === 1 ? " has" : "s have"} parking pressure`);
  return `${parts.join(". ")}.`;
}

export function buildAnalyticsVisualisationModel({
  history = [],
  club = {},
  pitchCfg = [],
  teamCfg = [],
  period = "all",
  matchday = "all",
  day = "matchweek",
  team = "all",
  pitch = "all",
  format = "all",
} = {}) {
  const entries = normaliseSavedHistory(history);
  const selectedEntries = filterEntries(entries, period, matchday);
  const evidence = buildOperationalEvidence({
    entries: selectedEntries,
    scope: day,
    club,
    pitchCfg,
    teamCfg,
    filters: { team, pitch, format },
  });
  const summary = evidence.summary;
  const quality = buildEvidenceQuality({
    evidence,
    entries: selectedEntries,
    club,
    pitchCfg,
    teamCfg,
  });
  const evidenceScore = clamp(
    Math.min(40, entries.length * 5) +
      (summary.total > 0 ? 15 : 0) +
      (evidence.pitchStats.some((item) => item.total > 0) ? 10 : 0) +
      (evidence.kickOffDistribution.length ? 10 : 0) +
      (summary.officialConfirmed > 0 ? 10 : 0) +
      (evidence.weekly.some((week) => week.parkingPeak > 0) ? 10 : 0) +
      (summary.weatherCoverage > 0 ? 5 : 0)
  );
  const matchdayOptions = [
    { value: "all", label: "All matchdays" },
    ...entries.map((entry) => ({ value: entry.id, label: entry.fullLabel })),
  ];
  const pitchUtilisation = evidence.pitchStats
    .filter((item) => item.total > 0)
    .map((item) => ({ ...item, pitchId: item.pitchId || item.key }));

  return {
    filters: {
      periodOptions: makePeriodOptions(entries),
      matchdayOptions,
      teamOptions: evidence.filterOptions.teams,
      pitchOptions: evidence.filterOptions.pitches,
      formatOptions: evidence.filterOptions.formats,
      selectedPeriod: period,
      selectedMatchday: matchday,
      selectedDay: day,
      selectedTeam: team,
      selectedPitch: pitch,
      selectedFormat: format,
    },
    hasData: evidence.rows.length > 0,
    savedMatchdays: entries.length,
    selectedMatchdays: selectedEntries.length,
    summary: {
      ...summary,
      evidenceScore,
      insight: insightSentence(evidence),
    },
    weekly: evidence.weekly,
    kickOffDistribution: evidence.kickOffDistribution,
    pitchUtilisation,
    pitchHeatmap: evidence.pitchHeatmap,
    dayTimeHeatmap: evidence.dayTimeHeatmap,
    parkingCapacity: evidence.weekly.find((week) => week.parkingCapacity > 0)?.parkingCapacity ?? getParkingCapacity(club, 0),
    teamPerformance: evidence.teamStats,
    formatDistribution: evidence.formatStats,
    weather: {
      coverage: summary.weatherCoverage,
      high: summary.weatherHigh,
      watch: summary.weatherWatch,
    },
    quality,
    sourceRows: evidence.rows.map((row) => ({
      id: row.id,
      entryLabel: row.entryLabel,
      dayLabel: row.dayLabel,
      dateLabel: row.dateLabel,
      koTime: row.koTime,
      fixtureLabel: row.fixtureLabel,
      status: row.status,
      statusLabel: row.statusLabel,
      pitchLabel: row.pitchLabel,
      format: row.format,
      referee: row.referee || "TBC",
      officialStatus: row.officialConfirmed ? "Confirmed" : row.officialStatus || "Outstanding",
      weatherRisk: row.weatherRisk,
    })),
  };
}
