import { summariseFundingImpactEvidence } from "./fundingImpactEvidenceService.js";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    openDate: programme.openDate || null,
    decisionTime: programme.decisionTime || null,
    projectDuration: programme.projectDuration || null,
    matchFunding: safeText(programme.matchFunding),
    summary: safeText(programme.summary),
    eligibilityNotes: asArray(programme.eligibilityNotes),
    manualRequirements: asArray(programme.manualRequirements),
    requiredDocuments: asArray(programme.requiredDocuments),
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

function impactAdjustedRequirements(requirements, impact, project) {
  return requirements.map((item) => {
    if (!impact.verifiedRecords) return item;
    if (item.id === "participation-opportunity") {
      return { ...item, status: impact.uniqueParticipants || impact.attendanceVisits || impact.completedSessions ? "available" : "partial", source: "manually verified", currentEvidence: `${impact.completedSessions} completed sessions, ${impact.attendanceVisits} attendance visits and ${impact.uniqueParticipants} unique participants across ${impact.verifiedRecords} verified evidence record${impact.verifiedRecords === 1 ? "" : "s"}.`, nextAction: "Retain the named source records and document the method used to control repeat participants." };
    }
    if (item.id === "inclusion-reach") {
      const reach = impact.youthParticipants + impact.womenGirlsParticipants + impact.disabilityParticipants;
      return { ...item, status: reach ? "available" : "partial", source: "manually verified", currentEvidence: `${impact.youthParticipants} under-18, ${impact.womenGirlsParticipants} women or girls and ${impact.disabilityParticipants} disabled participants recorded. Categories may overlap.`, nextAction: reach ? "Retain the source records and explain overlapping categories in the application." : "Verified records exist, but no inclusion group count is currently evidenced." };
    }
    if (item.id === "workforce" && (impact.volunteerCount || impact.volunteerHours)) {
      return { ...item, status: "available", source: "manually verified", currentEvidence: `${impact.volunteerCount} volunteers and ${impact.volunteerHours} volunteer hours recorded across verified evidence periods.`, nextAction: "Add roles, qualifications and retention needs where the funder requests workforce detail." };
    }
    if (item.id === "monitoring-baseline") {
      return { ...item, status: "available", source: "manually verified", currentEvidence: `${impact.verifiedRecords} verified impact record${impact.verifiedRecords === 1 ? "" : "s"} covering ${impact.periodStart || "an undated start"} to ${impact.periodEnd || "an undated end"}.`, nextAction: "Use the same definitions and source method for future comparison periods." };
    }
    if (item.id === "project-case" && project?.summary && project?.outcomes && project?.deliveryPlan) {
      return { ...item, status: "partial", source: "club project record", currentEvidence: "A project summary, intended outcomes and delivery plan are recorded in the funding workspace.", nextAction: "Add consultation evidence, risks, milestones and final costed budget before submission." };
    }
    return item;
  });
}

function verifiedImpactMetrics(summary) {
  if (!summary.verifiedRecords) return [];
  const rows = [
    ["completed-sessions", "Verified completed sessions", summary.completedSessions, "sessions", "Completed sessions entered by the club and marked verified against the named source."],
    ["attendance-visits", "Verified attendance visits", summary.attendanceVisits, "visits", "Total recorded visits across verified evidence periods. Repeat attendances may be included."],
    ["unique-participants", "Verified unique participants", summary.uniqueParticipants, "people", "Distinct participants recorded by the club across verified evidence periods. The club remains responsible for double-counting controls."],
    ["youth-participants", "Verified under-18 participants", summary.youthParticipants, "people", "Under-18 participants recorded in verified evidence. This may overlap with other demographic categories."],
    ["women-girls-participants", "Verified women and girls participants", summary.womenGirlsParticipants, "people", "Women and girls recorded in verified evidence. This may overlap with age or disability categories."],
    ["disability-participants", "Verified disabled participants", summary.disabilityParticipants, "people", "Disabled participants recorded in verified evidence. This may overlap with other demographic categories."],
    ["volunteer-hours", "Verified volunteer hours", summary.volunteerHours, "hours", "Volunteer hours recorded by the club and marked verified against the named source."],
  ];
  return rows.map(([id, label, value, unit, definition]) => ({
    id,
    label,
    value,
    unit,
    provenance: "manually_verified",
    definition,
  }));
}

export function buildFundingEvidencePack({ club = {}, model = {}, project = null, impactEvidence = [], source = "analytics" } = {}) {
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
  const impact = summariseFundingImpactEvidence(impactEvidence);
  const selectedPeriod = model.filters?.periodOptions?.find((item) => item.value === model.filters?.selectedPeriod)?.label
    || model.quality?.period?.label
    || model.sourceLabel
    || "Selected records";
  const selectedScope = model.filters?.selectedScope || model.scope || "matchweek";

  const operationalMetrics = [
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
  ];

  const limitations = [
    "This is a draft evidence pack for human review, not a completed grant application or guarantee of eligibility.",
    "Scheduled fixtures and scheduled pitch hours do not prove completed activity, attendance, unique participants or beneficiaries.",
    "Team categories inferred from team names must be checked before external use.",
    "Programme criteria, deadlines and status must be re-verified against the official source before submission.",
    "Financial, governance, tenure, safeguarding, consent and outcome evidence normally require separate club documents or manual confirmation.",
  ];
  if (!impact.verifiedRecords) {
    limitations.unshift("No verified completed-activity or participation record is included. The pack therefore contains operational scheduling evidence only.");
  }

  return {
    schemaVersion: 2,
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
      project: project?.title || funding.project?.label || "No funding project selected",
      projectId: project?.id || null,
      projectType: project?.projectType || funding.filters?.selectedProjectType || "all",
      projectStatus: project?.status || null,
      estimatedCost: safeNumber(project?.estimatedCost),
      targetFunding: safeNumber(project?.targetFunding),
      summary: safeText(project?.summary, "Project summary not recorded"),
      beneficiaries: safeText(project?.beneficiaries, "Beneficiaries not recorded"),
      outcomes: safeText(project?.outcomes, "Outcomes not recorded"),
      deliveryPlan: safeText(project?.deliveryPlan, "Delivery plan not recorded"),
    },
    evidenceQuality: {
      score: safeNumber(model.quality?.score ?? model.evidence?.score),
      label: safeText(model.quality?.label || model.evidence?.label),
      recordedMatchdays: safeNumber(model.evidence?.recordedWeeks || (model.selectedEntry ? 1 : 0)),
      methodology: safeText(model.quality?.methodology || framework.disclaimer),
      provenance: asArray(model.quality?.provenance).map(provenanceRecord),
      gaps: asArray(model.quality?.gaps).filter((gap) => !impact.verifiedRecords || !/(attendance|participant|beneficiar|volunteer)/i.test(`${gap.id || ""} ${gap.label || ""} ${gap.title || ""}`)),
    },
    impactEvidence: {
      totalRecords: impact.totalRecords,
      verifiedRecords: impact.verifiedRecords,
      draftRecords: impact.draftRecords,
      periodStart: impact.periodStart || null,
      periodEnd: impact.periodEnd || null,
      sources: impact.sources,
      summary: {
        completedSessions: impact.completedSessions,
        attendanceVisits: impact.attendanceVisits,
        uniqueParticipants: impact.uniqueParticipants,
        youthParticipants: impact.youthParticipants,
        womenGirlsParticipants: impact.womenGirlsParticipants,
        disabilityParticipants: impact.disabilityParticipants,
        communitySessions: impact.communitySessions,
        cancelledSessions: impact.cancelledSessions,
        volunteerCount: impact.volunteerCount,
        volunteerHours: impact.volunteerHours,
      },
      records: impact.verified.map((row) => ({
        id: row.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        evidenceMethod: row.evidenceMethod,
        sourceLabel: row.sourceLabel,
        completedSessions: row.completedSessions,
        attendanceVisits: row.attendanceVisits,
        uniqueParticipants: row.uniqueParticipants,
        youthParticipants: row.youthParticipants,
        womenGirlsParticipants: row.womenGirlsParticipants,
        disabilityParticipants: row.disabilityParticipants,
        communitySessions: row.communitySessions,
        cancelledSessions: row.cancelledSessions,
        volunteerCount: row.volunteerCount,
        volunteerHours: row.volunteerHours,
        outcomeSummary: row.outcomeSummary,
        notes: row.notes,
        verifiedBy: row.verifiedBy,
        verifiedAt: row.verifiedAt,
      })),
    },
    operationalMetrics,
    metrics: [...operationalMetrics, ...verifiedImpactMetrics(impact)],
    evidenceRequirements: impactAdjustedRequirements(asArray(framework.requirements).map(requirementRecord), impact, project),
    matchedProgrammes: asArray(funding.programmes).map(programmeRecord),
    catalogueCoverage: funding.coverage || null,
    narrative: safeText(model.narrative, "No funding narrative is available for this selection."),
    sourceRecordCount: sourceRows.length,
    limitations,
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
  const impact = pack.impactEvidence || {};

  const metricRows = metrics.map((item) => `| ${item.label} | ${item.value} ${item.unit} | ${item.provenance} | ${item.definition} |`).join("\n");
  const requirementRows = requirements.map((item) => `| ${item.category} | ${item.title} | ${item.status} | ${item.currentEvidence} | ${item.nextAction} |`).join("\n");
  const programmeSections = programmes.map((programme) => [
    `### ${programme.funder} — ${programme.name}`,
    line("Status", programme.status),
    line("Amount", programme.amount),
    line("Deadline", programme.deadline || "No fixed deadline recorded"),
    line("Decision time", programme.decisionTime || "Check official guidance"),
    line("Project duration", programme.projectDuration || "Check official guidance"),
    line("Match funding", programme.matchFunding),
    line("Match", `${programme.matchLabel} (${programme.matchScore}%)`),
    line("Last verified", programme.lastVerified || "Not recorded"),
    line("Official source", programme.officialUrl),
    "- **Eligibility notes:**",
    listLines(programme.eligibilityNotes),
    "- **Required documents or manual checks:**",
    listLines([...programme.requiredDocuments, ...programme.manualRequirements]),
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
    "## Completed activity and participation",
    impact.verifiedRecords
      ? [
        line("Verified evidence records", impact.verifiedRecords),
        line("Evidence period", `${impact.periodStart || "Not recorded"} to ${impact.periodEnd || "Not recorded"}`),
        line("Evidence sources", asArray(impact.sources).join("; ") || "Not recorded"),
      ].join("\n")
      : "No verified completed-activity or participation record is included. Draft records are excluded from claim totals.",
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

function htmlRows(items, mapper, emptyLabel) {
  if (!items.length) return `<tr><td colspan="4" class="empty">${escapeHtml(emptyLabel)}</td></tr>`;
  return items.map(mapper).join("");
}

export function fundingApplicationPackHtml(pack = {}) {
  const metrics = asArray(pack.metrics);
  const requirements = asArray(pack.evidenceRequirements);
  const programmes = asArray(pack.matchedProgrammes);
  const impact = pack.impactEvidence || {};
  const generated = pack.generatedAt ? new Date(pack.generatedAt).toLocaleString("en-GB") : "Not recorded";
  const metricRows = htmlRows(metrics, (item) => `<tr><td><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.definition)}</span></td><td class="value">${escapeHtml(item.value)} ${escapeHtml(item.unit)}</td><td><span class="pill">${escapeHtml(item.provenance)}</span></td></tr>`, "No metrics available.");
  const requirementRows = htmlRows(requirements, (item) => `<tr><td>${escapeHtml(item.category)}</td><td><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.currentEvidence)}</span></td><td><span class="pill status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.nextAction)}</td></tr>`, "No requirement records available.");
  const programmeCards = programmes.length ? programmes.map((programme) => `<article class="programme"><div class="programme-head"><div><small>${escapeHtml(programme.funder)}</small><h3>${escapeHtml(programme.name)}</h3></div><span class="pill">${escapeHtml(programme.status)}</span></div><p>${escapeHtml(programme.summary)}</p><dl><div><dt>Amount</dt><dd>${escapeHtml(programme.amount)}</dd></div><div><dt>Deadline</dt><dd>${escapeHtml(programme.deadline || "No fixed deadline recorded")}</dd></div><div><dt>Match funding</dt><dd>${escapeHtml(programme.matchFunding)}</dd></div><div><dt>Last verified</dt><dd>${escapeHtml(programme.lastVerified || "Not recorded")}</dd></div></dl><h4>Eligibility and evidence checks</h4><ul>${[...programme.eligibilityNotes, ...programme.requiredDocuments, ...programme.manualRequirements].slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Check the official guidance.</li>"}</ul><p class="source">Official source: <a href="${escapeHtml(programme.officialUrl)}">${escapeHtml(programme.officialUrl)}</a></p></article>`).join("") : '<div class="empty-card">No verified programme matches are included in this selection.</div>';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funding application evidence — ${escapeHtml(pack.club?.name || "Club")}</title>
<style>
:root{font-family:Inter,Arial,sans-serif;color:#0f172a;background:#eef2f7}*{box-sizing:border-box}body{margin:0;padding:28px}.page{max-width:1100px;margin:auto;background:white;border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.12)}header{padding:36px;background:linear-gradient(135deg,#071927,#064e3b);color:white}header small,.eyebrow{text-transform:uppercase;letter-spacing:.18em;font-weight:800;font-size:11px}h1{font-size:38px;line-height:1.05;margin:14px 0 8px}header p{color:#cbd5e1;margin:0;line-height:1.6}.banner{margin-top:24px;padding:14px 16px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);border-radius:16px;font-weight:700}.content{padding:30px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.stat{padding:18px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc}.stat small{display:block;color:#64748b;text-transform:uppercase;font-weight:800;letter-spacing:.1em}.stat strong{display:block;font-size:26px;margin-top:8px}.section{margin-top:30px;break-inside:avoid}.section h2{font-size:23px;margin:0 0 8px}.section>p{color:#475569;line-height:1.65}.notice{padding:16px;border-radius:16px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-weight:650;line-height:1.55}table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-size:13px}th{background:#f8fafc;text-align:left;padding:12px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-size:10px}td{padding:14px;border-top:1px solid #e2e8f0;vertical-align:top;line-height:1.45}td span{display:block;color:#64748b;margin-top:5px}.value{font-size:17px;font-weight:800;white-space:nowrap}.pill{display:inline-block;padding:5px 9px;border-radius:999px;background:#e2e8f0;font-size:10px;font-weight:800;text-transform:uppercase}.status-ready,.status-available{background:#d1fae5;color:#065f46}.status-missing{background:#ffe4e6;color:#9f1239}.status-partial,.status-in_progress{background:#fef3c7;color:#92400e}.programmes{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.programme{border:1px solid #e2e8f0;border-radius:20px;padding:19px;break-inside:avoid}.programme-head{display:flex;justify-content:space-between;gap:15px}.programme h3{margin:5px 0 0;font-size:19px}.programme p,.programme li{color:#475569;line-height:1.55;font-size:13px}.programme dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}.programme dl div{background:#f8fafc;padding:10px;border-radius:12px}.programme dt{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:800}.programme dd{margin:5px 0 0;font-weight:750}.source{word-break:break-all}.source a{color:#047857}.empty,.empty-card{text-align:center;color:#64748b;padding:28px}.limitations li{margin:7px 0;color:#475569;line-height:1.55}footer{padding:20px 30px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5}@media(max-width:760px){body{padding:0}.page{border-radius:0}.content{padding:20px}.grid,.programmes{grid-template-columns:1fr}h1{font-size:31px}table{display:block;overflow:auto}}@media print{body{background:white;padding:0}.page{box-shadow:none;max-width:none}.programme{page-break-inside:avoid}}
</style></head><body><main class="page"><header><small>Daxora Ground Control · funding evidence</small><h1>${escapeHtml(pack.club?.name || "Club")}</h1><p>${escapeHtml(pack.selection?.project || "Funding project not selected")} · ${escapeHtml(pack.selection?.period || "Evidence period not recorded")}</p><div class="banner">Draft for human review. Programme rules and supporting documents must be checked before submission.</div></header><div class="content">
<section class="grid"><div class="stat"><small>Evidence quality</small><strong>${escapeHtml(pack.evidenceQuality?.score || 0)}%</strong><span>${escapeHtml(pack.evidenceQuality?.label || "Not assessed")}</span></div><div class="stat"><small>Verified impact records</small><strong>${escapeHtml(impact.verifiedRecords || 0)}</strong><span>${escapeHtml(impact.draftRecords || 0)} draft records excluded</span></div><div class="stat"><small>Source records</small><strong>${escapeHtml(pack.sourceRecordCount || 0)}</strong><span>Operational records represented</span></div></section>
<section class="section"><span class="eyebrow">Executive evidence summary</span><h2>Recorded position</h2><p>${escapeHtml(pack.narrative || "No narrative available.")}</p></section>
<section class="section"><span class="eyebrow">Project case</span><h2>${escapeHtml(pack.selection?.project || "Funding project")}</h2><p><strong>Project summary:</strong> ${escapeHtml(pack.selection?.summary || "Not recorded")}</p><p><strong>Intended beneficiaries:</strong> ${escapeHtml(pack.selection?.beneficiaries || "Not recorded")}</p><p><strong>Expected outcomes:</strong> ${escapeHtml(pack.selection?.outcomes || "Not recorded")}</p><p><strong>Delivery plan:</strong> ${escapeHtml(pack.selection?.deliveryPlan || "Not recorded")}</p><p><strong>Estimated cost:</strong> £${escapeHtml(Number(pack.selection?.estimatedCost || 0).toLocaleString("en-GB"))} · <strong>Target grant:</strong> £${escapeHtml(Number(pack.selection?.targetFunding || 0).toLocaleString("en-GB"))}</p></section>
<section class="section"><span class="eyebrow">Important boundary</span><div class="notice">Scheduled fixtures and scheduled pitch hours do not prove completed activity, attendance, unique participants or beneficiaries. Only records marked verified in the Impact evidence register are included as completed-activity claims.</div></section>
<section class="section"><span class="eyebrow">Traceable measures</span><h2>Operational and verified impact evidence</h2><table><thead><tr><th>Measure</th><th>Value</th><th>Provenance</th></tr></thead><tbody>${metricRows}</tbody></table></section>
<section class="section"><span class="eyebrow">Readiness matrix</span><h2>Evidence requirements and gaps</h2><table><thead><tr><th>Category</th><th>Requirement and current evidence</th><th>Status</th><th>Next action</th></tr></thead><tbody>${requirementRows}</tbody></table></section>
<section class="section"><span class="eyebrow">Programme matrix</span><h2>Matched verified programmes</h2><div class="programmes">${programmeCards}</div></section>
<section class="section limitations"><span class="eyebrow">Review before submission</span><h2>Limitations and required checks</h2><ul>${asArray(pack.limitations).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
</div><footer>Generated ${escapeHtml(generated)} by Daxora Ground Control. This document is an evidence draft, not legal, financial or funding-eligibility advice.</footer></main></body></html>`;
}

export function fundingEvidencePackFilename(clubName = "ground-control") {
  return `${cleanFilenamePart(clubName)}-funding-evidence-draft-${new Date().toISOString().slice(0, 10)}.md`;
}

export function fundingApplicationPackFilename(clubName = "ground-control") {
  return `${cleanFilenamePart(clubName)}-funding-application-evidence-${new Date().toISOString().slice(0, 10)}.html`;
}

function downloadBlob(content, type, filename) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadFundingEvidencePack(pack, filename = fundingEvidencePackFilename(pack?.club?.name)) {
  downloadBlob(fundingEvidencePackMarkdown(pack), "text/markdown;charset=utf-8", filename);
}

export function downloadFundingApplicationPack(pack, filename = fundingApplicationPackFilename(pack?.club?.name)) {
  downloadBlob(fundingApplicationPackHtml(pack), "text/html;charset=utf-8", filename);
}
