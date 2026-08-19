function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normaliseStatus(value) {
  const status = clean(value).toLowerCase();
  if (status.includes("postpon")) return "postponed";
  if (status.includes("cancel")) return "cancelled";
  if (status.includes("unresolved") || status.includes("unassigned")) return "unresolved";
  return "scheduled";
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableObject(value[key])]),
  );
}

export function stableJson(value) {
  return JSON.stringify(stableObject(value));
}

export function approvalHash(value) {
  let hash = 2166136261;
  const text = typeof value === "string" ? value : stableJson(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fixtureId(fixture = {}, index = 0) {
  return clean(
    fixture.id
      || fixture.fixtureId
      || fixture.key
      || fixture.fullTimeId
      || fixture.sourceId
      || `${fixture.homeTeam || fixture.team || "fixture"}-${index}`,
  );
}

function fixtureSnapshot(fixture = {}, dayKey = "matchday", index = 0, forcedStatus = "") {
  const status = forcedStatus || normaliseStatus(fixture.status || fixture.fixtureStatus || fixture.outcome);
  return {
    id: fixtureId(fixture, index),
    day: clean(dayKey),
    status,
    homeTeam: clean(fixture.homeTeam || fixture.team || fixture.home || fixture.teamName),
    awayTeam: clean(fixture.awayTeam || fixture.opposition || fixture.opponent || fixture.away),
    kickOff: clean(fixture.ko || fixture.koTime || fixture.kickOff || fixture.kickoff || fixture.time),
    pitchId: clean(fixture.pitchId || fixture.pitch || fixture.pitchName || fixture.pitchLabel),
    siteId: clean(fixture.siteId || fixture.venueId || fixture.groundId || fixture.homeSiteId),
    official: clean(fixture.referee || fixture.official || fixture.ref || fixture.matchOfficial),
    format: clean(fixture.cfg?.format || fixture.manualFormat || fixture.format),
  };
}

function dayFixtures(day = {}) {
  if (Array.isArray(day.fixtures)) return day.fixtures;
  return [
    ...asArray(day.scheduled).map((fixture) => ({ fixture, status: "scheduled" })),
    ...asArray(day.postponed).map((fixture) => ({ fixture, status: "postponed" })),
    ...asArray(day.cancelled).map((fixture) => ({ fixture, status: "cancelled" })),
    ...asArray(day.unresolved).map((fixture) => ({ fixture, status: "unresolved" })),
  ].map(({ fixture, status }) => ({ ...fixture, __approvalStatus: status }));
}

export function buildMatchweekApprovalSnapshot(days = []) {
  const normalisedDays = asArray(days)
    .filter((day) => day?.hasRun !== false || dayFixtures(day).length > 0)
    .map((day) => {
      const key = clean(day.key || day.day || day.label).toLowerCase();
      const fixtures = dayFixtures(day)
        .map((fixture, index) => fixtureSnapshot(fixture, key, index, fixture.__approvalStatus || ""))
        .sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
      return {
        key,
        label: clean(day.dateLabel || day.label || key),
        date: clean(day.date),
        fixtures,
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));

  const snapshot = {
    version: 2,
    type: "matchweek",
    days: normalisedDays,
    fixtureCount: normalisedDays.reduce((sum, day) => sum + day.fixtures.length, 0),
    unresolvedCount: normalisedDays.reduce((sum, day) => sum + day.fixtures.filter((fixture) => fixture.status === "unresolved").length, 0),
    postponedCount: normalisedDays.reduce((sum, day) => sum + day.fixtures.filter((fixture) => fixture.status === "postponed").length, 0),
    cancelledCount: normalisedDays.reduce((sum, day) => sum + day.fixtures.filter((fixture) => fixture.status === "cancelled").length, 0),
  };
  return Object.freeze({ ...snapshot, contentHash: approvalHash(snapshot) });
}

export function buildMatchweekApprovalKey(snapshotOrDays) {
  const snapshot = Array.isArray(snapshotOrDays)
    ? buildMatchweekApprovalSnapshot(snapshotOrDays)
    : snapshotOrDays;
  return `elite:matchweek:${clean(snapshot?.contentHash) || approvalHash(snapshot || {})}`;
}

export function buildExecutiveReportSnapshot(model = {}, period = {}) {
  const snapshot = {
    version: 2,
    type: "executive_report",
    organisationName: clean(model.organisationName),
    period: {
      label: clean(period.label || model.periodLabel || "Current matchweek"),
      start: clean(period.start || model.periodStart),
      end: clean(period.end || model.periodEnd),
    },
    metrics: {
      siteCount: finite(model.siteCount),
      readySites: finite(model.readySites),
      teamCount: finite(model.teamCount),
      pitchCount: finite(model.pitchCount),
      fixtureCount: finite(model.fixtureCount),
      unresolvedCount: finite(model.unresolvedCount),
      closedPitchCount: finite(model.closedPitchCount),
      officialGapCount: finite(model.officialGapCount),
      governanceScore: finite(model.governanceScore),
      openActions: asArray(model.actions).length,
    },
    sites: asArray(model.boardRows).map((row) => ({
      site: clean(row.site),
      status: clean(row.status),
      teams: finite(row.teams),
      pitches: finite(row.pitches),
      fixtures: finite(row.fixtures),
      unresolved: finite(row.unresolved),
      closedPitches: finite(row.closedPitches),
      officialGaps: finite(row.officialGaps),
      parkingSpaces: finite(row.parkingSpaces),
      lead: clean(row.lead),
    })),
    actions: asArray(model.actions).map((item) => ({
      id: clean(item.id),
      priority: clean(item.priority),
      label: clean(item.label),
    })),
  };
  return Object.freeze({ ...snapshot, contentHash: approvalHash(snapshot) });
}

export function buildExecutiveReportApprovalKey(snapshot) {
  return `elite:executive_report:${clean(snapshot?.contentHash) || approvalHash(snapshot || {})}`;
}

export function buildFundingPackSnapshot({ project = {}, applications = [], tasks = [], obligations = [], impactEvidence = [], pack = null } = {}) {
  const projectId = clean(project.id || pack?.project?.id);
  const related = (row) => !projectId || clean(row.projectId || row.project_id) === projectId;
  const snapshot = {
    version: 2,
    type: "funding_pack",
    project: {
      id: projectId,
      title: clean(project.title || pack?.project?.title),
      summary: clean(project.summary || pack?.project?.summary),
      status: clean(project.status || pack?.project?.status),
      targetFunding: finite(project.targetFunding ?? project.target_funding ?? pack?.project?.targetFunding),
      estimatedCost: finite(project.estimatedCost ?? project.estimated_cost ?? pack?.project?.estimatedCost),
      updatedAt: clean(project.updatedAt || project.updated_at || pack?.project?.updatedAt),
    },
    applications: asArray(applications).filter(related).map((item) => ({
      id: clean(item.id),
      funder: clean(item.funderName || item.funder_name || item.funder),
      programme: clean(item.programmeName || item.programme_name || item.programme),
      status: clean(item.status),
      requestedAmount: finite(item.requestedAmount ?? item.requested_amount),
      awardedAmount: finite(item.awardedAmount ?? item.awarded_amount),
      deadline: clean(item.deadline || item.dueDate || item.due_date),
      updatedAt: clean(item.updatedAt || item.updated_at),
    })),
    tasks: asArray(tasks).filter(related).map((item) => ({
      id: clean(item.id),
      title: clean(item.title),
      status: clean(item.status),
      dueDate: clean(item.dueDate || item.due_date),
      ownerName: clean(item.ownerName || item.owner_name),
      updatedAt: clean(item.updatedAt || item.updated_at),
    })),
    obligations: asArray(obligations).filter(related).map((item) => ({
      id: clean(item.id),
      title: clean(item.title),
      status: clean(item.status),
      dueDate: clean(item.dueDate || item.due_date),
      updatedAt: clean(item.updatedAt || item.updated_at),
    })),
    impactEvidence: asArray(impactEvidence).filter(related).map((item) => ({
      id: clean(item.id),
      metric: clean(item.metric || item.metricName || item.metric_name),
      value: item.value ?? item.metricValue ?? item.metric_value ?? null,
      periodStart: clean(item.periodStart || item.period_start),
      periodEnd: clean(item.periodEnd || item.period_end),
      source: clean(item.source || item.sourceType || item.source_type),
      updatedAt: clean(item.updatedAt || item.updated_at),
    })),
    packHash: clean(pack?.contentHash || pack?.evidenceHash || pack?.generatedHash),
  };
  return Object.freeze({ ...snapshot, contentHash: approvalHash(snapshot) });
}

export function buildFundingPackApprovalKey(snapshot) {
  return `elite:funding_pack:${clean(snapshot?.contentHash) || approvalHash(snapshot || {})}`;
}

export function buildCommunicationApprovalSnapshot(rows = [], prepared = {}) {
  const snapshot = {
    version: 2,
    type: "communications",
    recipientCount: finite(prepared.messages?.length),
    unavailableCount: finite(prepared.unavailable?.length),
    approvalRequired: asArray(rows).some((row) => Boolean(row.governedTemplateApprovalRequired)),
    templates: [...new Set(asArray(rows).map((row) => clean(row.governedTemplateKey)).filter(Boolean))].sort(),
    templateVersions: [...new Set(asArray(rows).map((row) => clean(row.governedTemplateVersion)).filter(Boolean))].sort(),
    messages: asArray(rows).map((row) => ({
      id: clean(row.id),
      messageHash: clean(row.messageHash),
      teamName: clean(row.teamName),
      status: clean(row.status),
      dateLabel: clean(row.dateLabel),
      kickOff: clean(row.ko),
      pitch: clean(row.pitch),
      templateKey: clean(row.governedTemplateKey),
      templateVersion: clean(row.governedTemplateVersion),
      approvalRequired: Boolean(row.governedTemplateApprovalRequired),
      recipients: asArray(row.recipients).map((recipient) => ({
        type: clean(recipient.type),
        name: clean(recipient.name),
        channel: clean(recipient.channel),
        destination: clean(recipient.destination),
        message: clean(recipient.message || row.message),
      })),
    })),
  };
  return Object.freeze({ ...snapshot, contentHash: approvalHash(snapshot) });
}

export function buildCommunicationApprovalKeyFromSnapshot(snapshot) {
  return `elite:communications:${clean(snapshot?.contentHash) || approvalHash(snapshot || {})}`;
}
