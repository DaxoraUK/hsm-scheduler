function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "Not recorded") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isoDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanFilenamePart(value) {
  return String(value || "ground-control")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "ground-control";
}

function requirementRecord(item = {}) {
  return {
    id: safeText(item.id, "requirement"),
    category: safeText(item.category, "Evidence"),
    title: safeText(item.title),
    status: safeText(item.status, "missing"),
    source: safeText(item.source),
    currentEvidence: safeText(item.currentEvidence || item.evidence),
    nextAction: safeText(item.nextAction),
  };
}

function programmeRecord(programme = {}) {
  return {
    id: safeText(programme.id, "programme"),
    funder: safeText(programme.funder),
    name: safeText(programme.name),
    status: safeText(programme.resolvedStatus?.label || programme.status),
    amount: safeText(programme.amountLabel),
    deadline: programme.deadline || null,
    matchFunding: safeText(programme.matchFunding),
    summary: safeText(programme.summary),
    eligibilityNotes: asArray(programme.eligibilityNotes),
    manualRequirements: asArray(programme.manualRequirements),
    evidenceGaps: asArray(programme.evidenceGaps),
    officialUrl: safeText(programme.officialUrl),
    lastVerified: programme.lastVerified || null,
    verificationStatus: safeText(programme.verification?.label),
    matchLabel: safeText(programme.matchLabel),
    matchScore: safeNumber(programme.matchScore),
  };
}

function provenanceRecord(item = {}) {
  return {
    id: safeText(item.id, "evidence"),
    label: safeText(item.label),
    status: safeText(item.status),
    detail: safeText(item.detail),
  };
}

export function buildFundingEvidencePack({ club = {}, model = {}, source = "analytics" } = {}) {
  const metrics = model.metrics || {};
  const evidenceSummary = model.evidence?.summary || {};
  const scheduledFixtures = safeNumber(metrics.scheduledFixtures ?? metrics.deliveredFixtures ?? evidenceSummary.scheduled ?? evidenceSummary.delivered);
  const postponedFixtures = safeNumber(metrics.postponedFixtures ?? evidenceSummary.postponed);
  const cancelledFixtures = safeNumber(evidenceSummary.cancelled);
  const teamOpportunitySlots = safeNumber(metrics.teamOpportunitySlots || scheduledFixtures * 2);
  const facilityHours = safeNumber(metrics.facilityHours ?? evidenceSummary.facilityHours);
  const officialCoverage = safeNumber(metrics.officialCoverage ?? evidenceSummary.officialCoverage);
  const sourceRows = asArray(model.sourceRows?.length ? model.sourceRows : model.fixtures);
  const framework = model.framework || model.grantFramework || { requirements: [] };
  const funding = model.funding || {};
  const selectedPeriod = model.filters?.periodOptions?.find((item) => item.value === model.filters?.selectedPeriod)?.label
    || model.quality?.period?.label
    || model.sourceLabel
    || "Selected records";
  const selectedScope = model.filters?.selectedScope || model.scope || "matchweek";

  return {
    schemaVersion: 1,
    status: "draft_for_human_review",
    generatedAt: isoDate(),
    generatedBy: "Daxora Ground Control",
    source,
    club: {
      name: safeText(club.name, "Club name not recorded"),
      organisationId: club.id || club.organisationId || null,
      postcode: club.postcode || club.weatherPostcode || null,
      homeNation: funding.filters?.selectedHomeNation || club.homeNation || club.nation || null,
    },
    selection: {
      period: selectedPeriod,
      scope: selectedScope,
      project: funding.project?.label || "No funding project selected",
      projectType: funding.filters?.selectedProjectType || "all",
    },
    evidenceQuality: {
      score: safeNumber(model.quality?.score ?? model.evidence?.score),
      label: safeText(model.quality?.label || model.evidence?.label),
      recordedMatchdays: safeNumber(model.evidence?.recordedWeeks || (model.selectedEntry ? 1 : 0)),
      methodology: safeText(model.quality?.methodology || framework.disclaimer),
      provenance: asArray(model.quality?.provenance).map(provenanceRecord),
      gaps: asArray(model.quality?.gaps),
    },
    metrics: [
      {
        id: "scheduled-fixtures",
        label: "Fixtures scheduled to proceed",
        value: scheduledFixtures,
        unit: "fixtures",
        provenance: "recorded_and_calculated",
        definition: "Fixtures present in the selected operational schedule and not recorded as postponed or cancelled. This does not prove that the fixture took place.",
      },
      {
        id: "team-opportunity-slots",
        label: "Team fixture opportunity slots",
        value: teamOpportunitySlots,
        unit: "team opportunities",
        provenance: "calculated",
        definition: "Two team opportunities for each fixture scheduled to proceed. This is not attendance, unique participants or beneficiaries.",
      },
      {
        id: "scheduled-pitch-hours",
        label: "Scheduled pitch hours",
        value: facilityHours,
        unit: "hours",
        provenance: "calculated",
        definition: "Duration calculated from the selected schedule. This is not verified completed facility use.",
      },
      {
        id: "postponements",
        label: "Recorded postponements",
        value: postponedFixtures,
        unit: "fixtures",
        provenance: "recorded",
        definition: "Fixtures explicitly recorded as postponed in the selected Ground Control records.",
      },
      {
        id: "cancellations",
        label: "Recorded cancellations",
        value: cancelledFixtures,
        unit: "fixtures",
        provenance: "recorded",
        definition: "Fixtures explicitly recorded as cancelled in the selected Ground Control records.",
      },
      {
        id: "official-coverage",
        label: "Confirmed official coverage",
        value: officialCoverage,
        unit: "percent",
        provenance: "calculated_from_recorded_status",
        definition: "Share of fixtures scheduled to proceed with a confirmed official in the selected records.",
      },
    ],
    evidenceRequirements: asArray(framework.requirements).map(requirementRecord),
    matchedProgrammes: asArray(funding.programmes).map(programmeRecord),
    catalogueCoverage: funding.coverage || null,
    narrative: safeText(model.narrative, "No funding narrative is available for this selection."),
    sourceRecordCount: sourceRows.length,
    limitations: [
      "This is a draft evidence pack for human review, not a completed grant application or guarantee of eligibility.",
      "Scheduled fixtures and scheduled pitch hours do not prove completed activity, attendance, unique participants or beneficiaries.",
      "Team categories inferred from team names must be checked before external use.",
      "Programme criteria, deadlines and status must be re-verified against the official source before submission.",
      "Financial, governance, tenure, safeguarding, consent and outcome evidence normally require separate club documents or manual confirmation.",
    ],
  };
}

function line(label, value) {
  return `- **${label}:** ${value}`;
}

function listLines(items, fallback = "None recorded") {
  return items.length ? items.map((item) => `  - ${item}`).join("\n") : `  - ${fallback}`;
}

export function fundingEvidencePackMarkdown(pack = {}) {
  const metrics = asArray(pack.metrics);
  const requirements = asArray(pack.evidenceRequirements);
  const programmes = asArray(pack.matchedProgrammes);
  const limitations = asArray(pack.limitations);
  const provenance = asArray(pack.evidenceQuality?.provenance);

  const metricRows = metrics.map((item) => `| ${item.label} | ${item.value} ${item.unit} | ${item.provenance} | ${item.definition} |`).join("\n");
  const requirementRows = requirements.map((item) => `| ${item.category} | ${item.title} | ${item.status} | ${item.currentEvidence} | ${item.nextAction} |`).join("\n");
  const programmeSections = programmes.map((programme) => [
    `### ${programme.funder} — ${programme.name}`,
    line("Status", programme.status),
    line("Amount", programme.amount),
    line("Match funding", programme.matchFunding),
    line("Match", `${programme.matchLabel} (${programme.matchScore}%)`),
    line("Last verified", programme.lastVerified || "Not recorded"),
    line("Official source", programme.officialUrl),
    "- **Eligibility notes:**",
    listLines(programme.eligibilityNotes),
    "- **Manual requirements:**",
    listLines(programme.manualRequirements),
  ].join("\n")).join("\n\n");

  return [
    `# Funding evidence draft — ${pack.club?.name || "Club"}`,
    "",
    "> Draft for human review. Do not submit without checking the official programme guidance and the club's supporting documents.",
    "",
    "## Evidence selection",
    line("Generated", pack.generatedAt || "Not recorded"),
    line("Period", pack.selection?.period || "Not recorded"),
    line("Scope", pack.selection?.scope || "Not recorded"),
    line("Funding project", pack.selection?.project || "Not selected"),
    line("Evidence confidence", `${pack.evidenceQuality?.score || 0}% — ${pack.evidenceQuality?.label || "Not assessed"}`),
    "",
    "## Operational narrative",
    pack.narrative || "No narrative available.",
    "",
    "## Traceable metrics",
    "| Metric | Value | Provenance | Definition and boundary |",
    "|---|---:|---|---|",
    metricRows || "| No metrics | — | — | — |",
    "",
    "## Evidence provenance",
    provenance.length ? provenance.map((item) => `- **${item.label} (${item.status}):** ${item.detail}`).join("\n") : "- No provenance records available.",
    "",
    "## Grant evidence requirements matrix",
    "| Category | Requirement | Status | Current evidence | Next action |",
    "|---|---|---|---|---|",
    requirementRows || "| No requirements | — | — | — | — |",
    "",
    "## Matched programmes",
    programmeSections || "No verified programme matches are included in this selection.",
    "",
    "## Evidence gaps",
    listLines(asArray(pack.evidenceQuality?.gaps).map((item) => `${item.label || item.title || item.id}: ${item.action || item.nextAction || item.status || "Review required"}`)),
    "",
    "## Limitations and required checks",
    limitations.map((item) => `- ${item}`).join("\n"),
    "",
    `Source records represented: ${pack.sourceRecordCount || 0}`,
    "",
  ].join("\n");
}

export function fundingEvidencePackFilename(clubName = "ground-control") {
  return `${cleanFilenamePart(clubName)}-funding-evidence-draft-${new Date().toISOString().slice(0, 10)}.md`;
}

export function downloadFundingEvidencePack(pack, filename = fundingEvidencePackFilename(pack?.club?.name)) {
  if (typeof document === "undefined") return;
  const blob = new Blob([fundingEvidencePackMarkdown(pack)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
