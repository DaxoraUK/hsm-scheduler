function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function statusFor(value, strong = 80, partial = 35) {
  if (value >= strong) return "available";
  if (value >= partial) return "partial";
  return "missing";
}

function requirement({ id, category, title, status, source, evidence, nextAction }) {
  return { id, category, title, status, source, evidence, nextAction };
}

export function buildGrantEvidenceFramework({
  club = {},
  evidence = {},
  quality = {},
  pitchCfg = [],
  teamCfg = [],
  refs = [],
  metrics = {},
} = {}) {
  const summary = evidence.summary || {};
  const entries = asArray(evidence.entries);
  const delivered = Number(metrics.deliveredFixtures ?? summary.delivered ?? 0);
  const postponed = Number(metrics.postponedFixtures ?? summary.postponed ?? 0);
  const facilityHours = Number(metrics.facilityHours ?? summary.facilityHours ?? 0);
  const youthFixtures = Number(metrics.youthFixtures ?? 0);
  const femaleFixtures = Number(metrics.femaleFixtures ?? 0);
  const parkingPressure = Number(metrics.parkingPressureWeeks ?? summary.parkingOverCapacity ?? 0);
  const officialCoverage = Number(metrics.officialCoverage ?? summary.officialCoverage ?? 0);
  const identityScore = club?.name ? (club?.venue || club?.postcode || asArray(club?.sites).length ? 100 : 60) : 0;
  const demandScore = Math.min(100, entries.length * 12.5 + Math.min(50, delivered * 2));
  const facilityScore = asArray(pitchCfg).length && facilityHours ? 100 : asArray(pitchCfg).length || facilityHours ? 55 : 0;
  const resilienceScore = entries.length && (postponed > 0 || summary.deliveryRate != null) ? 100 : entries.length ? 55 : 0;
  const participationScore = delivered ? (asArray(teamCfg).length ? 75 : 50) : 0;
  const inclusionScore = youthFixtures || femaleFixtures ? 45 : 0;
  const accessScore = summary.parkingConfigured || parkingPressure ? 75 : 0;
  const workforceScore = delivered ? officialCoverage : asArray(refs).length ? 40 : 0;
  const monitoringScore = entries.length >= 8 ? 100 : entries.length >= 4 ? 65 : entries.length ? 35 : 0;

  const requirements = [
    requirement({
      id: "organisation-identity",
      category: "Organisation",
      title: "Club identity and facility location",
      status: statusFor(identityScore),
      source: "configured",
      evidence: club?.name
        ? `${club.name}${club?.venue ? ` · ${club.venue}` : club?.postcode ? ` · ${club.postcode}` : ""}`
        : "No complete club identity is configured.",
      nextAction: identityScore >= 80 ? "Keep organisation and venue details current." : "Complete the club profile, primary venue and postcode.",
    }),
    requirement({
      id: "sustained-demand",
      category: "Need and demand",
      title: "Sustained operational demand",
      status: statusFor(demandScore),
      source: "recorded",
      evidence: `${delivered} delivered fixture${delivered === 1 ? "" : "s"} across ${entries.length} selected matchday${entries.length === 1 ? "" : "s"}.`,
      nextAction: demandScore >= 80 ? "Use the source appendix to evidence the trend." : "Save more completed matchdays before presenting demand as a sustained pattern.",
    }),
    requirement({
      id: "facility-use",
      category: "Facilities",
      title: "Facility use and capacity pressure",
      status: statusFor(facilityScore),
      source: "calculated",
      evidence: `${facilityHours} recorded facility hours across ${asArray(pitchCfg).length} configured pitch${asArray(pitchCfg).length === 1 ? "" : "es"}.`,
      nextAction: facilityScore >= 80 ? "Add maintenance, availability and project-specific capacity evidence." : "Complete pitch configuration and retain fixture allocations.",
    }),
    requirement({
      id: "reliability-resilience",
      category: "Facilities",
      title: "Reliability and surface resilience",
      status: statusFor(resilienceScore),
      source: "recorded",
      evidence: `${postponed} postponement${postponed === 1 ? "" : "s"}; ${summary.deliveryRate || 0}% recorded delivery rate.`,
      nextAction: "Record postponement reasons and maintenance closures so the cause of lost activity can be demonstrated.",
    }),
    requirement({
      id: "participation-opportunity",
      category: "Participation",
      title: "Participation opportunities",
      status: statusFor(participationScore),
      source: "calculated",
      evidence: `${delivered * 2} team participation opportunities inferred from ${delivered} delivered fixtures.`,
      nextAction: "Add registered-player and attendance figures before making claims about individual beneficiaries.",
    }),
    requirement({
      id: "inclusion-reach",
      category: "Participation",
      title: "Youth, women and girls, disability or inclusion reach",
      status: inclusionScore ? "partial" : "missing",
      source: "inferred",
      evidence: `${youthFixtures} youth fixture${youthFixtures === 1 ? "" : "s"}; ${femaleFixtures} girls' or women's fixture${femaleFixtures === 1 ? "" : "s"}, inferred from team names.`,
      nextAction: "Capture explicit team categories and beneficiary data; do not rely on naming inference in a final application.",
    }),
    requirement({
      id: "site-access",
      category: "Access and safety",
      title: "Parking, arrivals and safe site access",
      status: statusFor(accessScore, 70, 30),
      source: "calculated",
      evidence: `${parkingPressure} selected matchday${parkingPressure === 1 ? "" : "s"} with recorded parking pressure.`,
      nextAction: "Retain capacity assumptions and add traffic, neighbour, accessibility or travel-plan evidence where relevant.",
    }),
    requirement({
      id: "workforce",
      category: "Workforce",
      title: "Officials and volunteer delivery capacity",
      status: statusFor(workforceScore, 85, 35),
      source: "recorded",
      evidence: `${officialCoverage}% confirmed-official coverage across delivered fixtures.`,
      nextAction: "Add volunteer numbers, qualifications, training needs and retention evidence for workforce funding.",
    }),
    requirement({
      id: "monitoring-baseline",
      category: "Monitoring",
      title: "Baseline and future outcome monitoring",
      status: statusFor(monitoringScore),
      source: "recorded",
      evidence: `${entries.length} matchday${entries.length === 1 ? "" : "s"} available for a baseline; evidence confidence ${quality.score || 0}%.`,
      nextAction: "Create a dated baseline snapshot before investment and compare the same measures after delivery.",
    }),
    requirement({
      id: "governance-documents",
      category: "Governance",
      title: "Constitution, safeguarding, equality and insurance",
      status: "manual",
      source: "manual",
      evidence: "Not generated from fixture operations.",
      nextAction: "Upload or link current governance documents and record review dates.",
    }),
    requirement({
      id: "financial-documents",
      category: "Finance",
      title: "Accounts, bank evidence, budget and quotations",
      status: "manual",
      source: "manual",
      evidence: "Not generated from fixture operations.",
      nextAction: "Prepare current accounts, project budget, matched funding evidence and supplier quotations.",
    }),
    requirement({
      id: "project-case",
      category: "Project",
      title: "Project plan, consultation and intended outcomes",
      status: "manual",
      source: "manual",
      evidence: "Operational data can support the need, but the project case requires manual evidence.",
      nextAction: "Define the project, beneficiaries, costs, delivery milestones, risks and measurable outcomes.",
    }),
  ];

  const counts = requirements.reduce(
    (result, item) => ({ ...result, [item.status]: (result[item.status] || 0) + 1 }),
    { available: 0, partial: 0, missing: 0, manual: 0 }
  );
  const operational = requirements.filter((item) => item.status !== "manual");
  const score = operational.length
    ? Math.round(operational.reduce((total, item) => total + ({ available: 100, partial: 50, missing: 0 }[item.status] || 0), 0) / operational.length)
    : 0;

  return {
    score,
    label: score >= 80 ? "Strong operational evidence" : score >= 55 ? "Evidence developing" : "Evidence gaps remain",
    tone: score >= 80 ? "success" : score >= 55 ? "warning" : "danger",
    counts,
    requirements,
    disclaimer: "This matrix organises evidence commonly requested in funding applications. It is not a funder-specific eligibility assessment. Scheme requirements must be checked against the current guidance before an application is submitted.",
  };
}

export default buildGrantEvidenceFramework;
