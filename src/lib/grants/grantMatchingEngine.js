import {
  GRANT_HOME_NATIONS,
  GRANT_PROJECT_TYPES,
  VERIFIED_GRANT_PROGRAMMES,
  getProjectTypeDefinition,
} from "./grantProgrammeCatalogue.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function inferGrantHomeNation(club = {}) {
  const explicit = String(club.homeNation || club.nation || club.country || "").toLowerCase();
  if (explicit.includes("scot")) return "scotland";
  if (explicit.includes("wale") || explicit.includes("cymru")) return "wales";
  if (explicit.includes("northern") || explicit === "ni") return "northern-ireland";
  if (explicit.includes("eng")) return "england";

  const postcode = String(club.postcode || club.weatherPostcode || "").trim().toUpperCase();
  if (/^BT/.test(postcode)) return "northern-ireland";
  if (/^(AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|TD|ZE)/.test(postcode)) return "scotland";
  if (/^(CF|LD|LL|NP|SA|SY)/.test(postcode)) return "wales";
  return "england";
}

export function resolveProgrammeStatus(programme, today = new Date()) {
  const opening = parseDate(programme.openDate);
  const deadline = parseDate(programme.deadline);

  if (opening && opening.getTime() > today.getTime()) {
    return {
      key: "upcoming",
      label: `Opens ${formatDate(programme.openDate)}`,
      tone: "info",
      isCurrent: true,
    };
  }

  if (deadline && deadline.getTime() < today.getTime()) {
    return {
      key: "closed",
      label: `Closed ${formatDate(programme.deadline)}`,
      tone: "neutral",
      isCurrent: false,
    };
  }

  if (programme.status === "open") {
    return {
      key: "open",
      label: deadline ? `Open until ${formatDate(programme.deadline)}` : "Open",
      tone: "success",
      isCurrent: true,
    };
  }
  if (programme.status === "rolling") {
    return { key: "rolling", label: "Open year-round", tone: "success", isCurrent: true };
  }
  if (programme.status === "upcoming") {
    return {
      key: "open",
      label: deadline ? `Open until ${formatDate(programme.deadline)}` : "Open",
      tone: "success",
      isCurrent: true,
    };
  }
  if (programme.status === "development") {
    return { key: "development", label: "Development route", tone: "info", isCurrent: true };
  }
  if (programme.status === "monitor") {
    return { key: "monitor", label: "Monitor for guidance", tone: "warning", isCurrent: true };
  }
  return { key: "closed", label: "Closed", tone: "neutral", isCurrent: false };
}

function verificationDetails(programme, today) {
  const verified = parseDate(programme.lastVerified);
  if (!verified) {
    return { daysOld: null, label: "Verification date missing", tone: "danger", stale: true };
  }
  const daysOld = Math.max(0, Math.floor((today.getTime() - verified.getTime()) / 86400000));
  if (daysOld > 45) return { daysOld, label: `Re-check required (${daysOld} days old)`, tone: "danger", stale: true };
  if (daysOld > 21) return { daysOld, label: `Review soon (${daysOld} days old)`, tone: "warning", stale: false };
  return { daysOld, label: daysOld === 0 ? "Verified today" : `Verified ${daysOld} days ago`, tone: "success", stale: false };
}

function frameworkValue(status) {
  return { available: 100, partial: 50, missing: 0, manual: 0 }[status] ?? 0;
}

function buildOperationalProjectScore(project, quality, framework) {
  const requirements = project.evidenceRequirementIds
    .map((id) => framework.requirements.find((item) => item.id === id))
    .filter(Boolean);
  const measures = project.qualityMeasureIds
    .map((id) => quality.measures.find((item) => item.id === id))
    .filter(Boolean);

  const requirementScore = requirements.length
    ? requirements.reduce((total, item) => total + frameworkValue(item.status), 0) / requirements.length
    : 0;
  const measureScore = measures.length
    ? measures.reduce((total, item) => total + Number(item.value || 0), 0) / measures.length
    : 0;

  return clamp(requirementScore * 0.6 + measureScore * 0.4);
}

function buildProgrammeMatch(programme, project, quality, framework, today) {
  const status = resolveProgrammeStatus(programme, today);
  const projectMatch = project.value === "all" || programme.projectTypes.includes(project.value);
  const requirements = asArray(programme.evidenceRequirementIds)
    .map((id) => framework.requirements.find((item) => item.id === id))
    .filter(Boolean);
  const evidenceScore = requirements.length
    ? clamp(requirements.reduce((total, item) => total + frameworkValue(item.status), 0) / requirements.length)
    : 0;
  const missingRequirements = requirements.filter((item) => item.status !== "available");
  const score = clamp(
    (projectMatch ? 55 : 15) +
      (status.isCurrent ? 15 : 0) +
      evidenceScore * 0.3
  );

  return {
    ...programme,
    resolvedStatus: status,
    verification: verificationDetails(programme, today),
    projectMatch,
    matchScore: score,
    matchLabel: score >= 80 ? "Strong relevance" : score >= 60 ? "Potential fit" : "Broader opportunity",
    evidenceScore,
    evidenceReady: requirements.filter((item) => item.status === "available").length,
    evidenceTotal: requirements.length,
    evidenceGaps: missingRequirements.map((item) => ({ id: item.id, title: item.title, status: item.status, nextAction: item.nextAction })),
  };
}

export function buildGrantFundingModel({
  club = {},
  quality = {},
  framework = { requirements: [] },
  homeNation = inferGrantHomeNation(club),
  projectType = "all",
  availability = "current",
  today = new Date(),
} = {}) {
  const nation = GRANT_HOME_NATIONS.some((item) => item.value === homeNation) ? homeNation : "england";
  const project = getProjectTypeDefinition(projectType);
  const allNationProgrammes = VERIFIED_GRANT_PROGRAMMES
    .filter((programme) => programme.nations.includes(nation))
    .map((programme) => buildProgrammeMatch(programme, project, quality, framework, today));

  const matching = allNationProgrammes
    .filter((programme) => project.value === "all" || programme.projectTypes.includes(project.value))
    .filter((programme) => availability === "all" || programme.resolvedStatus.isCurrent)
    .sort((a, b) => b.matchScore - a.matchScore || a.funder.localeCompare(b.funder));

  const current = allNationProgrammes.filter((programme) => programme.resolvedStatus.isCurrent);
  const stale = allNationProgrammes.filter((programme) => programme.verification.stale);
  const latestVerified = allNationProgrammes
    .map((programme) => parseDate(programme.lastVerified))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
  const operationalEvidenceScore = buildOperationalProjectScore(project, quality, framework);
  const manualRequirements = [...new Set(matching.flatMap((programme) => asArray(programme.manualRequirements)))];

  return {
    filters: {
      homeNations: GRANT_HOME_NATIONS,
      projectTypes: GRANT_PROJECT_TYPES,
      selectedHomeNation: nation,
      selectedProjectType: project.value,
      availability,
    },
    project,
    coverage: {
      verifiedProgrammes: VERIFIED_GRANT_PROGRAMMES.length,
      nationProgrammes: allNationProgrammes.length,
      currentNationProgrammes: current.length,
      matchingProgrammes: matching.length,
      staleProgrammes: stale.length,
      lastVerified: latestVerified
        ? latestVerified.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        : "Not verified",
      scope: "Verified national and UK-wide programmes. County FA, local-authority, charitable-trust and postcode-restricted local schemes require a separate discovery layer and are not yet claimed as complete.",
    },
    readiness: [
      {
        id: "operational",
        label: "Operational evidence",
        value: operationalEvidenceScore,
        display: `${operationalEvidenceScore}%`,
        status: operationalEvidenceScore >= 80 ? "success" : operationalEvidenceScore >= 55 ? "warning" : "danger",
        detail: `Measured against the evidence relevant to ${project.label.toLowerCase()}.`,
      },
      {
        id: "eligibility",
        label: "Organisation eligibility",
        value: null,
        display: "Needs input",
        status: "info",
        detail: "Legal form, affiliation, turnover, tenure and accreditation are not yet stored in the club profile.",
      },
      {
        id: "documents",
        label: "Documents",
        value: null,
        display: "Not tracked",
        status: "info",
        detail: `${manualRequirements.length} distinct manual evidence items appear across the current matches.`,
      },
      {
        id: "project-case",
        label: "Project case",
        value: project.value === "all" ? null : 25,
        display: project.value === "all" ? "Choose focus" : "Early stage",
        status: "warning",
        detail: project.value === "all"
          ? "Choose a funding area to build a project-specific readiness assessment."
          : "A project focus is selected, but budget, beneficiaries, outcomes and delivery milestones are not yet recorded.",
      },
    ],
    programmes: matching,
    disclaimer: "Programme status and criteria can change. Ground Control must re-verify the official guidance before a club relies on an opportunity or submits an application. Matching indicates relevance, not eligibility or likelihood of award.",
  };
}

export default buildGrantFundingModel;
