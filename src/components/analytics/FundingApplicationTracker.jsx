import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ListChecks,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import ConfirmDialog from "../../ui/ConfirmDialog.jsx";
import ProgressBar from "../../ui/ProgressBar.jsx";
import StatusChip from "../../ui/StatusChip.jsx";

export const APPLICATION_STATUS_OPTIONS = [
  ["considering", "Considering"],
  ["checking_eligibility", "Checking eligibility"],
  ["preparing", "Preparing evidence"],
  ["awaiting_quotes", "Awaiting quotations"],
  ["ready_to_apply", "Ready to apply"],
  ["submitted", "Submitted"],
  ["further_information", "Further information requested"],
  ["awarded", "Awarded"],
  ["unsuccessful", "Unsuccessful"],
  ["withdrawn", "Withdrawn"],
  ["closed", "Closed"],
];

const TASK_STATUS_OPTIONS = [
  ["todo", "To do"],
  ["in_progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
];

const PRIORITY_OPTIONS = [
  ["low", "Low"],
  ["medium", "Medium"],
  ["high", "High"],
  ["critical", "Critical"],
];

const MONITORING_STATUS_OPTIONS = [
  ["pending", "Pending"],
  ["in_progress", "In progress"],
  ["submitted", "Submitted"],
  ["accepted", "Accepted"],
  ["overdue", "Overdue"],
  ["not_required", "Not required"],
];

const INPUT_CLASS = "mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";
const TEXTAREA_CLASS = "mt-2 min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function createApplicationDraft(project, programme) {
  return {
    id: "",
    projectId: project?.id || "",
    programmeId: programme?.id || project?.selectedProgrammeId || "",
    status: "considering",
    ownerName: "",
    ownerEmail: "",
    deadline: programme?.deadline || "",
    requestedAmount: Number(project?.targetFunding || 0),
    awardedAmount: 0,
    applicationReference: "",
    submittedAt: "",
    expectedDecisionDate: "",
    decisionDate: "",
    decisionNotes: "",
    fundingConditions: "",
    nextAction: "Confirm eligibility and programme deadline.",
    notes: "",
  };
}

function createTaskDraft(ownerName = "") {
  return { id: "", title: "", status: "todo", priority: "medium", ownerName, dueDate: "", notes: "" };
}

function createObligationDraft(ownerName = "") {
  return {
    id: "",
    title: "",
    status: "pending",
    dueDate: "",
    reportingPeriodStart: "",
    reportingPeriodEnd: "",
    evidenceRequired: "",
    ownerName,
    notes: "",
  };
}

function formatMoney(value) {
  const number = Number(value || 0);
  return number ? `£${number.toLocaleString("en-GB", { maximumFractionDigits: 0 })}` : "Not set";
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dateDistance(value) {
  if (!value) return { label: "No deadline", tone: "neutral", days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`, tone: "danger", days };
  if (days === 0) return { label: "Due today", tone: "danger", days };
  if (days <= 7) return { label: `${days} day${days === 1 ? "" : "s"} remaining`, tone: "warning", days };
  return { label: `${days} days remaining`, tone: "success", days };
}

function statusTone(status) {
  if (["awarded", "accepted", "done"].includes(status)) return "success";
  if (["unsuccessful", "withdrawn", "overdue", "blocked"].includes(status)) return "danger";
  if (["submitted", "ready_to_apply", "in_progress", "further_information"].includes(status)) return "warning";
  return "neutral";
}

function Metric({ label, value, detail, icon: Icon, tone = "slate" }) {
  const style = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
  }[tone];
  return (
    <div className={`rounded-[22px] border p-4 ${style}`}>
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-65">{label}</div><div className="mt-2 text-2xl font-black">{value}</div></div>
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/70 ring-1 ring-black/5"><Icon size={18} /></div>
      </div>
      <div className="mt-2 text-xs font-bold leading-5 opacity-75">{detail}</div>
    </div>
  );
}

function TaskRow({ task, canManage, busy, onSave, onDelete }) {
  const [draft, setDraft] = useState(task);
  useEffect(() => setDraft(task), [task]);
  const overdue = draft.status !== "done" && dateDistance(draft.dueDate).days < 0;
  return (
    <div className={`rounded-[22px] border p-4 ${overdue ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-white"}`}>
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.4fr)_150px_140px_170px_160px_auto]">
        <Field label="Task"><input className={INPUT_CLASS} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Status"><select className={INPUT_CLASS} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} disabled={!canManage}>{TASK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Priority"><select className={INPUT_CLASS} value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))} disabled={!canManage}>{PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Owner"><input className={INPUT_CLASS} value={draft.ownerName} onChange={(event) => setDraft((current) => ({ ...current, ownerName: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Due date"><input className={INPUT_CLASS} type="date" value={draft.dueDate || ""} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManage} /></Field>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => onSave(draft)} disabled={!canManage || busy || !draft.title.trim()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-40"><Save size={15} /> Save</button>
          <button type="button" onClick={() => onDelete(task)} disabled={!canManage || busy} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40" aria-label={`Remove ${task.title}`}><Trash2 size={16} /></button>
        </div>
      </div>
      {overdue ? <div className="mt-3 flex items-center gap-2 text-xs font-black text-rose-700"><AlertTriangle size={14} /> This task is overdue and still open.</div> : null}
    </div>
  );
}

function ObligationRow({ obligation, canManage, busy, onSave, onDelete }) {
  const [draft, setDraft] = useState(obligation);
  useEffect(() => setDraft(obligation), [obligation]);
  const overdue = !["accepted", "submitted", "not_required"].includes(draft.status) && dateDistance(draft.dueDate).days < 0;
  return (
    <div className={`rounded-[22px] border p-4 ${overdue ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-white"}`}>
      <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.2fr)_170px_160px_160px_auto]">
        <Field label="Monitoring requirement"><input className={INPUT_CLASS} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Status"><select className={INPUT_CLASS} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} disabled={!canManage}>{MONITORING_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Owner"><input className={INPUT_CLASS} value={draft.ownerName} onChange={(event) => setDraft((current) => ({ ...current, ownerName: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Due date"><input className={INPUT_CLASS} type="date" value={draft.dueDate || ""} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManage} /></Field>
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => onSave(draft)} disabled={!canManage || busy || !draft.title.trim()} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-40"><Save size={15} /> Save</button>
          <button type="button" onClick={() => onDelete(obligation)} disabled={!canManage || busy} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-40" aria-label={`Remove ${obligation.title}`}><Trash2 size={16} /></button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label="Reporting period start"><input className={INPUT_CLASS} type="date" value={draft.reportingPeriodStart || ""} onChange={(event) => setDraft((current) => ({ ...current, reportingPeriodStart: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Reporting period end"><input className={INPUT_CLASS} type="date" value={draft.reportingPeriodEnd || ""} onChange={(event) => setDraft((current) => ({ ...current, reportingPeriodEnd: event.target.value }))} disabled={!canManage} /></Field>
        <Field label="Evidence required"><input className={INPUT_CLASS} value={draft.evidenceRequired || ""} onChange={(event) => setDraft((current) => ({ ...current, evidenceRequired: event.target.value }))} placeholder="e.g. invoices, photos and participation figures" disabled={!canManage} /></Field>
      </div>
    </div>
  );
}

export default function FundingApplicationTracker({
  project,
  programme,
  applications,
  tasks,
  obligations,
  canManage,
  trackerMode = "local",
  busyKey,
  onSaveApplication,
  onDeleteApplication,
  onSaveTask,
  onDeleteTask,
  onSaveObligation,
  onDeleteObligation,
}) {
  const projectApplications = useMemo(() => applications.filter((item) => item.projectId === project?.id), [applications, project?.id]);
  const [activeId, setActiveId] = useState(projectApplications[0]?.id || "");
  const active = projectApplications.find((item) => item.id === activeId) || null;
  const [draft, setDraft] = useState(() => active || createApplicationDraft(project, programme));
  const [taskDraft, setTaskDraft] = useState(() => createTaskDraft(active?.ownerName));
  const [obligationDraft, setObligationDraft] = useState(() => createObligationDraft(active?.ownerName));
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (!projectApplications.length) {
      setActiveId("");
      setDraft(createApplicationDraft(project, programme));
      return;
    }
    const selected = projectApplications.find((item) => item.id === activeId) || projectApplications[0];
    setActiveId(selected.id);
    setDraft(selected);
  }, [project?.id, projectApplications]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!draft.id) setDraft((current) => ({ ...current, programmeId: programme?.id || project?.selectedProgrammeId || current.programmeId, requestedAmount: Number(project?.targetFunding || current.requestedAmount || 0) }));
  }, [programme?.id, project?.selectedProgrammeId, project?.targetFunding]);

  const applicationTasks = tasks.filter((item) => item.applicationId === activeId);
  const applicationObligations = obligations.filter((item) => item.applicationId === activeId);
  const openTasks = applicationTasks.filter((item) => item.status !== "done");
  const overdueTasks = openTasks.filter((item) => dateDistance(item.dueDate).days < 0);
  const completedTasks = applicationTasks.filter((item) => item.status === "done").length;
  const taskProgress = applicationTasks.length ? Math.round((completedTasks / applicationTasks.length) * 100) : 0;
  const deadline = dateDistance(draft.deadline);
  const outstandingMonitoring = applicationObligations.filter((item) => !["accepted", "submitted", "not_required"].includes(item.status));
  const overdueMonitoring = outstandingMonitoring.filter((item) => dateDistance(item.dueDate).days < 0);
  const statusLabel = Object.fromEntries(APPLICATION_STATUS_OPTIONS)[draft.status] || draft.status;

  const selectApplication = (id) => {
    const item = projectApplications.find((candidate) => candidate.id === id);
    setActiveId(id);
    setDraft(item || createApplicationDraft(project, programme));
    setTaskDraft(createTaskDraft(item?.ownerName || ""));
    setObligationDraft(createObligationDraft(item?.ownerName || ""));
  };

  const saveApplication = async () => {
    const saved = await onSaveApplication(draft);
    if (saved) {
      setActiveId(saved.id);
      setDraft(saved);
      setTaskDraft((current) => ({ ...current, ownerName: current.ownerName || saved.ownerName }));
      setObligationDraft((current) => ({ ...current, ownerName: current.ownerName || saved.ownerName }));
    }
  };

  const addTask = async () => {
    if (!activeId) return toast.error("Save the application first");
    const saved = await onSaveTask({ ...taskDraft, applicationId: activeId });
    if (saved) setTaskDraft(createTaskDraft(draft.ownerName));
  };

  const addObligation = async () => {
    if (!activeId) return toast.error("Save the application first");
    const saved = await onSaveObligation({ ...obligationDraft, applicationId: activeId });
    if (saved) setObligationDraft(createObligationDraft(draft.ownerName));
  };

  if (!project?.id) {
    return <div className="mt-6 rounded-[26px] border border-amber-200 bg-amber-50 p-6 text-amber-950"><div className="flex items-start gap-4"><AlertTriangle size={22} className="mt-1" /><div><h3 className="text-lg font-black">Save the project brief first</h3><p className="mt-2 text-sm font-semibold leading-6">Applications, tasks and monitoring obligations need a saved funding project.</p></div></div></div>;
  }

  return (
    <div className="mt-6 space-y-5">
      <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6 ${trackerMode === "remote" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        {trackerMode === "remote" ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0" />}
        <div><strong>{trackerMode === "remote" ? "Shared application tracker active." : "Application tracker is in local draft mode."}</strong> {trackerMode === "remote" ? "Deadlines, tasks and monitoring records are available to authorised club users." : "Apply migration 202607050010 before relying on this across users or devices."}</div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
        <div className="min-w-[260px] flex-1 max-w-xl">
          <Field label="Tracked application">
            <select className={INPUT_CLASS} value={activeId} onChange={(event) => selectApplication(event.target.value)}>
              <option value="">New application</option>
              {projectApplications.map((item) => <option key={item.id} value={item.id}>{Object.fromEntries(APPLICATION_STATUS_OPTIONS)[item.status] || item.status} · {item.applicationReference || programme?.name || project.title}</option>)}
            </select>
          </Field>
        </div>
        <button type="button" onClick={() => selectApplication("")} disabled={!canManage} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Plus size={16} /> New application</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Application status" value={statusLabel} detail={draft.applicationReference ? `Reference ${draft.applicationReference}` : "No funder reference recorded yet."} icon={Send} tone={draft.status === "awarded" ? "emerald" : draft.status === "unsuccessful" ? "rose" : "sky"} />
        <Metric label="Deadline" value={formatDate(draft.deadline)} detail={deadline.label} icon={CalendarClock} tone={deadline.tone === "danger" ? "rose" : deadline.tone === "warning" ? "amber" : "emerald"} />
        <Metric label="Open tasks" value={openTasks.length} detail={overdueTasks.length ? `${overdueTasks.length} overdue.` : `${completedTasks} completed.`} icon={ListChecks} tone={overdueTasks.length ? "rose" : openTasks.length ? "amber" : "emerald"} />
        <Metric label="Monitoring" value={outstandingMonitoring.length} detail={overdueMonitoring.length ? `${overdueMonitoring.length} overdue obligation${overdueMonitoring.length === 1 ? "" : "s"}.` : "Outstanding post-award reports."} icon={ClipboardCheck} tone={overdueMonitoring.length ? "rose" : outstandingMonitoring.length ? "amber" : "slate"} />
      </div>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Application record</div><h3 className="mt-1 text-xl font-black text-slate-950">Submission, ownership and decision</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Keep the live deadline, accountable owner, submitted amount and funder decision in one auditable record.</p></div>
          {activeId ? <StatusChip status={statusTone(draft.status)}>{statusLabel}</StatusChip> : <StatusChip status="neutral">Unsaved application</StatusChip>}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Stage"><select className={INPUT_CLASS} value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} disabled={!canManage}>{APPLICATION_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Application owner"><div className="relative"><UserRound size={16} className="pointer-events-none absolute left-4 top-[22px] text-slate-400" /><input className={`${INPUT_CLASS} pl-11`} value={draft.ownerName} onChange={(event) => setDraft((current) => ({ ...current, ownerName: event.target.value }))} placeholder="Name" disabled={!canManage} /></div></Field>
          <Field label="Owner email"><div className="relative"><Mail size={16} className="pointer-events-none absolute left-4 top-[22px] text-slate-400" /><input className={`${INPUT_CLASS} pl-11`} type="email" value={draft.ownerEmail} onChange={(event) => setDraft((current) => ({ ...current, ownerEmail: event.target.value }))} placeholder="name@club.org" disabled={!canManage} /></div></Field>
          <Field label="Application deadline"><input className={INPUT_CLASS} type="date" value={draft.deadline || ""} onChange={(event) => setDraft((current) => ({ ...current, deadline: event.target.value }))} disabled={!canManage} /></Field>
          <Field label="Requested amount"><input className={INPUT_CLASS} type="number" min="0" step="100" value={draft.requestedAmount || ""} onChange={(event) => setDraft((current) => ({ ...current, requestedAmount: Number(event.target.value || 0) }))} disabled={!canManage} /></Field>
          <Field label="Application reference"><input className={INPUT_CLASS} value={draft.applicationReference} onChange={(event) => setDraft((current) => ({ ...current, applicationReference: event.target.value }))} placeholder="Funder reference" disabled={!canManage} /></Field>
          <Field label="Submitted date"><input className={INPUT_CLASS} type="datetime-local" value={draft.submittedAt ? String(draft.submittedAt).slice(0, 16) : ""} onChange={(event) => setDraft((current) => ({ ...current, submittedAt: event.target.value ? new Date(event.target.value).toISOString() : "" }))} disabled={!canManage} /></Field>
          <Field label="Expected decision"><input className={INPUT_CLASS} type="date" value={draft.expectedDecisionDate || ""} onChange={(event) => setDraft((current) => ({ ...current, expectedDecisionDate: event.target.value }))} disabled={!canManage} /></Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Next action" hint="The single most important step needed to move the application forward."><input className={INPUT_CLASS} value={draft.nextAction} onChange={(event) => setDraft((current) => ({ ...current, nextAction: event.target.value }))} disabled={!canManage} /></Field>
          <Field label="Application notes"><input className={INPUT_CLASS} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Funder contact, portal details or key risks" disabled={!canManage} /></Field>
        </div>

        <div className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3"><CircleDollarSign size={20} className="mt-0.5 shrink-0 text-emerald-700" /><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Funding position</div><div className="mt-1 text-sm font-black text-emerald-950">{formatMoney(draft.requestedAmount)} requested{draft.awardedAmount ? ` · ${formatMoney(draft.awardedAmount)} awarded` : ""}</div><div className="mt-1 text-xs font-semibold text-emerald-800">Project target: {formatMoney(project.targetFunding)} against estimated cost of {formatMoney(project.estimatedCost)}.</div></div></div>
        </div>

        <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Decision and award conditions</div><p className="mt-1 text-sm font-semibold text-slate-600">Complete this after the funder responds. Award conditions should become monitoring tasks below.</p></div><Banknote size={22} className="text-slate-400" /></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field label="Decision date"><input className={INPUT_CLASS} type="date" value={draft.decisionDate || ""} onChange={(event) => setDraft((current) => ({ ...current, decisionDate: event.target.value }))} disabled={!canManage} /></Field>
            <Field label="Awarded amount"><input className={INPUT_CLASS} type="number" min="0" step="100" value={draft.awardedAmount || ""} onChange={(event) => setDraft((current) => ({ ...current, awardedAmount: Number(event.target.value || 0) }))} disabled={!canManage} /></Field>
            <Field label="Decision notes"><input className={INPUT_CLASS} value={draft.decisionNotes} onChange={(event) => setDraft((current) => ({ ...current, decisionNotes: event.target.value }))} placeholder="Decision summary or rejection feedback" disabled={!canManage} /></Field>
          </div>
          <div className="mt-4"><Field label="Funding conditions"><textarea className={TEXTAREA_CLASS} value={draft.fundingConditions} onChange={(event) => setDraft((current) => ({ ...current, fundingConditions: event.target.value }))} placeholder="Match funding, delivery deadlines, procurement rules, branding, evidence and reporting conditions." disabled={!canManage} /></Field></div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {activeId ? <button type="button" onClick={() => setDeleteTarget({ type: "application", item: draft })} disabled={!canManage || busyKey === `application:${activeId}`} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-rose-200 px-4 text-sm font-black text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={16} /> Remove application</button> : null}
          <button type="button" onClick={saveApplication} disabled={!canManage || busyKey === "application"} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-40">{busyKey === "application" ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save application</button>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Application tasks</div><h3 className="mt-1 text-xl font-black text-slate-950">Work required before and after submission</h3><p className="mt-2 text-sm font-semibold text-slate-600">Assign every quotation, approval, portal entry and follow-up to a named owner and date.</p></div><div className="min-w-44"><ProgressBar value={taskProgress} tone={taskProgress === 100 ? "success" : overdueTasks.length ? "danger" : "warning"} /></div></div>
        {!activeId ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">Save the application before adding tasks.</div> : (
          <>
            <div className="mt-5 space-y-3">{applicationTasks.map((task) => <TaskRow key={task.id} task={task} canManage={canManage} busy={busyKey === `task:${task.id}`} onSave={onSaveTask} onDelete={(item) => setDeleteTarget({ type: "task", item })} />)}</div>
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-white p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.4fr)_150px_140px_170px_160px_auto]">
                <Field label="New task"><input className={INPUT_CLASS} value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Obtain three contractor quotations" disabled={!canManage} /></Field>
                <Field label="Status"><select className={INPUT_CLASS} value={taskDraft.status} onChange={(event) => setTaskDraft((current) => ({ ...current, status: event.target.value }))} disabled={!canManage}>{TASK_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Priority"><select className={INPUT_CLASS} value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value }))} disabled={!canManage}>{PRIORITY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Owner"><input className={INPUT_CLASS} value={taskDraft.ownerName} onChange={(event) => setTaskDraft((current) => ({ ...current, ownerName: event.target.value }))} disabled={!canManage} /></Field>
                <Field label="Due date"><input className={INPUT_CLASS} type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManage} /></Field>
                <div className="flex items-end"><button type="button" onClick={addTask} disabled={!canManage || !taskDraft.title.trim() || busyKey === "task:new"} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-40"><Plus size={15} /> Add task</button></div>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-slate-50 p-5">
        <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Post-award monitoring</div><h3 className="mt-1 text-xl font-black text-slate-950">Conditions, claims and funder reports</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Record every evidence return, expenditure claim, outcome report and acknowledgement required after an award. Do not wait until the due date to discover the evidence was never collected.</p></div>
        {!activeId ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">Save the application before adding monitoring requirements.</div> : (
          <>
            <div className="mt-5 space-y-3">{applicationObligations.map((obligation) => <ObligationRow key={obligation.id} obligation={obligation} canManage={canManage} busy={busyKey === `obligation:${obligation.id}`} onSave={onSaveObligation} onDelete={(item) => setDeleteTarget({ type: "obligation", item })} />)}</div>
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-300 bg-white p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.2fr)_170px_160px_160px_auto]">
                <Field label="New monitoring requirement"><input className={INPUT_CLASS} value={obligationDraft.title} onChange={(event) => setObligationDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Submit six-month outcome report" disabled={!canManage} /></Field>
                <Field label="Status"><select className={INPUT_CLASS} value={obligationDraft.status} onChange={(event) => setObligationDraft((current) => ({ ...current, status: event.target.value }))} disabled={!canManage}>{MONITORING_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
                <Field label="Owner"><input className={INPUT_CLASS} value={obligationDraft.ownerName} onChange={(event) => setObligationDraft((current) => ({ ...current, ownerName: event.target.value }))} disabled={!canManage} /></Field>
                <Field label="Due date"><input className={INPUT_CLASS} type="date" value={obligationDraft.dueDate} onChange={(event) => setObligationDraft((current) => ({ ...current, dueDate: event.target.value }))} disabled={!canManage} /></Field>
                <div className="flex items-end"><button type="button" onClick={addObligation} disabled={!canManage || !obligationDraft.title.trim() || busyKey === "obligation:new"} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-40"><Plus size={15} /> Add requirement</button></div>
              </div>
              <div className="mt-3"><Field label="Evidence expected"><input className={INPUT_CLASS} value={obligationDraft.evidenceRequired} onChange={(event) => setObligationDraft((current) => ({ ...current, evidenceRequired: event.target.value }))} placeholder="Invoices, photographs, usage data, participant outcomes or signed declarations" disabled={!canManage} /></Field></div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        eyebrow={deleteTarget?.type === "application" ? "Remove application" : deleteTarget?.type === "task" ? "Remove application task" : "Remove monitoring requirement"}
        title={deleteTarget?.type === "application" ? "Remove this tracked application?" : `Remove ${deleteTarget?.item?.title || "this item"}?`}
        description={deleteTarget?.type === "application" ? "This also removes its tasks and monitoring obligations. Funding project documents and evidence snapshots are not deleted." : "This removes the tracker record from the funding workspace."}
        confirmLabel="Remove"
        cancelLabel="Keep"
        tone="danger"
        initialFocus="cancel"
        busy={busyKey === "delete"}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "application") {
            await onDeleteApplication(deleteTarget.item);
            setActiveId("");
            setDraft(createApplicationDraft(project, programme));
          } else if (deleteTarget.type === "task") await onDeleteTask(deleteTarget.item);
          else await onDeleteObligation(deleteTarget.item);
          setDeleteTarget(null);
        }}
        onCancel={() => busyKey !== "delete" && setDeleteTarget(null)}
      />
    </div>
  );
}
