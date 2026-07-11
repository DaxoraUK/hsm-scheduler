import { buildEvidenceQuality } from "./evidenceQualityEngine.js";
import {
  buildOperationalEvidence,
  createCurrentMatchweekEntry,
  normaliseSavedHistory,
} from "./operationalEvidenceEngine.js";
import { buildGrantEvidenceFramework } from "../grants/grantEvidenceFramework.js";
import { buildGrantFundingModel, inferGrantHomeNation } from "../grants/grantMatchingEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function normalise(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isYouthRow(row = {}) {
  return /\bu(?:[5-9]|1[0-8])\b/i.test(row.fixtureLabel || row.homeTeam || "");
}

function isFemaleRow(row = {}) {
  return /\b(girl|girls|lioness|lionesses|ladies|women|female)\b/i.test(row.fixtureLabel || row.homeTeam || "");
}

function getTone(score) {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "danger";
}

function evidenceLabel(score) {
  if (score >= 85) return "Strong operational evidence";
  if (score >= 65) return "Usable evidence with gaps";
  if (score >= 40) return "Evidence developing";
  return "More evidence needed";
}

function rateLabel(rate) {
  if (rate <= 5) return "Excellent";
  if (rate <= 12) return "Stable";
  if (rate <= 20) return "Under pressure";
  return "Priority risk";
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

function filterEntries(entries, period = "all") {
  if (period.startsWith("last-")) {
    const limit = Number(period.replace("last-", ""));
    return entries.slice(0, Number.isFinite(limit) ? limit : entries.length).slice().reverse();
  }
  if (period.startsWith("month:")) {
    const key = period.replace("month:", "");
    return entries.filter((entry) => monthKey(entry.date) === key).slice().reverse();
  }
  return entries.slice().reverse();
}

function buildPriority({ id, title, detail, evidence, severity = "medium", grantAngle }) {
  return { id, title, detail, evidence, severity, grantAngle };
}

function parkingUtilisation(week = {}) {
  if (!week.parkingCapacity) return 0;
  return Math.round((Number(week.parkingPeak || 0) / Number(week.parkingCapacity)) * 100);
}

export function buildGrantImpactModel({
  club = {},
  history = [],
  pitchCfg = [],
  teamCfg = [],
  refs = [],
  closedPitches = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
  satDate = "",
  sunDate = "",
  midweekDate = "",
  satDateLabel = "Saturday",
  sunDateLabel = "Sunday",
  midweekDateLabel = "Midweek",
  midweekEnabled = true,
  period = "all",
  scope = "matchweek",
  homeNation = inferGrantHomeNation(club),
  projectType = "all",
  availability = "current",
} = {}) {
  const savedEntries = normaliseSavedHistory(history);
  const selectedSavedEntries = filterEntries(savedEntries, period);
  const currentEntry = createCurrentMatchweekEntry({
    satFinal,
    sunFinal,
    midweekFinal,
    satUnresolved,
    sunUnresolved,
    midweekUnresolved,
    satHasRun,
    sunHasRun,
    midweekHasRun,
    satDate,
    sunDate,
    midweekDate,
    satDateLabel,
    sunDateLabel,
    midweekDateLabel,
    midweekEnabled,
  });
  const currentEvidence = buildOperationalEvidence({
    entries: [currentEntry],
    scope,
    club,
    pitchCfg,
    teamCfg,
  });
  const useCurrent = selectedSavedEntries.length === 0 && currentEvidence.rows.length > 0;
  const evidenceEntries = useCurrent ? [currentEntry] : selectedSavedEntries;
  const operational = buildOperationalEvidence({
    entries: evidenceEntries,
    scope,
    club,
    pitchCfg,
    teamCfg,
  });
  const deliveredRows = operational.delivered;
  const postponedRows = operational.postponed;
  const totalRecordedFixtures = operational.outcomes.length;
  const deliveredFixtures = deliveredRows.length;
  const postponedFixtures = postponedRows.length;
  const postponementRate = totalRecordedFixtures
    ? Math.round((postponedFixtures / totalRecordedFixtures) * 100)
    : 0;
  const deliveryRate = operational.summary.deliveryRate || 0;
  const youthFixtures = deliveredRows.filter(isYouthRow).length;
  const femaleFixtures = deliveredRows.filter(isFemaleRow).length;
  const teamOpportunitySlots = deliveredFixtures * 2;
  const facilityHours = operational.summary.facilityHours || 0;
  const pitchesUsed = operational.pitchStats.filter((item) => item.total > 0).length;
  const busiestPitch = operational.summary.busiestPitch;
  const busiestPitchShare = deliveredFixtures && busiestPitch
    ? Math.round((busiestPitch.total / deliveredFixtures) * 100)
    : 0;
  const confirmedOfficials = operational.summary.officialConfirmed || 0;
  const officialCoverage = operational.summary.officialCoverage || 0;
  const parkingWeeks = operational.weekly.map((week) => ({
    ...week,
    utilisation: parkingUtilisation(week),
  }));
  const parkingPressureWeeks = parkingWeeks.filter((week) => week.utilisation >= 85).length;
  const parkingOverCapacityWeeks = parkingWeeks.filter((week) => week.parkingOver).length;
  const seasonParkingPeak = parkingWeeks.reduce(
    (peak, week) => (week.utilisation > Number(peak?.utilisation || 0) ? week : peak),
    null
  );
  const currentWeek = currentEvidence.weekly[0];
  const currentFixtures = currentEvidence.delivered.length;
  const currentOfficials = currentEvidence.summary.officialConfirmed || 0;
  const currentParkingUtilisation = parkingUtilisation(currentWeek);

  const quality = buildEvidenceQuality({
    evidence: operational,
    entries: evidenceEntries,
    club,
    pitchCfg,
    teamCfg,
    refs,
  });

  const metrics = {
    deliveredFixtures,
    scheduledFixtures: deliveredFixtures,
    postponedFixtures,
    postponementRate,
    postponementLabel: rateLabel(postponementRate),
    youthFixtures,
    femaleFixtures,
    teamOpportunitySlots,
    facilityHours,
    pitchesUsed,
    pitchesConfigured: asArray(pitchCfg).length,
    teamsConfigured: asArray(teamCfg).length,
    busiestPitch: busiestPitch?.label || "No pitch data",
    busiestPitchFixtures: busiestPitch?.total || 0,
    busiestPitchShare,
    officialCoverage,
    confirmedOfficials,
    parkingPressureWeeks,
    parkingOverCapacityWeeks,
    seasonParkingPeak: seasonParkingPeak?.utilisation || 0,
  };

  const framework = buildGrantEvidenceFramework({
    club,
    evidence: operational,
    quality,
    pitchCfg,
    teamCfg,
    refs,
    metrics,
  });
  const funding = buildGrantFundingModel({
    club,
    quality,
    framework,
    homeNation,
    projectType,
    availability,
  });

  const facilitiesScore = clamp(
    100
      - parkingOverCapacityWeeks * 12
      - parkingPressureWeeks * 4
      - Math.max(0, busiestPitchShare - 35)
      - asArray(closedPitches).length * 8
  );
  const workforceScore = deliveredFixtures ? clamp(officialCoverage) : asArray(refs).length ? 50 : 0;
  const deliveryScore = totalRecordedFixtures ? clamp(deliveryRate) : 0;
  const participationScore = deliveredFixtures
    ? clamp(Math.min(100, deliveredFixtures * 2 + Math.min(30, asArray(teamCfg).length * 2)))
    : 0;
  const overallHealth = clamp(
    quality.score * 0.3 + deliveryScore * 0.25 + facilitiesScore * 0.25 + workforceScore * 0.2
  );

  const priorities = [];
  if (parkingOverCapacityWeeks > 0) {
    priorities.push(buildPriority({
      id: "parking-capacity",
      title: "Matchday access and parking capacity",
      detail: "Recorded demand is exceeding the configured operating capacity of the site.",
      evidence: `${parkingOverCapacityWeeks} selected matchday${parkingOverCapacityWeeks === 1 ? "" : "s"} over capacity; peak use ${seasonParkingPeak?.utilisation || 0}%.`,
      severity: "high",
      grantAngle: "Potential evidence for site access, overflow parking, traffic management or safer arrival infrastructure.",
    }));
  } else if (parkingPressureWeeks > 0) {
    priorities.push(buildPriority({
      id: "parking-pressure",
      title: "Protect matchday access capacity",
      detail: "The site is operating close to its configured parking limit.",
      evidence: `${parkingPressureWeeks} selected matchday${parkingPressureWeeks === 1 ? "" : "s"} at 85% capacity or above.`,
      severity: "medium",
      grantAngle: "Potential evidence for arrival management, signage, stewarding equipment or sustainable travel support.",
    }));
  }
  if (postponementRate >= 10) {
    priorities.push(buildPriority({
      id: "surface-resilience",
      title: "Playing-surface resilience",
      detail: "Recorded postponements are reducing reliable access to football activity.",
      evidence: `${postponedFixtures} of ${totalRecordedFixtures} recorded outcomes postponed (${postponementRate}%).`,
      severity: postponementRate >= 20 ? "high" : "medium",
      grantAngle: "Potential evidence for drainage, maintenance equipment, surface improvement or all-weather provision.",
    }));
  }
  if (busiestPitchShare >= 40 && deliveredFixtures >= 5) {
    priorities.push(buildPriority({
      id: "pitch-concentration",
      title: "Reduce pressure on the busiest pitch",
      detail: "A large share of selected activity is concentrated on one playing area.",
      evidence: `${busiestPitch?.label || "The busiest pitch"} hosted ${busiestPitch?.total || 0} fixtures (${busiestPitchShare}% of scheduled activity).`,
      severity: "medium",
      grantAngle: "Potential evidence for additional playable space, pitch renovation, lighting or surface conversion.",
    }));
  }
  if (deliveredFixtures > 0 && officialCoverage < 90) {
    priorities.push(buildPriority({
      id: "officials-workforce",
      title: "Officials and volunteer workforce",
      detail: "The scheduled fixture record contains gaps in confirmed matchday staffing.",
      evidence: `${confirmedOfficials} of ${deliveredFixtures} scheduled fixtures have confirmed officials (${officialCoverage}%).`,
      severity: officialCoverage < 65 ? "high" : "medium",
      grantAngle: "Potential evidence for recruitment, training, accreditation, equipment or volunteer retention.",
    }));
  }
  if (evidenceEntries.length < 4) {
    priorities.push(buildPriority({
      id: "evidence-depth",
      title: "Build the evidence baseline",
      detail: "More saved matchdays are needed before short-term pressure can be presented as a sustained trend.",
      evidence: `${evidenceEntries.length} selected matchday${evidenceEntries.length === 1 ? "" : "s"} currently available.`,
      severity: "development",
      grantAngle: "Build a reproducible baseline covering scheduled demand, facility pressure and verified outcomes.",
    }));
  }
  if (!priorities.length) {
    priorities.push(buildPriority({
      id: "capacity-protection",
      title: "Protect scheduled capacity",
      detail: "Selected operations are stable; the evidence supports preventative planning rather than an urgent deficit case.",
      evidence: `${deliveryRate}% of recorded fixtures remained scheduled rather than postponed or cancelled across ${evidenceEntries.length} selected matchday${evidenceEntries.length === 1 ? "" : "s"}.`,
      severity: "positive",
      grantAngle: "Potential evidence for preventative maintenance, equipment renewal or planned capacity growth.",
    }));
  }

  const narrative = deliveredFixtures
    ? `${club?.name || "The club"} recorded ${deliveredFixtures} fixture${deliveredFixtures === 1 ? "" : "s"} scheduled to proceed across ${evidenceEntries.length} selected matchday${evidenceEntries.length === 1 ? "" : "s"}. This represents ${teamOpportunitySlots} team fixture opportunities and approximately ${facilityHours} scheduled pitch hours, not confirmed attendance or completed participation. ${postponedFixtures ? `${postponedFixtures} postponement${postponedFixtures === 1 ? " was" : "s were"} recorded.` : "No postponements were recorded in the selection."} Team categories are inferred from names and must be verified before external use.`
    : `${club?.name || "The club"} has not yet built a sufficient operational evidence base for the selected period. Save matchweeks and record actual outcomes before using Ground Control figures in an external application.`;

  const themes = [
    {
      id: "participation",
      label: "Participation",
      score: participationScore,
      tone: getTone(participationScore),
      headline: `${deliveredFixtures} fixtures scheduled`,
      detail: `${teamOpportunitySlots} calculated team fixture opportunities; attendance and player reach are not evidenced.`,
    },
    {
      id: "facilities",
      label: "Facilities",
      score: facilitiesScore,
      tone: getTone(facilitiesScore),
      headline: `${facilityHours} scheduled pitch hours`,
      detail: `${pitchesUsed}/${asArray(pitchCfg).length || pitchesUsed || 0} configured pitches represented in the selection.`,
    },
    {
      id: "resilience",
      label: "Resilience",
      score: deliveryScore,
      tone: getTone(deliveryScore),
      headline: `${deliveryRate}% remained scheduled`,
      detail: `${postponedFixtures} postponement${postponedFixtures === 1 ? "" : "s"} recorded.`,
    },
    {
      id: "workforce",
      label: "Workforce",
      score: workforceScore,
      tone: getTone(workforceScore),
      headline: `${confirmedOfficials}/${deliveredFixtures} scheduled fixtures covered`,
      detail: "Based on appointment status stored with selected fixtures.",
    },
  ];

  return {
    filters: {
      periodOptions: makePeriodOptions(savedEntries),
      selectedPeriod: period,
      selectedScope: scope,
    },
    health: {
      score: overallHealth,
      tone: getTone(overallHealth),
      label: overallHealth >= 80 ? "Strong operating position" : overallHealth >= 60 ? "Developing evidence" : "Action and evidence needed",
    },
    evidence: {
      score: quality.score,
      tone: quality.tone,
      label: evidenceLabel(quality.score),
      recordedWeeks: evidenceEntries.length,
      isUsingCurrentWeekend: useCurrent,
    },
    current: {
      fixtures: currentFixtures,
      postponed: currentEvidence.postponed.length,
      officialsConfirmed: currentOfficials,
      officialCoverage: currentEvidence.summary.officialCoverage || 0,
      parkingUtilisation: currentParkingUtilisation,
      parkingPeak: currentWeek?.peakParkingLabel || currentWeek?.fullLabel || "Pending",
    },
    metrics,
    themes,
    priorities: priorities.slice(0, 4),
    narrative,
    quality,
    framework,
    funding,
    sourceRows: operational.rows,
  };
}

export default buildGrantImpactModel;
