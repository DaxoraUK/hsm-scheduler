import { DB, supaFetch } from "../supabase.js";
import { loadFundingWorkspace } from "../grants/fundingWorkspaceService.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function encode(value) {
  return encodeURIComponent(String(value ?? ""));
}

function createId(prefix = "elite") {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export const DEFAULT_ELITE_APPROVAL_POLICY = Object.freeze({
  matchweekApprovalRequired: true,
  communicationsApprovalRequired: true,
  fundingPackApprovalRequired: true,
  executiveReportApprovalRequired: false,
  separationOfDuties: true,
  approvalExpiryHours: 168,
});

export const ELITE_RESPONSIBILITIES = Object.freeze([
  { value: "site_lead", label: "Site lead" },
  { value: "site_admin", label: "Site administrator" },
  { value: "reviewer", label: "Reviewer / approver" },
  { value: "executive_viewer", label: "Executive viewer" },
]);

export const ELITE_APPROVAL_TYPES = Object.freeze({
  MATCHWEEK: "matchweek",
  COMMUNICATIONS: "communications",
  FUNDING_PACK: "funding_pack",
  EXECUTIVE_REPORT: "executive_report",
});

export const DEFAULT_COMMUNICATION_TEMPLATES = Object.freeze([
  {
    templateKey: "fixture_confirmed",
    name: "Fixture confirmed",
    subjectTemplate: "{{team}} | matchday details",
    bodyTemplate: "Hi {{coach}},\n\nYour fixture details are confirmed for {{date}} at {{kickoff}}. Venue: {{venue}}. Pitch: {{pitch}}.\n\nPlease contact the club if anything is incorrect.",
    approvalRequired: true,
  },
  {
    templateKey: "fixture_changed",
    name: "Fixture changed",
    subjectTemplate: "{{team}} | fixture details changed",
    bodyTemplate: "Hi {{coach}},\n\nYour fixture details have changed. Please review the latest date, kick-off, venue and pitch shown by Ground Control.\n\nContact the club if anything is incorrect.",
    approvalRequired: true,
  },
  {
    templateKey: "fixture_postponed",
    name: "Fixture postponed",
    subjectTemplate: "{{team}} | fixture postponed",
    bodyTemplate: "Hi {{coach}},\n\nThe fixture scheduled for {{date}} has been postponed. The club will share replacement details when confirmed.",
    approvalRequired: true,
  },
  {
    templateKey: "fixture_cancelled",
    name: "Fixture cancelled",
    subjectTemplate: "{{team}} | fixture cancelled",
    bodyTemplate: "Hi {{coach}},\n\nThe fixture scheduled for {{date}} has been cancelled. No matchday action is required unless the club contacts you again.",
    approvalRequired: true,
  },
]);

export function normaliseEliteApprovalPolicy(row = {}) {
  return {
    clubId: row.club_id || row.clubId || "",
    matchweekApprovalRequired: Boolean(row.matchweek_approval_required ?? row.matchweekApprovalRequired ?? DEFAULT_ELITE_APPROVAL_POLICY.matchweekApprovalRequired),
    communicationsApprovalRequired: Boolean(row.communications_approval_required ?? row.communicationsApprovalRequired ?? DEFAULT_ELITE_APPROVAL_POLICY.communicationsApprovalRequired),
    fundingPackApprovalRequired: Boolean(row.funding_pack_approval_required ?? row.fundingPackApprovalRequired ?? DEFAULT_ELITE_APPROVAL_POLICY.fundingPackApprovalRequired),
    executiveReportApprovalRequired: Boolean(row.executive_report_approval_required ?? row.executiveReportApprovalRequired ?? DEFAULT_ELITE_APPROVAL_POLICY.executiveReportApprovalRequired),
    separationOfDuties: Boolean(row.separation_of_duties ?? row.separationOfDuties ?? DEFAULT_ELITE_APPROVAL_POLICY.separationOfDuties),
    approvalExpiryHours: Math.max(24, Number(row.approval_expiry_hours ?? row.approvalExpiryHours ?? DEFAULT_ELITE_APPROVAL_POLICY.approvalExpiryHours) || DEFAULT_ELITE_APPROVAL_POLICY.approvalExpiryHours),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function normaliseEliteResponsibility(row = {}) {
  const userDisplayName = clean(row.display_name || row.user_display_name || row.userDisplayName);
  const userEmail = clean(row.email || row.user_email || row.userEmail);
  return {
    id: row.id || createId("responsibility"),
    clubId: row.club_id || row.clubId || "",
    siteId: row.site_id || row.siteId || "",
    userId: row.user_id || row.userId || "",
    userDisplayName,
    userEmail,
    userLabel: userDisplayName || userEmail || "",
    responsibility: row.responsibility || "site_lead",
    active: row.active !== false,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

export function normaliseEliteApproval(row = {}) {
  const rawStatus = row.status || "pending";
  const expiresAt = row.expires_at || row.expiresAt || null;
  const expiry = expiresAt ? new Date(expiresAt).getTime() : null;
  const status = rawStatus === "pending" && Number.isFinite(expiry) && expiry <= Date.now()
    ? "expired"
    : rawStatus;
  return {
    id: row.id || createId("approval"),
    clubId: row.club_id || row.clubId || "",
    approvalType: row.approval_type || row.approvalType || ELITE_APPROVAL_TYPES.MATCHWEEK,
    entityKey: row.entity_key || row.entityKey || "",
    title: row.title || "Approval request",
    summary: row.summary || "",
    siteId: row.site_id || row.siteId || "",
    status,
    requestedBy: row.requested_by || row.requestedBy || "",
    requestedByLabel: row.requested_by_label || row.requestedByLabel || "",
    requestedAt: row.requested_at || row.requestedAt || null,
    decisionBy: row.decision_by || row.decisionBy || "",
    decisionByLabel: row.decision_by_label || row.decisionByLabel || "",
    decisionAt: row.decision_at || row.decisionAt || null,
    decisionNote: row.decision_note || row.decisionNote || "",
    expiresAt,
    snapshot: row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {},
  };
}

export function normaliseEliteTemplate(row = {}) {
  return {
    id: row.id || createId("template"),
    clubId: row.club_id || row.clubId || "",
    templateKey: row.template_key || row.templateKey || "fixture_confirmed",
    name: row.name || "Communication template",
    subjectTemplate: row.subject_template || row.subjectTemplate || "",
    bodyTemplate: row.body_template || row.bodyTemplate || "",
    active: row.active !== false,
    approvalRequired: Boolean(row.approval_required ?? row.approvalRequired ?? true),
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

function memberLabel(member = {}) {
  return clean(member.display_name || member.displayName || member.email || member.user_id || member.userId) || "Club member";
}

export async function loadEliteGovernanceWorkspace(clubId) {
  const club = encode(clubId);
  const requests = [
    ["policy", () => supaFetch("GET", `elite_approval_policies?select=*&club_id=eq.${club}&limit=1`)],
    ["responsibilities", () => supaFetch("GET", `elite_site_responsibilities?select=*&club_id=eq.${club}&active=eq.true&order=site_id.asc,created_at.asc`)],
    ["approvals", () => supaFetch("GET", `elite_approval_requests?select=*&club_id=eq.${club}&order=requested_at.desc&limit=100`)],
    ["templates", () => supaFetch("GET", `elite_communication_templates?select=*&club_id=eq.${club}&order=template_key.asc`)],
    ["members", () => DB.listClubMembers(clubId)],
    ["funding", () => loadFundingWorkspace(clubId)],
    ["audit", () => DB.listAuditEvents(clubId, 100)],
  ];
  const settled = await Promise.allSettled(requests.map(([, load]) => load()));
  const values = {};
  const errors = {};
  settled.forEach((result, index) => {
    const key = requests[index][0];
    if (result.status === "fulfilled") values[key] = result.value;
    else errors[key] = result.reason?.message || `${key} could not be loaded`;
  });

  const memberRows = asArray(values.members);
  const memberMap = new Map(memberRows.map((member) => [member.user_id || member.userId, memberLabel(member)]));
  const approvals = asArray(values.approvals).map((row) => normaliseEliteApproval({
    ...row,
    requested_by_label: memberMap.get(row.requested_by) || "Club member",
    decision_by_label: memberMap.get(row.decision_by) || "",
  }));
  const templates = asArray(values.templates).length
    ? asArray(values.templates).map(normaliseEliteTemplate)
    : DEFAULT_COMMUNICATION_TEMPLATES.map((item) => normaliseEliteTemplate({ ...item, clubId }));

  return {
    policy: normaliseEliteApprovalPolicy(asArray(values.policy)[0] || { clubId }),
    responsibilities: asArray(values.responsibilities).map(normaliseEliteResponsibility),
    approvals,
    templates,
    members: memberRows,
    funding: values.funding || { projects: [], applications: [], applicationTasks: [], monitoringObligations: [] },
    auditEvents: asArray(values.audit),
    errors,
  };
}

export async function loadEliteSiteResponsibilities(clubId) {
  const rows = await supaFetch("POST", "rpc/list_elite_site_responsibilities", {
    target_club_id: clubId,
  });
  return asArray(rows).map(normaliseEliteResponsibility);
}

export async function authoriseEliteGovernedExport(clubId, exportRequest) {
  return supaFetch("POST", "rpc/authorise_elite_governed_export", {
    target_club_id: clubId,
    request_type: exportRequest.approvalType,
    request_entity_key: clean(exportRequest.entityKey),
    export_format: clean(exportRequest.format || "html"),
    export_snapshot: exportRequest.snapshot && typeof exportRequest.snapshot === "object" ? exportRequest.snapshot : {},
  });
}

export async function cancelEliteApprovalRequest(clubId, approvalId, note = "") {
  const result = await supaFetch("POST", "rpc/cancel_elite_approval_request", {
    target_club_id: clubId,
    approval_id: approvalId,
    cancellation_note: clean(note),
  });
  return normaliseEliteApproval(result || { id: approvalId, status: "cancelled" });
}

export async function saveEliteApprovalPolicy(clubId, policy) {
  const result = await supaFetch("POST", "rpc/save_elite_approval_policy", {
    target_club_id: clubId,
    policy: {
      matchweekApprovalRequired: Boolean(policy.matchweekApprovalRequired),
      communicationsApprovalRequired: Boolean(policy.communicationsApprovalRequired),
      fundingPackApprovalRequired: Boolean(policy.fundingPackApprovalRequired),
      executiveReportApprovalRequired: Boolean(policy.executiveReportApprovalRequired),
      separationOfDuties: Boolean(policy.separationOfDuties),
      approvalExpiryHours: Math.max(24, Number(policy.approvalExpiryHours) || 168),
    },
  });
  return normaliseEliteApprovalPolicy(result || policy);
}

export async function assignEliteSiteResponsibility(clubId, responsibility) {
  const result = await supaFetch("POST", "rpc/assign_elite_site_responsibility", {
    target_club_id: clubId,
    target_site_id: clean(responsibility.siteId),
    target_user_id: responsibility.userId,
    target_responsibility: responsibility.responsibility,
  });
  return normaliseEliteResponsibility(result || responsibility);
}

export async function removeEliteSiteResponsibility(clubId, responsibilityId) {
  await supaFetch("POST", "rpc/remove_elite_site_responsibility", {
    target_club_id: clubId,
    responsibility_id: responsibilityId,
  });
  return true;
}

export async function createEliteApprovalRequest(clubId, request) {
  const result = await supaFetch("POST", "rpc/create_elite_approval_request", {
    target_club_id: clubId,
    request_type: request.approvalType,
    request_entity_key: clean(request.entityKey),
    request_title: clean(request.title),
    request_summary: clean(request.summary),
    request_site_id: clean(request.siteId) || null,
    request_snapshot: request.snapshot && typeof request.snapshot === "object" ? request.snapshot : {},
  });
  return normaliseEliteApproval(result || request);
}

export async function decideEliteApproval(clubId, approvalId, decision, note = "") {
  const result = await supaFetch("POST", "rpc/decide_elite_approval", {
    target_club_id: clubId,
    approval_id: approvalId,
    decision,
    decision_note: clean(note),
  });
  return normaliseEliteApproval(result || { id: approvalId, status: decision });
}

export async function saveEliteCommunicationTemplate(clubId, template) {
  const result = await supaFetch("POST", "rpc/save_elite_communication_template", {
    target_club_id: clubId,
    template: {
      id: template.id || null,
      templateKey: template.templateKey,
      name: clean(template.name),
      subjectTemplate: clean(template.subjectTemplate),
      bodyTemplate: clean(template.bodyTemplate),
      active: template.active !== false,
      approvalRequired: Boolean(template.approvalRequired),
    },
  });
  return normaliseEliteTemplate(result || template);
}


export async function loadEliteCommunicationTemplates(clubId) {
  const club = encode(clubId);
  const rows = await supaFetch("GET", `elite_communication_templates?select=*&club_id=eq.${club}&active=eq.true&order=template_key.asc`);
  return asArray(rows).length
    ? asArray(rows).map(normaliseEliteTemplate)
    : DEFAULT_COMMUNICATION_TEMPLATES.map((item) => normaliseEliteTemplate({ ...item, clubId }));
}

export async function loadEliteApprovalState(clubId, approvalType, entityKey) {
  const club = encode(clubId);
  const type = encode(approvalType);
  const key = encode(entityKey);
  const [policyRows, approvalRows] = await Promise.all([
    supaFetch("GET", `elite_approval_policies?select=*&club_id=eq.${club}&limit=1`),
    supaFetch("GET", `elite_approval_requests?select=*&club_id=eq.${club}&approval_type=eq.${type}&entity_key=eq.${key}&order=requested_at.desc&limit=5`),
  ]);
  const policy = normaliseEliteApprovalPolicy(asArray(policyRows)[0] || { clubId });
  const approvals = asArray(approvalRows).map(normaliseEliteApproval);
  const approved = findCurrentApproval(approvals, approvalType, entityKey);
  const pending = approvals.find((item) => item.status === "pending") || null;
  return { policy, approvals, approved, pending };
}

export function summariseEliteFundingPortfolio(workspace = {}) {
  const projects = asArray(workspace.projects);
  const applications = asArray(workspace.applications);
  const tasks = asArray(workspace.applicationTasks);
  const obligations = asArray(workspace.monitoringObligations);
  const activeApplications = applications.filter((item) => !["awarded", "rejected", "withdrawn", "closed"].includes(clean(item.status).toLowerCase()));
  const dueSoon = [...tasks, ...obligations].filter((item) => {
    if (!item.dueDate || ["complete", "completed", "done"].includes(clean(item.status).toLowerCase())) return false;
    const due = new Date(`${item.dueDate}T23:59:59`);
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86400000);
    return Number.isFinite(due.getTime()) && due >= now && due <= horizon;
  });
  return {
    projectCount: projects.length,
    activeApplications: activeApplications.length,
    requestedAmount: applications.reduce((sum, item) => sum + Math.max(0, Number(item.requestedAmount) || 0), 0),
    awardedAmount: applications.reduce((sum, item) => sum + Math.max(0, Number(item.awardedAmount) || 0), 0),
    dueSoon,
    projects,
    applications,
  };
}

function fnv1a(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function buildEliteEntityKey(type, parts = []) {
  const content = asArray(parts).map((item) => String(item ?? "")).sort().join("|");
  return `elite:${clean(type).toLowerCase()}:${fnv1a(content)}`;
}

export function findCurrentApproval(approvals = [], approvalType, entityKey) {
  const now = Date.now();
  return asArray(approvals).find((item) => {
    if (item.approvalType !== approvalType || item.entityKey !== entityKey) return false;
    if (item.status !== "approved") return false;
    if (!item.expiresAt) return true;
    const expires = new Date(item.expiresAt).getTime();
    return Number.isFinite(expires) && expires > now;
  }) || null;
}
