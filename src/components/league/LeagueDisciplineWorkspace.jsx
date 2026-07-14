import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BadgePoundSterling,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FilePlus2,
  FileWarning,
  Gavel,
  Link2,
  MessageSquareText,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard.js";
import {
  isSecureLeagueDocumentUrl,
  leagueDisciplineCasesToCsv,
  leagueDisciplineScorecardsToCsv,
  normaliseLeagueDisciplineData,
} from "../../lib/league/leagueDisciplineEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["command", "Command", ShieldCheck],
  ["cases", "Cases", ClipboardList],
  ["sanctions", "Sanctions & fines", Gavel],
  ["hearings", "Hearings & appeals", Scale],
  ["reports", "Reports", FileWarning],
];

const CASE_TYPES = [
  ["misconduct", "Misconduct"],
  ["abandoned_match", "Abandoned match"],
  ["eligibility", "Eligibility"],
  ["administrative", "Administrative breach"],
  ["complaint", "Complaint"],
  ["appeal", "Appeal case"],
  ["other", "Other"],
];

const CASE_STATUSES = [
  ["draft", "Draft"],
  ["awaiting_review", "Awaiting review"],
  ["awaiting_club_response", "Awaiting club response"],
  ["hearing_scheduled", "Hearing scheduled"],
  ["decision_pending", "Decision pending"],
  ["decided", "Decided"],
  ["appealed", "Appealed"],
  ["closed", "Closed"],
  ["withdrawn", "Withdrawn"],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
    purple: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone = "slate", Icon }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>{Icon ? <Icon size={17} className="text-slate-400" /> : null}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function dateLabel(value, includeTime = false) {
  if (!value) return "Not set";
  try {
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return date.toLocaleString("en-GB", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  } catch { return String(value); }
}

function moneyLabel(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}

function statusTone(status) {
  if (["closed", "paid", "served", "upheld"].includes(status)) return "green";
  if (["awaiting_review", "hearing_scheduled", "decision_pending", "appealed", "under_review", "part_upheld"].includes(status)) return "amber";
  if (["awaiting_club_response", "unpaid", "critical", "dismissed"].includes(status)) return "rose";
  if (["decided", "active", "submitted"].includes(status)) return "blue";
  return "slate";
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function emptyCaseDraft(workspace = {}) {
  const currentSeason = workspace.seasons?.find((row) => row.isCurrent) || workspace.seasons?.[0];
  return {
    seasonId: currentSeason?.id || "",
    caseType: "misconduct",
    status: "awaiting_review",
    priority: "normal",
    title: "",
    summary: "",
    incidentOn: "",
    responseDueOn: "",
    hearingOn: "",
    hearingLocation: "",
    reportingClubId: "",
    respondentClubId: "",
    respondentTeamId: "",
    assignedTo: "",
    targetType: "",
    targetId: "",
    confidential: false,
    clubResponseRequired: false,
  };
}

export default function LeagueDisciplineWorkspace({ leagueId, workspace, initialTab = "command", focusToken = 0, onSummaryChange }) {
  const [data, setData] = useState(() => normaliseLeagueDisciplineData({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialTab || "command");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [caseDraft, setCaseDraft] = useState(() => emptyCaseDraft(workspace));
  const [noteDraft, setNoteDraft] = useState({ title: "Case note", detail: "", visibility: "league", eventType: "note" });
  const [chargeDraft, setChargeDraft] = useState({ chargeCode: "", title: "", description: "", ruleReference: "", status: "alleged" });
  const [sanctionDraft, setSanctionDraft] = useState({ sanctionType: "warning", subjectType: "club", subjectId: "", subjectLabel: "", status: "proposed", amountPounds: "", pointsDelta: "", matchCount: "", startsOn: "", endsOn: "", paymentDueOn: "", notes: "" });
  const [documentDraft, setDocumentDraft] = useState({ documentType: "evidence", title: "", documentUrl: "", visibility: "league", notes: "" });
  const caseDirty = showCreate && Boolean(caseDraft.title || caseDraft.summary || caseDraft.respondentClubId || caseDraft.incidentOn);
  const confirmLeave = useUnsavedChangesGuard(caseDirty, "The new discipline case has not been saved. Discard it?");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = normaliseLeagueDisciplineData(await DB.getLeagueDisciplineData(leagueId));
      setData(next);
      setSelectedCaseId((current) => current && next.cases.some((row) => row.id === current) ? current : next.cases[0]?.id || "");
      onSummaryChange?.(next.summary);
      setStatus("ready");
      return next;
    } catch (loadError) {
      setError(loadError?.message || "The discipline workspace could not be loaded.");
      setStatus("error");
      return null;
    }
  }, [leagueId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [focusToken, initialTab]);

  const selectedCase = useMemo(() => data.cases.find((row) => row.id === selectedCaseId) || null, [data.cases, selectedCaseId]);
  const selectedCharges = useMemo(() => data.charges.filter((row) => row.caseId === selectedCaseId), [data.charges, selectedCaseId]);
  const selectedEvents = useMemo(() => data.events.filter((row) => row.caseId === selectedCaseId), [data.events, selectedCaseId]);
  const selectedDocuments = useMemo(() => data.documents.filter((row) => row.caseId === selectedCaseId), [data.documents, selectedCaseId]);

  const filteredCases = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.cases.filter((row) => {
      if (statusFilter === "open" && ["draft", "closed", "withdrawn"].includes(row.status)) return false;
      if (statusFilter === "closed" && !["closed", "withdrawn"].includes(row.status)) return false;
      if (statusFilter !== "all" && !["open", "closed"].includes(statusFilter) && row.status !== statusFilter) return false;
      if (!search) return true;
      return [row.caseReference, row.title, row.summary, row.respondentClubName, row.respondentTeamName, row.fixtureLabel, row.caseType]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [data.cases, query, statusFilter]);

  const upcomingHearings = useMemo(() => data.cases.filter((row) => row.hearingOn && !["closed", "withdrawn"].includes(row.status)).sort((left, right) => String(left.hearingOn).localeCompare(String(right.hearingOn))), [data.cases]);
  const openAppeals = useMemo(() => data.appeals.filter((row) => ["submitted", "under_review", "hearing_scheduled"].includes(row.status)), [data.appeals]);
  const overdueCases = useMemo(() => data.cases.filter((row) => row.status === "awaiting_club_response" && row.responseDueOn && row.responseDueOn < new Date().toISOString().slice(0, 10)), [data.cases]);
  const overdueFines = useMemo(() => data.sanctions.filter((row) => row.sanctionType === "fine" && !row.paidAt && row.paymentDueOn && row.paymentDueOn < new Date().toISOString().slice(0, 10) && !["paid", "revoked"].includes(row.status)), [data.sanctions]);

  const resetCreate = () => {
    setCaseDraft(emptyCaseDraft(workspace));
    setShowCreate(false);
  };

  const saveCase = async () => {
    if (!caseDraft.title.trim()) { toast.error("Add a case title"); return; }
    if (caseDraft.clubResponseRequired && !caseDraft.respondentClubId) { toast.error("Select the respondent club"); return; }
    setBusy(true);
    try {
      const caseId = await DB.upsertLeagueDisciplineCase(leagueId, caseDraft);
      resetCreate();
      const next = await load();
      setSelectedCaseId(caseId || next?.cases?.[0]?.id || "");
      setTab("cases");
      toast.success("Discipline case created");
    } catch (saveError) { toast.error("Case could not be saved", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const updateCaseStatus = async (nextStatus) => {
    if (!selectedCase) return;
    const note = window.prompt(`Change ${selectedCase.caseReference} to ${nextStatus.replaceAll("_", " ")}. Add a case note:`, "") ?? null;
    if (note === null) return;
    setBusy(true);
    try { await DB.updateLeagueDisciplineCaseStatus(leagueId, selectedCase.id, nextStatus, note); await load(); toast.success("Case status updated"); }
    catch (updateError) { toast.error("Case status could not be updated", { description: updateError?.message }); }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!selectedCase || noteDraft.detail.trim().length < 2) { toast.error("Add the case note"); return; }
    setBusy(true);
    try {
      await DB.addLeagueCaseEvent(leagueId, selectedCase.id, noteDraft);
      setNoteDraft({ title: "Case note", detail: "", visibility: "league", eventType: "note" });
      await load();
      toast.success("Case note added");
    } catch (noteError) { toast.error("Case note could not be added", { description: noteError?.message }); }
    finally { setBusy(false); }
  };

  const addCharge = async () => {
    if (!selectedCase || chargeDraft.title.trim().length < 2) { toast.error("Add the charge title"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueCaseCharge(leagueId, selectedCase.id, chargeDraft);
      setChargeDraft({ chargeCode: "", title: "", description: "", ruleReference: "", status: "alleged" });
      await load();
      toast.success("Charge added");
    } catch (chargeError) { toast.error("Charge could not be saved", { description: chargeError?.message }); }
    finally { setBusy(false); }
  };

  const sanctionSubjectOptions = useMemo(() => {
    if (sanctionDraft.subjectType === "club") return workspace.clubs || [];
    if (sanctionDraft.subjectType === "team") return workspace.teams || [];
    return [];
  }, [sanctionDraft.subjectType, workspace.clubs, workspace.teams]);

  const addSanction = async () => {
    if (!selectedCase || !sanctionDraft.subjectLabel.trim()) { toast.error("Add the sanction subject"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueCaseSanction(leagueId, selectedCase.id, {
        ...sanctionDraft,
        amountPence: Math.round(Number(sanctionDraft.amountPounds || 0) * 100),
        pointsDelta: Number(sanctionDraft.pointsDelta || 0),
        matchCount: Number(sanctionDraft.matchCount || 0),
      });
      setSanctionDraft({ sanctionType: "warning", subjectType: "club", subjectId: "", subjectLabel: "", status: "proposed", amountPounds: "", pointsDelta: "", matchCount: "", startsOn: "", endsOn: "", paymentDueOn: "", notes: "" });
      await load();
      toast.success("Sanction recorded");
    } catch (sanctionError) { toast.error("Sanction could not be saved", { description: sanctionError?.message }); }
    finally { setBusy(false); }
  };

  const addDocument = async () => {
    if (!selectedCase || !documentDraft.title.trim() || !isSecureLeagueDocumentUrl(documentDraft.documentUrl)) { toast.error("Add a document title and a valid HTTP or HTTPS link"); return; }
    setBusy(true);
    try {
      await DB.addLeagueCaseDocument(leagueId, selectedCase.id, documentDraft);
      setDocumentDraft({ documentType: "evidence", title: "", documentUrl: "", visibility: "league", notes: "" });
      await load();
      toast.success("Evidence link added");
    } catch (documentError) { toast.error("Evidence could not be added", { description: documentError?.message }); }
    finally { setBusy(false); }
  };

  const reviewAppeal = async (appeal, nextStatus) => {
    const reason = window.prompt(`Record the appeal outcome: ${nextStatus.replaceAll("_", " ")}`, "") ?? null;
    if (reason === null) return;
    setBusy(true);
    try { await DB.reviewLeagueCaseAppeal(leagueId, appeal.id, { status: nextStatus, decision: nextStatus, decisionReason: reason }); await load(); toast.success("Appeal updated"); }
    catch (appealError) { toast.error("Appeal could not be updated", { description: appealError?.message }); }
    finally { setBusy(false); }
  };

  const switchTab = (nextTab) => {
    if (nextTab === tab) return;
    if (!confirmLeave()) return;
    setTab(nextTab);
  };

  if (status === "loading") return <Panel className="flex min-h-[420px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-800">Loading discipline command…</div></div></Panel>;
  if (status === "error") return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="mt-1 text-rose-600" /><div><h2 className="text-xl font-black text-slate-950">Discipline workspace could not load</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  const summary = data.summary;
  return <div className="space-y-5">
    <Panel className="overflow-hidden">
      <div className="grid gap-6 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div><div className="flex flex-wrap items-center gap-2"><Badge tone="purple">League Operations v3.6</Badge><Badge tone={summary.status === "action_required" ? "rose" : summary.status === "needs_review" ? "amber" : "green"}>{summary.status.replaceAll("_", " ")}</Badge></div><h2 className="mt-4 text-3xl font-black tracking-tight">Discipline and compliance</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Control incidents, club responses, charges, hearings, decisions, sanctions, fines and appeals from one auditable case record.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh</button>{data.access.canManage ? <button type="button" onClick={() => setShowCreate(true)} className={`${BUTTON} bg-emerald-500 text-slate-950`}><Plus size={14} /> Open case</button> : null}</div>
      </div>
    </Panel>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Open cases" value={summary.openCases} detail="Active case register" tone={summary.openCases ? "amber" : "green"} Icon={ShieldAlert} />
      <Metric label="Overdue responses" value={summary.overdueResponses} detail="Club deadlines passed" tone={summary.overdueResponses ? "rose" : "green"} Icon={CalendarClock} />
      <Metric label="Hearings due" value={summary.hearingsDue} detail="Scheduled open hearings" tone={summary.hearingsDue ? "blue" : "green"} Icon={Scale} />
      <Metric label="Active sanctions" value={summary.activeSanctions} detail={`${summary.openAppeals} open appeals`} tone={summary.activeSanctions ? "amber" : "green"} Icon={Gavel} />
      <Metric label="Outstanding fines" value={moneyLabel(summary.totalFinePence)} detail={`${summary.unpaidFines} unpaid · ${summary.overdueFines} overdue`} tone={summary.overdueFines ? "rose" : summary.unpaidFines ? "amber" : "green"} Icon={BadgePoundSterling} />
    </div>

    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><div className="flex min-w-max gap-2">{TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => switchTab(key)} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}><Icon size={14} /> {label}{key === "cases" && summary.openCases ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{summary.openCases}</span> : null}</button>)}</div></div>

    {tab === "command" ? <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Priority queues</h3><p className="mt-1 text-sm font-semibold text-slate-500">Deadline and sanction exceptions that need intervention.</p></div><div className="divide-y divide-slate-100">
        {overdueCases.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedCaseId(row.id); setTab("cases"); }} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><CalendarClock size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">{row.caseReference} · overdue club response</span><span className="mt-1 block text-xs font-semibold text-slate-500">{row.title} · {row.respondentClubName || "Club not assigned"} · due {dateLabel(row.responseDueOn)}</span></span></button>)}
        {overdueFines.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedCaseId(row.caseId); setTab("sanctions"); }} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700"><BadgePoundSterling size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">Overdue fine · {moneyLabel(row.amountPence)}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{row.subjectLabel} · due {dateLabel(row.paymentDueOn)}</span></span></button>)}
        {openAppeals.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedCaseId(row.caseId); setTab("hearings"); }} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800"><Scale size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">Appeal awaiting league action</span><span className="mt-1 block text-xs font-semibold text-slate-500">Submitted {dateLabel(row.submittedAt, true)} · {row.grounds}</span></span></button>)}
        {!overdueCases.length && !overdueFines.length && !openAppeals.length ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={32} /><div className="mt-3 text-sm font-black text-slate-700">No critical discipline queue is overdue.</div></div> : null}
      </div></Panel>
      <Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Upcoming hearings</h3><p className="mt-1 text-sm font-semibold text-slate-500">The next scheduled case meetings.</p></div><div className="divide-y divide-slate-100">{upcomingHearings.slice(0, 8).map((row) => <button key={row.id} type="button" onClick={() => { setSelectedCaseId(row.id); setTab("hearings"); }} className="w-full px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.caseReference} · {row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(row.hearingOn, true)} · {row.respondentClubName || "No club assigned"}</div></div><Badge tone="blue">{row.status.replaceAll("_", " ")}</Badge></div></button>)}{!upcomingHearings.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No hearings are scheduled.</div> : null}</div></Panel>
    </div> : null}

    {tab === "cases" ? <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="border-b border-slate-200 p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={15} /><input className={`${INPUT} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cases, clubs or teams" /></div><select className={`${INPUT} mt-3`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="open">Open cases</option><option value="all">All cases</option><option value="closed">Closed cases</option>{CASE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="max-h-[800px] divide-y divide-slate-100 overflow-y-auto">{filteredCases.map((row) => <button key={row.id} type="button" onClick={() => setSelectedCaseId(row.id)} className={`w-full p-4 text-left transition ${selectedCaseId === row.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-700">{row.caseReference}</div><div className="mt-1 truncate text-sm font-black text-slate-950">{row.title}</div><div className="mt-1 truncate text-xs font-semibold text-slate-500">{row.respondentClubName || row.respondentTeamName || "No respondent assigned"}</div></div><Badge tone={statusTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div>{row.responseDueOn ? <div className={`mt-3 text-[11px] font-black ${row.responseDueOn < new Date().toISOString().slice(0, 10) && row.status === "awaiting_club_response" ? "text-rose-700" : "text-slate-400"}`}>Response due {dateLabel(row.responseDueOn)}</div> : null}</button>)}{!filteredCases.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No discipline cases match the filter.</div> : null}</div></Panel>
      {selectedCase ? <div className="space-y-5">
        <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(selectedCase.status)}>{selectedCase.status.replaceAll("_", " ")}</Badge><Badge tone={selectedCase.priority === "critical" ? "rose" : selectedCase.priority === "high" ? "amber" : "slate"}>{selectedCase.priority}</Badge><Badge tone="purple">{selectedCase.caseType.replaceAll("_", " ")}</Badge></div><div className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{selectedCase.caseReference}</div><h3 className="mt-1 text-2xl font-black text-slate-950">{selectedCase.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{selectedCase.summary || "No case summary has been recorded."}</p></div>{data.access.canManage ? <select className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black" value={selectedCase.status} disabled={busy} onChange={(event) => updateCaseStatus(event.target.value)}>{CASE_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : null}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Incident</div><div className="text-sm font-black text-slate-950">{dateLabel(selectedCase.incidentOn)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Respondent</div><div className="text-sm font-black text-slate-950">{selectedCase.respondentClubName || selectedCase.respondentTeamName || "Not assigned"}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Club response</div><div className="text-sm font-black text-slate-950">{selectedCase.clubResponseRequired ? `Due ${dateLabel(selectedCase.responseDueOn)}` : "Not required"}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Hearing</div><div className="text-sm font-black text-slate-950">{selectedCase.hearingOn ? dateLabel(selectedCase.hearingOn, true) : "Not scheduled"}</div></div></div></Panel>
        <div className="grid gap-5 2xl:grid-cols-2"><Panel className="p-5 sm:p-6"><h4 className="text-lg font-black text-slate-950">Charges</h4><div className="mt-4 space-y-3">{selectedCharges.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.chargeCode ? `${row.chargeCode} · ` : ""}{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.ruleReference || "No rule reference"}</div></div><Badge tone={statusTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div>{row.description ? <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{row.description}</p> : null}</div>)}{!selectedCharges.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No charges recorded.</div> : null}</div>{data.access.canManage ? <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"><Field label="Charge code"><input className={INPUT} value={chargeDraft.chargeCode} onChange={(event) => setChargeDraft((current) => ({ ...current, chargeCode: event.target.value }))} /></Field><Field label="Rule reference"><input className={INPUT} value={chargeDraft.ruleReference} onChange={(event) => setChargeDraft((current) => ({ ...current, ruleReference: event.target.value }))} /></Field><Field label="Charge title" className="sm:col-span-2"><input className={INPUT} value={chargeDraft.title} onChange={(event) => setChargeDraft((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="Description" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={chargeDraft.description} onChange={(event) => setChargeDraft((current) => ({ ...current, description: event.target.value }))} /></Field><button type="button" onClick={addCharge} disabled={busy} className={`${BUTTON} bg-slate-950 text-white sm:col-span-2`}><Plus size={14} /> Add charge</button></div> : null}</Panel>
        <Panel className="p-5 sm:p-6"><h4 className="text-lg font-black text-slate-950">Evidence and documents</h4><div className="mt-4 space-y-3">{selectedDocuments.map((row) => <a key={row.id} href={row.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 hover:bg-slate-50"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Link2 size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-950">{row.title}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{row.documentType.replaceAll("_", " ")} · {row.visibility}</span></span></a>)}{!selectedDocuments.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No evidence links have been recorded.</div> : null}</div>{data.access.canManage ? <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2"><Field label="Document title"><input className={INPUT} value={documentDraft.title} onChange={(event) => setDocumentDraft((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="Visibility"><select className={INPUT} value={documentDraft.visibility} onChange={(event) => setDocumentDraft((current) => ({ ...current, visibility: event.target.value }))}><option value="league">League confidential</option><option value="club">Visible to case clubs</option></select></Field><Field label="Secure document URL" className="sm:col-span-2"><input type="url" className={INPUT} value={documentDraft.documentUrl} onChange={(event) => setDocumentDraft((current) => ({ ...current, documentUrl: event.target.value }))} placeholder="https://…" /></Field><button type="button" onClick={addDocument} disabled={busy || !documentDraft.title.trim() || !isSecureLeagueDocumentUrl(documentDraft.documentUrl)} className={`${BUTTON} bg-slate-950 text-white sm:col-span-2`}><FilePlus2 size={14} /> Add evidence link</button></div> : null}</Panel></div>
        <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h4 className="text-lg font-black text-slate-950">Audit timeline</h4><p className="mt-1 text-sm font-semibold text-slate-500">League notes and club-visible case updates remain chronological and attributable.</p></div><Badge tone="slate">{selectedEvents.length} events</Badge></div><div className="mt-5 space-y-3">{selectedEvents.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-black text-slate-950">{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.createdByName || "Authenticated user"} · {row.createdByRole.replaceAll("_", " ")} · {row.visibility}</div></div><div className="text-[11px] font-bold text-slate-400">{dateLabel(row.createdAt, true)}</div></div>{row.detail ? <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{row.detail}</p> : null}</div>)}{!selectedEvents.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No case events recorded.</div> : null}</div>{data.access.canManage ? <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-[1fr_160px]"><Field label="Note title"><input className={INPUT} value={noteDraft.title} onChange={(event) => setNoteDraft((current) => ({ ...current, title: event.target.value }))} /></Field><Field label="Visibility"><select className={INPUT} value={noteDraft.visibility} onChange={(event) => setNoteDraft((current) => ({ ...current, visibility: event.target.value }))}><option value="league">League confidential</option><option value="club">Visible to clubs</option></select></Field><Field label="Case note" className="sm:col-span-2"><textarea className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={noteDraft.detail} onChange={(event) => setNoteDraft((current) => ({ ...current, detail: event.target.value }))} /></Field><button type="button" onClick={addNote} disabled={busy} className={`${BUTTON} bg-emerald-600 text-white sm:col-span-2`}><MessageSquareText size={14} /> Add case note</button></div> : null}</Panel>
      </div> : <Panel className="flex min-h-[520px] items-center justify-center p-8 text-center"><div><Archive className="mx-auto text-slate-300" size={36} /><div className="mt-3 text-sm font-black text-slate-600">Select a discipline case to open the case record.</div></div></Panel>}
    </div> : null}

    {tab === "sanctions" ? <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
      <Panel className="overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h3 className="text-xl font-black text-slate-950">Sanctions register</h3><p className="mt-1 text-sm font-semibold text-slate-500">Warnings, fines, deductions, suspensions and competition restrictions.</p></div><Badge tone={summary.overdueFines ? "rose" : "slate"}>{data.sanctions.length} sanctions</Badge></div><div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left"><thead><tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><th className="border-b border-slate-200 px-4 py-3">Case</th><th className="border-b border-slate-200 px-4 py-3">Subject</th><th className="border-b border-slate-200 px-4 py-3">Sanction</th><th className="border-b border-slate-200 px-4 py-3">Value</th><th className="border-b border-slate-200 px-4 py-3">Status</th><th className="border-b border-slate-200 px-4 py-3">Deadline</th></tr></thead><tbody>{data.sanctions.map((row) => { const disciplineCase = data.cases.find((item) => item.id === row.caseId); return <tr key={row.id} className="text-sm font-semibold text-slate-700"><td className="border-b border-slate-100 px-4 py-3"><button type="button" onClick={() => { setSelectedCaseId(row.caseId); setTab("cases"); }} className="font-black text-emerald-700">{disciplineCase?.caseReference || "Case"}</button></td><td className="border-b border-slate-100 px-4 py-3 font-black text-slate-950">{row.subjectLabel}</td><td className="border-b border-slate-100 px-4 py-3">{row.sanctionType.replaceAll("_", " ")}</td><td className="border-b border-slate-100 px-4 py-3">{row.sanctionType === "fine" ? moneyLabel(row.amountPence) : row.sanctionType === "points_deduction" ? `${row.pointsDelta} pts` : row.matchCount ? `${row.matchCount} matches` : "—"}</td><td className="border-b border-slate-100 px-4 py-3"><Badge tone={statusTone(row.status)}>{row.status}</Badge></td><td className="border-b border-slate-100 px-4 py-3">{dateLabel(row.paymentDueOn || row.endsOn || row.startsOn)}</td></tr>; })}</tbody></table>{!data.sanctions.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No sanctions have been recorded.</div> : null}</div></Panel>
      <Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Record sanction</h3><p className="mt-1 text-sm font-semibold text-slate-500">Select a case first. Active team points deductions automatically create the linked league-table adjustment.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Case" className="sm:col-span-2"><select className={INPUT} value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)}><option value="">Select case</option>{data.cases.map((row) => <option key={row.id} value={row.id}>{row.caseReference} · {row.title}</option>)}</select></Field><Field label="Sanction type"><select className={INPUT} value={sanctionDraft.sanctionType} onChange={(event) => setSanctionDraft((current) => ({ ...current, sanctionType: event.target.value }))}><option value="warning">Warning</option><option value="fine">Fine</option><option value="points_deduction">Points deduction</option><option value="match_suspension">Match suspension</option><option value="date_suspension">Date suspension</option><option value="ground_closure">Ground closure</option><option value="competition_exclusion">Competition exclusion</option><option value="suspended_sanction">Suspended sanction</option><option value="other">Other</option></select></Field><Field label="Status"><select className={INPUT} value={sanctionDraft.status} onChange={(event) => setSanctionDraft((current) => ({ ...current, status: event.target.value }))}><option value="proposed">Proposed</option><option value="active">Active</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="served">Served</option><option value="appealed">Appealed</option><option value="revoked">Revoked</option></select></Field><Field label="Subject type"><select className={INPUT} value={sanctionDraft.subjectType} onChange={(event) => setSanctionDraft((current) => ({ ...current, subjectType: event.target.value, subjectId: "", subjectLabel: "" }))}><option value="club">Club</option><option value="team">Team</option><option value="person">Person</option><option value="fixture">Fixture</option><option value="other">Other</option></select></Field>{["club", "team"].includes(sanctionDraft.subjectType) ? <Field label="Subject"><select className={INPUT} value={sanctionDraft.subjectId} onChange={(event) => { const row = sanctionSubjectOptions.find((item) => item.id === event.target.value); setSanctionDraft((current) => ({ ...current, subjectId: event.target.value, subjectLabel: row?.name || "" })); }}><option value="">Select subject</option>{sanctionSubjectOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field> : <Field label="Subject"><input className={INPUT} value={sanctionDraft.subjectLabel} onChange={(event) => setSanctionDraft((current) => ({ ...current, subjectLabel: event.target.value }))} /></Field>}{sanctionDraft.sanctionType === "fine" ? <Field label="Fine amount (£)"><input type="number" min="0" step="0.01" className={INPUT} value={sanctionDraft.amountPounds} onChange={(event) => setSanctionDraft((current) => ({ ...current, amountPounds: event.target.value }))} /></Field> : null}{sanctionDraft.sanctionType === "points_deduction" ? <Field label="Points change"><input type="number" min="-100" max="100" className={INPUT} value={sanctionDraft.pointsDelta} onChange={(event) => setSanctionDraft((current) => ({ ...current, pointsDelta: event.target.value }))} placeholder="-3" /></Field> : null}{sanctionDraft.sanctionType === "match_suspension" ? <Field label="Match count"><input type="number" min="1" max="100" className={INPUT} value={sanctionDraft.matchCount} onChange={(event) => setSanctionDraft((current) => ({ ...current, matchCount: event.target.value }))} /></Field> : null}<Field label="Starts"><input type="date" className={INPUT} value={sanctionDraft.startsOn} onChange={(event) => setSanctionDraft((current) => ({ ...current, startsOn: event.target.value }))} /></Field><Field label="Ends / payment due"><input type="date" className={INPUT} value={sanctionDraft.sanctionType === "fine" ? sanctionDraft.paymentDueOn : sanctionDraft.endsOn} onChange={(event) => setSanctionDraft((current) => ({ ...current, [sanctionDraft.sanctionType === "fine" ? "paymentDueOn" : "endsOn"]: event.target.value }))} /></Field><Field label="Decision notes" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={sanctionDraft.notes} onChange={(event) => setSanctionDraft((current) => ({ ...current, notes: event.target.value }))} /></Field><button type="button" onClick={addSanction} disabled={busy || !data.access.canManage || !selectedCaseId} className={`${BUTTON} bg-emerald-600 text-white sm:col-span-2`}><Gavel size={14} /> Record sanction</button></div></Panel>
    </div> : null}

    {tab === "hearings" ? <div className="grid gap-5 xl:grid-cols-2"><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Hearing calendar</h3></div><div className="divide-y divide-slate-100">{upcomingHearings.map((row) => <button key={row.id} type="button" onClick={() => { setSelectedCaseId(row.id); setTab("cases"); }} className="w-full px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.caseReference} · {row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(row.hearingOn, true)} · {row.respondentClubName || "No respondent"}</div></div><Badge tone="blue">Hearing</Badge></div></button>)}{!upcomingHearings.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No hearings are scheduled.</div> : null}</div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Appeal register</h3></div><div className="divide-y divide-slate-100">{data.appeals.map((row) => { const disciplineCase = data.cases.find((item) => item.id === row.caseId); return <div key={row.id} className="px-5 py-4 sm:px-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={() => { setSelectedCaseId(row.caseId); setTab("cases"); }} className="text-sm font-black text-emerald-700">{disciplineCase?.caseReference || "Case"}</button><p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{row.grounds}</p><div className="mt-2 text-[11px] font-bold text-slate-400">Submitted {dateLabel(row.submittedAt, true)}</div></div><Badge tone={statusTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div>{data.access.canManage && ["submitted", "under_review", "hearing_scheduled"].includes(row.status) ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => reviewAppeal(row, "under_review")} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Under review</button><button type="button" onClick={() => reviewAppeal(row, "upheld")} className={`${BUTTON} bg-emerald-600 text-white`}>Uphold</button><button type="button" onClick={() => reviewAppeal(row, "part_upheld")} className={`${BUTTON} bg-amber-500 text-slate-950`}>Part uphold</button><button type="button" onClick={() => reviewAppeal(row, "dismissed")} className={`${BUTTON} bg-slate-950 text-white`}>Dismiss</button></div> : null}</div>; })}{!data.appeals.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No appeals have been submitted.</div> : null}</div></Panel></div> : null}

    {tab === "reports" ? <div className="space-y-5"><Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black text-slate-950">Discipline reporting pack</h3><p className="mt-1 text-sm font-semibold text-slate-500">Export the case register or club compliance scorecard for board, committee and season-review reporting.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadText("league-discipline-cases.csv", leagueDisciplineCasesToCsv(data))} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={14} /> Case register CSV</button><button type="button" onClick={() => downloadText("league-club-compliance.csv", leagueDisciplineScorecardsToCsv(data))} className={`${BUTTON} bg-slate-950 text-white`}><Download size={14} /> Club scorecard CSV</button></div></div></Panel><div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Club compliance scorecard</h3></div><div className="overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left"><thead><tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><th className="border-b border-slate-200 px-4 py-3">Club</th><th className="border-b border-slate-200 px-4 py-3">Open cases</th><th className="border-b border-slate-200 px-4 py-3">Overdue</th><th className="border-b border-slate-200 px-4 py-3">Sanctions</th><th className="border-b border-slate-200 px-4 py-3">Outstanding</th></tr></thead><tbody>{data.clubScorecards.map((row) => <tr key={row.id || row.label} className="text-sm font-semibold text-slate-700"><td className="border-b border-slate-100 px-4 py-3 font-black text-slate-950">{row.label}</td><td className="border-b border-slate-100 px-4 py-3">{row.openCases}</td><td className="border-b border-slate-100 px-4 py-3"><Badge tone={row.overdueResponses ? "rose" : "green"}>{row.overdueResponses}</Badge></td><td className="border-b border-slate-100 px-4 py-3">{row.activeSanctions}</td><td className="border-b border-slate-100 px-4 py-3">{moneyLabel(row.finePence)}</td></tr>)}</tbody></table>{!data.clubScorecards.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">Club scorecards will appear when cases or sanctions are assigned.</div> : null}</div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Case mix</h3><div className="mt-5 space-y-3">{CASE_TYPES.map(([value, label]) => { const count = data.cases.filter((row) => row.caseType === value).length; const percent = data.cases.length ? Math.round((count / data.cases.length) * 100) : 0; return <div key={value}><div className="flex items-center justify-between gap-3 text-xs font-black text-slate-700"><span>{label}</span><span>{count} · {percent}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} /></div></div>; })}</div></Panel></div></div> : null}

    {showCreate ? <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true"><Panel className="max-h-[94vh] w-full max-w-4xl overflow-y-auto p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Guided case creation</div><h3 className="mt-2 text-2xl font-black text-slate-950">Open discipline case</h3><p className="mt-1 text-sm font-semibold text-slate-500">Create the core case first, then add charges, evidence, hearings and sanctions to the audit timeline.</p></div><button type="button" onClick={() => { if (confirmLeave()) resetCreate(); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Close</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="Case type"><select className={INPUT} value={caseDraft.caseType} onChange={(event) => setCaseDraft((current) => ({ ...current, caseType: event.target.value }))}>{CASE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Priority"><select className={INPUT} value={caseDraft.priority} onChange={(event) => setCaseDraft((current) => ({ ...current, priority: event.target.value }))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></Field><Field label="Opening status"><select className={INPUT} value={caseDraft.status} onChange={(event) => setCaseDraft((current) => ({ ...current, status: event.target.value }))}>{CASE_STATUSES.slice(0, 5).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Case title" className="sm:col-span-2 lg:col-span-3"><input className={INPUT} value={caseDraft.title} onChange={(event) => setCaseDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Clear allegation or compliance issue" /></Field><Field label="Incident date"><input type="date" className={INPUT} value={caseDraft.incidentOn} onChange={(event) => setCaseDraft((current) => ({ ...current, incidentOn: event.target.value }))} /></Field><Field label="Reporting club"><select className={INPUT} value={caseDraft.reportingClubId} onChange={(event) => setCaseDraft((current) => ({ ...current, reportingClubId: event.target.value }))}><option value="">No reporting club</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Respondent club"><select className={INPUT} value={caseDraft.respondentClubId} onChange={(event) => setCaseDraft((current) => ({ ...current, respondentClubId: event.target.value, respondentTeamId: "" }))}><option value="">Select club</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Respondent team"><select className={INPUT} value={caseDraft.respondentTeamId} onChange={(event) => setCaseDraft((current) => ({ ...current, respondentTeamId: event.target.value }))}><option value="">Whole club / no team</option>{workspace.teams.filter((row) => !caseDraft.respondentClubId || row.parentClubId === caseDraft.respondentClubId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Club response due"><input type="date" className={INPUT} value={caseDraft.responseDueOn} onChange={(event) => setCaseDraft((current) => ({ ...current, responseDueOn: event.target.value }))} /></Field><Field label="Assigned officer"><select className={INPUT} value={caseDraft.assignedTo} onChange={(event) => setCaseDraft((current) => ({ ...current, assignedTo: event.target.value }))}><option value="">Unassigned</option>{workspace.members.filter((row) => ["owner", "admin", "discipline"].includes(row.role)).map((row) => <option key={row.userId} value={row.userId}>{row.displayName || row.email}</option>)}</select></Field><Field label="Hearing date and time"><input type="datetime-local" className={INPUT} value={caseDraft.hearingOn} onChange={(event) => setCaseDraft((current) => ({ ...current, hearingOn: event.target.value }))} /></Field><Field label="Hearing location"><input className={INPUT} value={caseDraft.hearingLocation} onChange={(event) => setCaseDraft((current) => ({ ...current, hearingLocation: event.target.value }))} /></Field><Field label="Summary and allegation" className="sm:col-span-2 lg:col-span-3"><textarea className="min-h-36 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={caseDraft.summary} onChange={(event) => setCaseDraft((current) => ({ ...current, summary: event.target.value }))} /></Field><label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 sm:col-span-2"><input type="checkbox" checked={caseDraft.clubResponseRequired} onChange={(event) => setCaseDraft((current) => ({ ...current, clubResponseRequired: event.target.checked }))} /><span><span className="block text-sm font-black text-slate-950">Club response required</span><span className="mt-1 block text-xs font-semibold text-slate-500">The club portal will display the case and accept a formal response.</span></span></label><label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" checked={caseDraft.confidential} onChange={(event) => setCaseDraft((current) => ({ ...current, confidential: event.target.checked }))} /><span><span className="block text-sm font-black text-slate-950">League confidential</span><span className="mt-1 block text-xs font-semibold text-slate-500">Hide this case from club portal users.</span></span></label></div><div className="mt-7 flex justify-end gap-2"><button type="button" onClick={() => { if (confirmLeave()) resetCreate(); }} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Cancel</button><button type="button" onClick={saveCase} disabled={busy || !caseDraft.title.trim()} className={`${BUTTON} bg-emerald-600 text-white`}><ShieldAlert size={14} /> Create case</button></div></Panel></div> : null}
  </div>;
}
