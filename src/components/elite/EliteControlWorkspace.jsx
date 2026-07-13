import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Check,
  ClipboardCheck,
  FileCheck2,
  FileText,
  History,
  Loader2,
  MailCheck,
  MessageSquareText,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_COMMUNICATION_TEMPLATES,
  ELITE_APPROVAL_TYPES,
  ELITE_RESPONSIBILITIES,
  assignEliteSiteResponsibility,
  cancelEliteApprovalRequest,
  createEliteApprovalRequest,
  decideEliteApproval,
  loadEliteGovernanceWorkspace,
  removeEliteSiteResponsibility,
  saveEliteApprovalPolicy,
  saveEliteCommunicationTemplate,
  summariseEliteFundingPortfolio,
} from "../../lib/elite/eliteGovernanceService.js";
import { buildFundingPackApprovalKey, buildFundingPackSnapshot } from "../../lib/elite/eliteApprovalSnapshots.js";

const TABS = Object.freeze([
  ["approvals", "Approvals", ClipboardCheck],
  ["responsibilities", "Site responsibility", UserRoundCog],
  ["funding", "Funding portfolio", Banknote],
  ["communications", "Communication controls", MailCheck],
  ["audit", "Governance audit", History],
]);

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
const textareaClass = "min-h-[110px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
const buttonPrimary = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
const buttonSecondary = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

const SUPPORTED_TEMPLATE_TOKENS = new Set(["coach", "team", "opposition", "date", "kickoff", "venue", "pitch"]);

function templateTokenWarnings(template = {}) {
  const content = `${template.subjectTemplate || ""}\n${template.bodyTemplate || ""}`;
  const tokens = [...content.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((match) => clean(match[1]).toLowerCase());
  return [...new Set(tokens.filter((token) => !SUPPORTED_TEMPLATE_TOKENS.has(token)))];
}

function previewTemplate(value = "") {
  const sample = { coach: "Jamie", team: "U16 Cheetahs", opposition: "Rovers", date: "Saturday 18 July", kickoff: "10:00", venue: "Main Ground", pitch: "Pitch 2" };
  return String(value || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, token) => sample[clean(token).toLowerCase()] || `{{${token}}}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return String(value ?? "").trim();
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function memberId(member = {}) {
  return member.user_id || member.userId || member.id || "";
}

function memberLabel(member = {}) {
  return clean(member.display_name || member.displayName || member.email || memberId(member)) || "Club member";
}

function approvalTypeLabel(value) {
  return {
    matchweek: "Matchweek",
    communications: "Communications",
    funding_pack: "Funding pack",
    executive_report: "Executive report",
  }[value] || value;
}

function statusTone(status) {
  return {
    pending: "border-amber-200 bg-amber-50 text-amber-900",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rejected: "border-rose-200 bg-rose-50 text-rose-900",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
    expired: "border-slate-200 bg-slate-100 text-slate-700",
  }[status] || "border-slate-200 bg-slate-100 text-slate-700";
}

function Panel({ eyebrow, title, description, action, children }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</div>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h3>
          {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyBlock({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <div className="text-sm font-black text-slate-900">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function ToggleRow({ label, detail, checked, onChange, disabled }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span>
        <span className="block text-sm font-black text-slate-950">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{detail}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} className="mt-1 h-5 w-5 accent-emerald-600" />
    </label>
  );
}

function SnapshotDetails({ snapshot = {} }) {
  const rows = [
    ["Content hash", snapshot.contentHash],
    ["Fixtures", snapshot.fixtureCount],
    ["Unresolved", snapshot.unresolvedCount],
    ["Recipients", snapshot.recipientCount],
    ["Sites", snapshot.metrics?.siteCount],
    ["Governance score", snapshot.metrics?.governanceScore != null ? `${snapshot.metrics.governanceScore}%` : null],
    ["Project", snapshot.project?.title],
    ["Templates", Array.isArray(snapshot.templates) ? snapshot.templates.join(", ") : null],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");
  return (
    <details className="mt-4 rounded-2xl border border-amber-200 bg-white/80 p-3">
      <summary className="cursor-pointer text-xs font-black text-slate-800">Review exact approval snapshot</summary>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-3 py-2"><div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div><div className="mt-1 break-words text-xs font-bold text-slate-800">{String(value)}</div></div>)}
      </div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-[10px] leading-5 text-slate-200">{JSON.stringify(snapshot, null, 2)}</pre>
    </details>
  );
}

function ApprovalsPanel({ data, model, clubId, canManage, canOperate, activeUserId, approvalArtifacts, onRefresh }) {
  const [policy, setPolicy] = useState(data.policy);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState({});
  const [working, setWorking] = useState("");

  useEffect(() => setPolicy(data.policy), [data.policy]);

  const matchweekArtifact = approvalArtifacts?.matchweek || {};
  const executiveArtifact = approvalArtifacts?.executive || {};
  const matchweekKey = matchweekArtifact.entityKey || "";
  const executiveKey = executiveArtifact.entityKey || "";

  const savePolicy = async () => {
    setSavingPolicy(true);
    try {
      await saveEliteApprovalPolicy(clubId, policy);
      toast.success("Elite approval policy saved");
      await onRefresh();
    } catch (error) {
      toast.error("Approval policy could not be saved", { description: error?.message });
    } finally {
      setSavingPolicy(false);
    }
  };

  const requestApproval = async (type, entityKey, title, summary, snapshot = {}) => {
    setWorking(entityKey);
    try {
      await createEliteApprovalRequest(clubId, { approvalType: type, entityKey, title, summary, snapshot });
      toast.success("Approval requested");
      await onRefresh();
    } catch (error) {
      toast.error("Approval request could not be created", { description: error?.message });
    } finally {
      setWorking("");
    }
  };

  const decide = async (approval, decision) => {
    setWorking(approval.id);
    try {
      await decideEliteApproval(clubId, approval.id, decision, decisionNotes[approval.id] || "");
      toast.success(decision === "approved" ? "Approval granted" : "Approval rejected");
      await onRefresh();
    } catch (error) {
      toast.error("Approval could not be updated", { description: error?.message });
    } finally {
      setWorking("");
    }
  };

  const cancel = async (approval) => {
    setWorking(approval.id);
    try {
      await cancelEliteApprovalRequest(clubId, approval.id, decisionNotes[approval.id] || "Cancelled by requester");
      toast.success("Approval request cancelled");
      await onRefresh();
    } catch (error) {
      toast.error("Approval request could not be cancelled", { description: error?.message });
    } finally {
      setWorking("");
    }
  };

  const pending = data.approvals.filter((item) => item.status === "pending");

  return (
    <div className="space-y-5">
      <Panel eyebrow="Control policy" title="Approval rules" description="Choose which high-impact Elite actions require a separate recorded decision before release." action={canManage ? <button type="button" onClick={savePolicy} disabled={savingPolicy} className={buttonPrimary}>{savingPolicy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save policy</button> : null}>
        <div className="grid gap-3 lg:grid-cols-2">
          <ToggleRow label="Matchweek publication" detail="Require approval before the organisation treats a matchweek as released." checked={policy.matchweekApprovalRequired} onChange={(value) => setPolicy((current) => ({ ...current, matchweekApprovalRequired: value }))} disabled={!canManage} />
          <ToggleRow label="Coach communications" detail="Require an approved exact message batch before a provider can send it." checked={policy.communicationsApprovalRequired} onChange={(value) => setPolicy((current) => ({ ...current, communicationsApprovalRequired: value }))} disabled={!canManage} />
          <ToggleRow label="Funding application packs" detail="Require senior review before an application evidence pack is treated as approved." checked={policy.fundingPackApprovalRequired} onChange={(value) => setPolicy((current) => ({ ...current, fundingPackApprovalRequired: value }))} disabled={!canManage} />
          <ToggleRow label="Executive board reports" detail="Require approval before an executive pack is released outside the organisation." checked={policy.executiveReportApprovalRequired} onChange={(value) => setPolicy((current) => ({ ...current, executiveReportApprovalRequired: value }))} disabled={!canManage} />
          <ToggleRow label="Separation of duties" detail="The person requesting approval cannot approve their own item." checked={policy.separationOfDuties} onChange={(value) => setPolicy((current) => ({ ...current, separationOfDuties: value }))} disabled={!canManage} />
          <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <span className="block text-sm font-black text-slate-950">Approval validity</span>
            <span className="mt-1 block text-xs font-semibold text-slate-500">Hours before an approval expires and must be reviewed again.</span>
            <input type="number" min="24" max="720" value={policy.approvalExpiryHours} onChange={(event) => setPolicy((current) => ({ ...current, approvalExpiryHours: Number(event.target.value) || 168 }))} disabled={!canManage} className={`${inputClass} mt-3`} />
          </label>
        </div>
      </Panel>

      <Panel eyebrow="Release control" title="Request approval" description="Create a recorded request from the current organisation state. Coach-message requests are created automatically from the exact sending queue.">
        <div className="grid gap-3 lg:grid-cols-2">
          <button type="button" disabled={!canOperate || !matchweekKey || working === matchweekKey} onClick={() => requestApproval(ELITE_APPROVAL_TYPES.MATCHWEEK, matchweekKey, `${model.periodLabel || "Current matchweek"} release`, `${model.fixtureCount} scheduled fixtures across ${model.siteCount} sites, with ${model.unresolvedCount} unresolved.`, matchweekArtifact.snapshot || {})} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40">
            <div className="flex items-center gap-3 text-sm font-black text-slate-950"><FileCheck2 size={18} className="text-emerald-700" /> Current matchweek</div>
            <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">Request release approval for the exact cross-site schedule currently shown in Organisation Command.</div>
          </button>
          <button type="button" disabled={!canOperate || !executiveKey || working === executiveKey} onClick={() => requestApproval(ELITE_APPROVAL_TYPES.EXECUTIVE_REPORT, executiveKey, `${model.periodLabel || "Current"} executive organisation report`, `${model.governanceScore}% governance readiness and ${model.actions.length} open organisation actions.`, executiveArtifact.snapshot || {})} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-40">
            <div className="flex items-center gap-3 text-sm font-black text-slate-950"><FileText size={18} className="text-emerald-700" /> Executive board report</div>
            <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">Request approval for the current executive operating picture and governance summary.</div>
          </button>
        </div>
      </Panel>

      <Panel eyebrow="Decision queue" title={`Pending approvals · ${pending.length}`} description="Approvers see the exact snapshot requested, the requester and the expiry time.">
        {!pending.length ? <EmptyBlock title="No approvals waiting" description="New requests will appear here for a separate reviewer or administrator." /> : (
          <div className="space-y-3">
            {pending.map((approval) => {
              const canReviewApproval = canManage || Boolean(approval.siteId && data.responsibilities.some((item) => item.userId === activeUserId && item.siteId === approval.siteId && ["site_admin", "reviewer"].includes(item.responsibility)));
              const canCancelApproval = canManage || approval.requestedBy === activeUserId;
              return (
              <article key={approval.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-900">{approvalTypeLabel(approval.approvalType)}</span>
                      <span className="text-xs font-bold text-amber-800">Expires {formatDate(approval.expiresAt)}</span>
                    </div>
                    <h4 className="mt-3 text-base font-black text-slate-950">{approval.title}</h4>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{approval.summary || "No additional summary was supplied."}</p>
                    <div className="mt-2 text-xs font-bold text-slate-500">Requested by {approval.requestedByLabel || "Club member"} · {formatDate(approval.requestedAt)}{approval.siteId ? ` · Site ${approval.siteId}` : " · Organisation-wide"}</div>
                    <SnapshotDetails snapshot={approval.snapshot} />
                  </div>
                  <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${statusTone(approval.status)}`}>{approval.status}</span>
                </div>
                {canReviewApproval ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <input className={inputClass} value={decisionNotes[approval.id] || ""} onChange={(event) => setDecisionNotes((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Decision note (required for rejection)" />
                    <div className="flex gap-2">
                      <button type="button" disabled={working === approval.id} onClick={() => decide(approval, "approved")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-40"><Check size={15} /> Approve</button>
                      <button type="button" disabled={working === approval.id || clean(decisionNotes[approval.id]).length < 3} onClick={() => decide(approval, "rejected")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-black text-white disabled:opacity-40"><X size={15} /> Reject</button>
                    </div>
                  </div>
                ) : <div className="mt-4 text-xs font-bold text-amber-900">Organisation-wide decisions require a club owner or administrator. Site reviewers can only decide requests scoped to their assigned site.</div>}
                {canCancelApproval ? <button type="button" disabled={working === approval.id} onClick={() => cancel(approval)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"><Trash2 size={14} /> Cancel request</button> : null}
              </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ResponsibilitiesPanel({ data, sites, clubId, canManage, activeUserId, onRefresh }) {
  const [siteId, setSiteId] = useState(sites[0]?.id || "");
  const [userId, setUserId] = useState("");
  const [responsibility, setResponsibility] = useState("site_lead");
  const [working, setWorking] = useState(false);
  const members = data.members;
  const membersById = useMemo(() => new Map(members.map((member) => [memberId(member), member])), [members]);
  const sitesById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);

  useEffect(() => {
    if (!userId && members.length) setUserId(memberId(members[0]));
  }, [members, userId]);

  const assign = async () => {
    if (!siteId || !userId) return;
    setWorking(true);
    try {
      await assignEliteSiteResponsibility(clubId, { siteId, userId, responsibility });
      toast.success("Site responsibility assigned");
      await onRefresh();
    } catch (error) {
      toast.error("Responsibility could not be assigned", { description: error?.message });
    } finally {
      setWorking(false);
    }
  };

  const remove = async (id) => {
    setWorking(true);
    try {
      await removeEliteSiteResponsibility(clubId, id);
      toast.success("Site responsibility removed");
      await onRefresh();
    } catch (error) {
      toast.error("Responsibility could not be removed", { description: error?.message });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel eyebrow="Delegation" title="Assign site responsibility" description="Record who leads, administers, reviews or receives executive visibility for each venue. Existing workspace roles remain the security boundary; these assignments add Elite governance and approval authority." action={<span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-sky-800">Governed responsibility</span>}>
        {canManage ? (
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <select className={inputClass} value={siteId} onChange={(event) => setSiteId(event.target.value)}>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select>
            <select className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)}>{members.map((member) => <option key={memberId(member)} value={memberId(member)}>{memberLabel(member)}</option>)}</select>
            <select className={inputClass} value={responsibility} onChange={(event) => setResponsibility(event.target.value)}>{ELITE_RESPONSIBILITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <button type="button" onClick={assign} disabled={working || !siteId || !userId} className={buttonPrimary}><Plus size={15} /> Assign</button>
          </div>
        ) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">Only a club owner or administrator can change site responsibilities.</div>}
      </Panel>

      <Panel eyebrow="Coverage" title="Current responsibility map" description="Review named accountability across the organisation and identify sites without delegated leadership.">
        {!data.responsibilities.length ? <EmptyBlock title="No delegated responsibilities" description="Assign at least one site lead and one reviewer for each active venue." /> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.responsibilities.map((item) => {
              const member = membersById.get(item.userId);
              const site = sitesById.get(item.siteId);
              const role = ELITE_RESPONSIBILITIES.find((entry) => entry.value === item.responsibility)?.label || item.responsibility;
              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">{site?.name || item.siteId}</div>
                      <div className="mt-2 text-base font-black text-slate-950">{memberLabel(member || { userId: item.userId })}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500">{role}{item.userId === activeUserId ? " · You" : ""}</div>
                    </div>
                    {canManage ? <button type="button" onClick={() => remove(item.id)} disabled={working} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50" aria-label="Remove responsibility"><Trash2 size={15} /></button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function FundingPanel({ data, clubId, canOperate, onRefresh, onOpenAnalytics }) {
  const portfolio = useMemo(() => summariseEliteFundingPortfolio(data.funding), [data.funding]);
  const [working, setWorking] = useState("");

  const fundingArtifact = (project) => {
    const snapshot = buildFundingPackSnapshot({
      project,
      applications: data.funding.applications,
      tasks: data.funding.applicationTasks,
      obligations: data.funding.monitoringObligations,
      impactEvidence: data.funding.impactEvidence,
    });
    return { snapshot, entityKey: buildFundingPackApprovalKey(snapshot) };
  };

  const requestPack = async (project) => {
    const artifact = fundingArtifact(project);
    setWorking(project.id);
    try {
      await createEliteApprovalRequest(clubId, {
        approvalType: ELITE_APPROVAL_TYPES.FUNDING_PACK,
        entityKey: artifact.entityKey,
        title: `${project.title || "Funding project"} application pack`,
        summary: `${formatMoney(project.targetFunding)} target funding. Project status: ${project.status || "planning"}.`,
        snapshot: artifact.snapshot,
      });
      toast.success("Funding pack approval requested");
      await onRefresh();
    } catch (error) {
      toast.error("Funding approval could not be requested", { description: error?.message });
    } finally {
      setWorking("");
    }
  };

  return (
    <div className="space-y-5">
      <Panel eyebrow="Organisation funding" title="Funding portfolio" description="See all funding projects, live applications and approaching evidence obligations across the organisation." action={<button type="button" onClick={onOpenAnalytics} className={buttonSecondary}><Banknote size={15} /> Open Funding Analytics</button>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Projects", portfolio.projectCount, "planned and active"],
            ["Active applications", portfolio.activeApplications, "not yet closed"],
            ["Requested", formatMoney(portfolio.requestedAmount), "across tracked applications"],
            ["Awarded", formatMoney(portfolio.awardedAmount), "confirmed funding"],
          ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>)}
        </div>
      </Panel>

      <Panel eyebrow="Projects" title="Application-pack control" description="Request senior approval for a project pack before it is treated as organisation-approved evidence.">
        {!portfolio.projects.length ? <EmptyBlock title="No funding projects" description="Create projects in Analytics → Funding before using organisation-wide funding control." /> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {portfolio.projects.map((project) => {
              const artifact = fundingArtifact(project);
              const approval = data.approvals.find((item) => item.approvalType === ELITE_APPROVAL_TYPES.FUNDING_PACK && item.entityKey === artifact.entityKey && ["pending", "approved"].includes(item.status));
              return <article key={project.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div><div className="text-base font-black text-slate-950">{project.title || "Untitled funding project"}</div><div className="mt-1 text-xs font-bold text-slate-500">{project.status || "planning"} · target {formatMoney(project.targetFunding)}</div></div>{approval ? <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${statusTone(approval.status)}`}>{approval.status}</span> : null}</div>
                <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{project.summary || "No project summary has been recorded."}</p>
                <button type="button" disabled={!canOperate || working === project.id || approval?.status === "pending"} onClick={() => requestPack(project)} className={`${buttonPrimary} mt-4`}><FileCheck2 size={15} /> {approval?.status === "approved" ? "Request refreshed approval" : approval?.status === "pending" ? "Approval pending" : "Request pack approval"}</button>
              </article>;
            })}
          </div>
        )}
      </Panel>

      <Panel eyebrow="Deadlines" title="Next 30 days" description="Tasks and monitoring obligations that could affect an application or funding agreement.">
        {!portfolio.dueSoon.length ? <EmptyBlock title="No upcoming funding deadlines" description="Tracked application tasks and monitoring obligations due within 30 days will appear here." /> : <div className="space-y-2">{portfolio.dueSoon.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div><div className="text-sm font-black text-slate-950">{item.title}</div><div className="mt-1 text-xs font-bold text-slate-500">Owner: {item.ownerName || "Not assigned"}</div></div><div className="shrink-0 text-xs font-black text-amber-900">Due {item.dueDate}</div></div>)}</div>}
      </Panel>
    </div>
  );
}

function CommunicationsGovernancePanel({ data, clubId, canManage, onRefresh, onOpenCommunications }) {
  const [templates, setTemplates] = useState(data.templates.length ? data.templates : DEFAULT_COMMUNICATION_TEMPLATES);
  const [saving, setSaving] = useState("");
  useEffect(() => setTemplates(data.templates.length ? data.templates : DEFAULT_COMMUNICATION_TEMPLATES), [data.templates]);

  const update = (key, patch) => setTemplates((rows) => rows.map((row) => row.templateKey === key ? { ...row, ...patch } : row));
  const save = async (template) => {
    setSaving(template.templateKey);
    try {
      await saveEliteCommunicationTemplate(clubId, template);
      toast.success(`${template.name} template saved`);
      await onRefresh();
    } catch (error) {
      toast.error("Communication template could not be saved", { description: error?.message });
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="space-y-5">
      <Panel eyebrow="Communication governance" title="Controlled club templates" description="Central administrators control the approved wording standard. Tokens are resolved from the latest fixture and adult coach-contact records when a message is prepared." action={<button type="button" onClick={onOpenCommunications} className={buttonSecondary}><MessageSquareText size={15} /> Open Communications</button>}>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950"><strong>Supported tokens:</strong> {"{{coach}} · {{team}} · {{opposition}} · {{date}} · {{kickoff}} · {{venue}} · {{pitch}}"}. Provider delivery still uses the exact reviewed message snapshot and provider-confirmed status.</div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        {templates.map((template) => (
          <Panel key={template.templateKey} eyebrow={template.templateKey.replaceAll("_", " ")} title={template.name} description="Controlled operational wording; never combine service messages with marketing content." action={canManage ? <button type="button" onClick={() => save(template)} disabled={saving === template.templateKey || templateTokenWarnings(template).length > 0} className={buttonPrimary}>{saving === template.templateKey ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button> : null}>
            <div className="space-y-3">
              <label><span className="mb-1.5 block text-xs font-black text-slate-700">Template name</span><input className={inputClass} value={template.name} onChange={(event) => update(template.templateKey, { name: event.target.value })} disabled={!canManage} /></label>
              <label><span className="mb-1.5 block text-xs font-black text-slate-700">Subject</span><input className={inputClass} value={template.subjectTemplate} onChange={(event) => update(template.templateKey, { subjectTemplate: event.target.value })} disabled={!canManage} /></label>
              <label><span className="mb-1.5 block text-xs font-black text-slate-700">Message body</span><textarea className={textareaClass} value={template.bodyTemplate} onChange={(event) => update(template.templateKey, { bodyTemplate: event.target.value })} disabled={!canManage} /></label>
              {templateTokenWarnings(template).length ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">Unsupported token{templateTokenWarnings(template).length === 1 ? "" : "s"}: {templateTokenWarnings(template).map((token) => `{{${token}}}`).join(", ")}. Remove or replace before saving.</div> : null}
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-black text-slate-800">Preview with sample fixture</summary><div className="mt-3 rounded-xl bg-white p-3"><div className="text-xs font-black text-slate-950">{previewTemplate(template.subjectTemplate)}</div><div className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-slate-600">{previewTemplate(template.bodyTemplate)}</div></div></details>
              <div className="grid gap-3 sm:grid-cols-2">
                <ToggleRow label="Template active" detail="Available to the organisation message workflow." checked={template.active !== false} onChange={(value) => update(template.templateKey, { active: value })} disabled={!canManage} />
                <ToggleRow label="Approval required" detail="Exact batches using this template need release approval." checked={Boolean(template.approvalRequired)} onChange={(value) => update(template.templateKey, { approvalRequired: value })} disabled={!canManage} />
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function AuditPanel({ data }) {
  const eliteEvents = asArray(data.auditEvents).filter((event) => {
    const action = clean(event.action || event.event_type || event.eventType);
    return action.startsWith("elite.") || ["matchweek.publish", "communication.batch.create", "communication.delivery.complete"].includes(action);
  });
  const approvalHistory = data.approvals.filter((item) => item.status !== "pending");
  return (
    <div className="space-y-5">
      <Panel eyebrow="Decision history" title="Approval audit" description="A readable record of approved, rejected, expired and superseded organisation decisions.">
        {!approvalHistory.length ? <EmptyBlock title="No completed approval decisions" description="Approval decisions will remain attributable to the requester and reviewer." /> : <div className="space-y-2">{approvalHistory.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{item.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{approvalTypeLabel(item.approvalType)} · requested by {item.requestedByLabel || "Club member"}</div></div><span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${statusTone(item.status)}`}>{item.status}</span></div>{item.decisionAt ? <div className="mt-3 text-xs font-bold text-slate-500">Decision by {item.decisionByLabel || "Club reviewer"} · {formatDate(item.decisionAt)}{item.decisionNote ? ` · ${item.decisionNote}` : ""}</div> : null}</div>)}</div>}
      </Panel>
      <Panel eyebrow="Database audit" title="Elite governance events" description="These events are written into the existing organisation audit trail by secure database functions.">
        {!eliteEvents.length ? <EmptyBlock title="No Elite governance events loaded" description="Save a policy, assign responsibility or make an approval decision to create the first event." /> : <div className="space-y-2">{eliteEvents.slice(0, 50).map((event, index) => <div key={event.id || `${event.action}-${index}`} className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-black text-slate-950">{event.action || event.event_type}</div><div className="mt-1 text-xs font-semibold text-slate-500">{event.actor_display_name || event.actor_email || "Club member"}</div></div><div className="text-xs font-bold text-slate-500">{formatDate(event.created_at || event.createdAt)}</div></div>)}</div>}
      </Panel>
    </div>
  );
}

export default function EliteControlWorkspace({
  clubId,
  sites,
  model,
  workspaceAccess,
  activeUserId,
  approvalArtifacts,
  onResponsibilitiesChange,
  onOpenAnalytics,
  onOpenCommunications,
}) {
  const [tab, setTab] = useState("approvals");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!clubId) return;
    setStatus("loading");
    setError("");
    try {
      const nextData = await loadEliteGovernanceWorkspace(clubId);
      setData(nextData);
      onResponsibilitiesChange?.(nextData.responsibilities);
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError?.message || "Elite governance information could not be loaded.");
    }
  }, [clubId, onResponsibilitiesChange]);

  useEffect(() => { refresh(); }, [refresh]);

  const canManage = Boolean(workspaceAccess?.canManageSettings) && !workspaceAccess?.isReadOnly;
  const canOperate = Boolean(workspaceAccess?.canOperate) && !workspaceAccess?.isReadOnly;

  return (
    <section className="space-y-5">
      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Elite organisation controls">
          {TABS.map(([value, label, Icon]) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-xs font-black transition ${tab === value ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={16} /> {label}</button>)}
        </div>
      </div>

      {status === "loading" ? <div className="flex min-h-[260px] items-center justify-center rounded-[28px] border border-slate-200 bg-white"><Loader2 size={28} className="animate-spin text-emerald-600" /></div> : null}
      {status === "error" ? <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-amber-950"><div className="flex items-center gap-3 text-base font-black"><AlertTriangle size={20} /> Elite Phase 2 database update required</div><p className="mt-2 max-w-3xl text-sm font-semibold leading-6">{error}</p><button type="button" onClick={refresh} className={`${buttonSecondary} mt-4`}><RefreshCw size={15} /> Retry</button></div> : null}

      {status === "ready" && data ? (
        <>
          {Object.keys(data.errors || {}).length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Some Elite sections could not be loaded: {Object.entries(data.errors).map(([key, value]) => `${key}: ${value}`).join(" · ")}</div> : null}
          {tab === "approvals" ? <ApprovalsPanel data={data} model={model} clubId={clubId} canManage={canManage} canOperate={canOperate} activeUserId={activeUserId} approvalArtifacts={approvalArtifacts} onRefresh={refresh} /> : null}
          {tab === "responsibilities" ? <ResponsibilitiesPanel data={data} sites={sites} clubId={clubId} canManage={canManage} activeUserId={activeUserId} onRefresh={refresh} /> : null}
          {tab === "funding" ? <FundingPanel data={data} clubId={clubId} canOperate={canOperate} onRefresh={refresh} onOpenAnalytics={onOpenAnalytics} /> : null}
          {tab === "communications" ? <CommunicationsGovernancePanel data={data} clubId={clubId} canManage={canManage} onRefresh={refresh} onOpenCommunications={onOpenCommunications} /> : null}
          {tab === "audit" ? <AuditPanel data={data} /> : null}
        </>
      ) : null}
    </section>
  );
}
