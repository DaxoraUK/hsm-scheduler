function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function coverage(rows, predicate) {
  if (!rows.length) return 0;
  return clamp((rows.filter(predicate).length / rows.length) * 100);
}

function hasMeaningfulDate(row = {}) {
  return Boolean(row.date || (row.dateLabel && !/^(matchday|saved matchday)$/i.test(String(row.dateLabel))));
}

function hasMeaningfulTeam(row = {}) {
  const home = String(row.homeTeam || "").trim();
  const away = String(row.awayTeam || "").trim();
  return Boolean(home && !/^home team$/i.test(home) && away && !/^(opposition tbc|tbc)$/i.test(away));
}

function hasFormat(row = {}) {
  return Boolean(row.format && String(row.format).toLowerCase() !== "unspecified");
}

function hasAllocation(row = {}) {
  if (row.status !== "delivered") return true;
  return Boolean(row.pitchId && row.koMins != null);
}

function hasOfficialRecord(row = {}) {
  if (row.status !== "delivered") return true;
  const referee = String(row.referee || "").trim().toLowerCase();
  const status = String(row.officialStatus || "").trim().toLowerCase();
  const missingValues = new Set(["", "tbc", "unconfirmed", "unassigned", "missing", "none"]);
  return !missingValues.has(referee) || !missingValues.has(status);
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function periodDetails(entries = []) {
  const dated = entries
    .map((entry) => entry?.date)
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (!dated.length) {
    return {
      from: "",
      to: "",
      label: entries.length === 1 ? "1 selected matchday" : `${entries.length} selected matchdays`,
    };
  }

  const from = dated[0];
  const to = dated.at(-1);
  return {
    from: formatDate(from),
    to: formatDate(to),
    label: from.getTime() === to.getTime() ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`,
  };
}

function toneForScore(score, matchdays = 0) {
  if (matchdays < 3) return "warning";
  if (score >= 85) return "success";
  if (score >= 65) return "warning";
  return "danger";
}

function labelForScore(score, matchdays = 0) {
  if (matchdays < 3) return "Early data";
  if (score >= 85) return "High confidence";
  if (score >= 65) return "Usable with gaps";
  if (score >= 40) return "Developing evidence";
  return "Limited evidence";
}

function confidenceCapForMatchdays(matchdays = 0) {
  if (matchdays <= 0) return 0;
  if (matchdays === 1) return 60;
  if (matchdays === 2) return 70;
  if (matchdays < 5) return 80;
  if (matchdays < 8) return 90;
  return 100;
}

export function buildEvidenceQuality({
  evidence = {},
  entries = [],
  club = {},
  pitchCfg = [],
  teamCfg = [],
  refs = [],
} = {}) {
  const rows = asArray(evidence.rows);
  const delivered = rows.filter((row) => row.status === "delivered");
  const weekly = asArray(evidence.weekly);
  const dayParking = weekly.flatMap((week) => asArray(week.dayParking));
  const assessedParking = dayParking.filter((item) => item?.hasRun);

  const measures = [
    {
      id: "history-depth",
      label: "History depth",
      value: clamp((asArray(entries).length / 8) * 100),
      detail: `${asArray(entries).length} saved matchday${asArray(entries).length === 1 ? "" : "s"}; eight gives a useful early trend base.`,
      source: "recorded",
      relevance: "core",
      weight: 15,
    },
    {
      id: "fixture-identity",
      label: "Fixture identity",
      value: coverage(rows, (row) => hasMeaningfulDate(row) && hasMeaningfulTeam(row)),
      detail: "Dates, home teams and opposition names recorded.",
      source: "recorded",
      relevance: "core",
      weight: 15,
    },
    {
      id: "format-coverage",
      label: "Format coverage",
      value: coverage(rows, hasFormat),
      detail: "Playing format available for capacity and facility analysis.",
      source: "recorded",
      relevance: "core",
      weight: 10,
    },
    {
      id: "allocation-coverage",
      label: "Allocation coverage",
      value: coverage(rows, hasAllocation),
      detail: "Scheduled fixtures have both a pitch and kick-off time.",
      source: "recorded",
      relevance: "core",
      weight: 20,
    },
    {
      id: "officials-coverage",
      label: "Officials evidence",
      value: coverage(delivered, hasOfficialRecord),
      detail: "An official or an explicit appointment status is recorded.",
      source: "recorded",
      relevance: "core",
      weight: 15,
    },
    {
      id: "parking-coverage",
      label: "Parking evidence",
      value: assessedParking.length
        ? coverage(assessedParking, (item) => item?.snapshot?.enabled === false || item?.snapshot?.configured)
        : 0,
      detail: "Matchday parking snapshots use a configured capacity or an explicit disabled state.",
      source: "calculated",
      relevance: "contextual",
      weight: 0,
    },
    {
      id: "weather-coverage",
      label: "Weather evidence",
      value: Number(evidence.summary?.weatherCoverage || 0),
      detail: "Historical conditions are included only when saved with the fixture record.",
      source: "recorded",
      relevance: "contextual",
      weight: 0,
    },
  ];

  const coreMeasures = measures.filter((item) => item.relevance === "core");
  const contextualMeasures = measures.filter((item) => item.relevance === "contextual");
  const weighted = coreMeasures.reduce((total, item) => total + item.value * item.weight, 0);
  const totalWeight = coreMeasures.reduce((total, item) => total + item.weight, 0);
  const matchdayCount = asArray(entries).length;
  const completenessScore = clamp(totalWeight ? weighted / totalWeight : 0);
  const score = Math.min(completenessScore, confidenceCapForMatchdays(matchdayCount));
  const gaps = [];

  measures.forEach((item) => {
    if (item.value >= 85) return;
    const action = {
      "history-depth": "Save completed matchdays consistently to create a stronger trend baseline.",
      "fixture-identity": "Complete fixture dates, team names and opposition details before using the data externally.",
      "format-coverage": "Assign a playing format to fixtures and teams so facility demand is comparable.",
      "allocation-coverage": "Resolve missing pitch and kick-off allocations before publishing evidence.",
      "officials-coverage": "Record an official or an explicit appointment status for every scheduled fixture.",
      "parking-coverage": "Configure parking capacity or explicitly disable parking analysis for the venue.",
      "weather-coverage": "Capture weather snapshots when matchdays are saved; never backfill historic forecasts from current data.",
    }[item.id];
    gaps.push({
      id: item.id,
      label: item.label,
      value: item.value,
      severity: item.value < 40 ? "high" : "medium",
      action,
    });
  });

  const identityConfigured = Boolean(club?.name);
  const venueConfigured = Boolean(club?.venue || club?.postcode || asArray(club?.sites).length);

  return {
    score,
    completenessScore,
    confidenceCap: confidenceCapForMatchdays(matchdayCount),
    isEarlyData: matchdayCount < 3,
    tone: toneForScore(score, matchdayCount),
    label: labelForScore(score, matchdayCount),
    period: periodDetails(asArray(entries)),
    matchdays: asArray(entries).length,
    fixtures: rows.length,
    measures,
    coreMeasures,
    contextualMeasures,
    gaps: gaps.sort((a, b) => a.value - b.value),
    provenance: [
      {
        id: "recorded",
        label: "Recorded",
        status: rows.length ? "available" : "missing",
        detail: `${rows.length} fixture record${rows.length === 1 ? "" : "s"} from saved or current Ground Control data.`,
      },
      {
        id: "configured",
        label: "Configured",
        status: identityConfigured && venueConfigured && asArray(pitchCfg).length ? "available" : "partial",
        detail: `${identityConfigured ? "Club identity" : "Club identity missing"}; ${venueConfigured ? "venue details" : "venue details missing"}; ${asArray(pitchCfg).length} pitch${asArray(pitchCfg).length === 1 ? "" : "es"}, ${asArray(teamCfg).length} team${asArray(teamCfg).length === 1 ? "" : "s"} and ${asArray(refs).length} official${asArray(refs).length === 1 ? "" : "s"} configured.`,
      },
      {
        id: "calculated",
        label: "Calculated",
        status: rows.length ? "available" : "missing",
        detail: "Rates, facility hours and parking pressure are calculated from recorded fixtures and configured assumptions.",
      },
      {
        id: "manual",
        label: "Manual evidence",
        status: "required",
        detail: "Governance documents, finances, quotations, consultation and project plans must be supplied separately.",
      },
    ],
    methodology: "Evidence confidence measures core record completeness and is deliberately capped while only a small number of matchdays are available. Fixture identity, formats, allocations and officials are included; parking and weather are shown separately because their relevance depends on the project or report. It is not a funding eligibility score.",
  };
}

export default buildEvidenceQuality;
