import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Gavel,
  Link2,
  MessageSquareText,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { isSecureLeagueDocumentUrl, normaliseLeagueDisciplineData } from "../../lib/league/leagueDisciplineEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

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
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function tone(status) {
  if (["closed", "paid", "served", "upheld"].includes(status)) return "green";
  if (["awaiting_club_response", "unpaid", "dismissed"].includes(status)) return "rose";
  if (["hearing_scheduled", "decision_pending", "appealed", "submitted", "under_review"].includes(status)) return "amber";
  if (["decided", "active"].includes(status)) return "blue";
  return "slate";
}

function dateLabel(value, withTime = false) {
  if (!value) return "Not set";
  try {
    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    return date.toLocaleString("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
  } catch { return String(value); }
}

function moneyLabel(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}

export default function LeagueClubDisciplinePanel({ leagueId }) {
  const [data, setData] = useState(() => normaliseLeagueDisciplineData({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [responseType, setResponseType] = useState("response");
  const [responseDetail, setResponseDetail] = useState("");
  const [appealGrounds, setAppealGrounds] = useState("");
  const [document, setDocument] = useState({ title: "", documentUrl: "", documentType: "club_response" });

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = normaliseLeagueDisciplineData(await DB.getLeagueClubDisciplineData(leagueId));
      setData(next);
      setSelectedCaseId((current) => current && next.cases.some((row) => row.id === current) ? current : next.cases[0]?.id || "");
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "Discipline cases could not be loaded.");
      setStatus("error");
    }
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);

  const selectedCase = useMemo(() => data.cases.find((row) => row.id === selectedCaseId) || null, [data.cases, selectedCaseId]);
  const events = useMemo(() => data.events.filter((row) => row.caseId === selectedCaseId), [data.events, selectedCaseId]);
  const charges = useMemo(() => data.charges.filter((row) => row.caseId === selectedCaseId), [data.charges, selectedCaseId]);
  const sanctions = useMemo(() => data.sanctions.filter((row) => row.caseId === selectedCaseId), [data.sanctions, selectedCaseId]);
  const appeals = useMemo(() => data.appeals.filter((row) => row.caseId === selectedCaseId), [data.appeals, selectedCaseId]);
  const documents = useMemo(() => data.documents.filter((row) => row.caseId === selectedCaseId), [data.documents, selectedCaseId]);

  const submitResponse = async () => {
    if (!selectedCase || responseDetail.trim().length < 3) { toast.error("Add the club response or acknowledgement"); return; }
    setBusy(true);
    try {
      await DB.submitLeagueCaseResponse(leagueId, selectedCase.id, { responseType, detail: responseDetail });
      setResponseDetail("");
      await load();
      toast.success(responseType === "decision_acknowledged" ? "Decision acknowledged" : "Club response submitted");
    } catch (submitError) { toast.error("Response could not be submitted", { description: submitError?.message }); }
    finally { setBusy(false); }
  };

  const submitAppeal = async () => {
    if (!selectedCase || appealGrounds.trim().length < 3) { toast.error("Add the grounds for appeal"); return; }
    setBusy(true);
    try {
      await DB.submitLeagueCaseAppeal(leagueId, selectedCase.id, { grounds: appealGrounds });
      setAppealGrounds("");
      await load();
      toast.success("Appeal submitted");
    } catch (appealError) { toast.error("Appeal could not be submitted", { description: appealError?.message }); }
    finally { setBusy(false); }
  };

  const addDocument = async () => {
    if (!selectedCase || !document.title.trim() || !isSecureLeagueDocumentUrl(document.documentUrl)) { toast.error("Add a title and a valid HTTP or HTTPS document link"); return; }
    setBusy(true);
    try {
      await DB.addLeagueCaseDocument(leagueId, selectedCase.id, { ...document, visibility: "club" });
      setDocument({ title: "", documentUrl: "", documentType: "club_response" });
      await load();
      toast.success("Evidence link submitted");
    } catch (documentError) { toast.error("Evidence could not be submitted", { description: documentError?.message }); }
    finally { setBusy(false); }
  };

  if (status === "loading") return <Panel className="flex min-h-[320px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={26} /><div className="mt-3 text-sm font-black text-slate-700">Loading discipline cases…</div></div></Panel>;
  if (status === "error") return <Panel className="p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-1 text-rose-600" /><div><h2 className="text-lg font-black text-slate-950">Discipline cases could not load</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-4 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5">
    <Panel className="overflow-hidden"><div className="grid gap-5 bg-slate-950 px-6 py-6 text-white lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2"><ShieldAlert className="text-amber-400" size={22} /><Badge tone={data.summary.overdueResponses ? "rose" : data.summary.openCases ? "amber" : "green"}>{data.summary.openCases} open cases</Badge></div><h2 className="mt-3 text-2xl font-black">Discipline and compliance</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">View cases involving your club, submit formal responses and evidence, acknowledge decisions and appeal eligible outcomes.</p></div><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh</button></div></Panel>

    {!data.cases.length ? <Panel className="p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={34} /><h3 className="mt-3 text-lg font-black text-slate-950">No club discipline cases</h3><p className="mt-2 text-sm font-semibold text-slate-500">There are no visible open or historic cases involving your club.</p></Panel> : <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="border-b border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">Case register</div><div className="max-h-[760px] divide-y divide-slate-100 overflow-y-auto">{data.cases.map((row) => <button key={row.id} type="button" onClick={() => setSelectedCaseId(row.id)} className={`w-full p-4 text-left ${selectedCaseId === row.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">{row.caseReference}</div><div className="mt-1 truncate text-sm font-black text-slate-950">{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.caseType.replaceAll("_", " ")}</div></div><Badge tone={tone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div></button>)}</div></Panel>
      {selectedCase ? <div className="space-y-5"><Panel className="p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Badge tone={tone(selectedCase.status)}>{selectedCase.status.replaceAll("_", " ")}</Badge><Badge>{selectedCase.caseType.replaceAll("_", " ")}</Badge></div><div className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">{selectedCase.caseReference}</div><h3 className="mt-1 text-2xl font-black text-slate-950">{selectedCase.title}</h3><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{selectedCase.summary}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Incident</div><div className="text-sm font-black text-slate-950">{dateLabel(selectedCase.incidentOn)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Response due</div><div className="text-sm font-black text-slate-950">{dateLabel(selectedCase.responseDueOn)}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className={LABEL}>Hearing</div><div className="text-sm font-black text-slate-950">{dateLabel(selectedCase.hearingOn, true)}</div></div></div></Panel>
      {charges.length ? <Panel className="p-5 sm:p-6"><h4 className="text-lg font-black text-slate-950">Charges</h4><div className="mt-4 space-y-3">{charges.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.chargeCode ? `${row.chargeCode} · ` : ""}{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.ruleReference || "No rule reference"}</div></div><Badge tone={tone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div>{row.description ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{row.description}</p> : null}</div>)}</div></Panel> : null}
      {sanctions.length ? <Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><Gavel className="text-amber-700" /><h4 className="text-lg font-black text-slate-950">Decisions and sanctions</h4></div><div className="mt-4 space-y-3">{sanctions.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.sanctionType.replaceAll("_", " ")} · {row.subjectLabel}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.sanctionType === "fine" ? moneyLabel(row.amountPence) : row.sanctionType === "points_deduction" ? `${row.pointsDelta} points` : row.matchCount ? `${row.matchCount} matches` : row.notes || "League decision"}</div></div><Badge tone={tone(row.status)}>{row.status}</Badge></div>{row.paymentDueOn ? <div className="mt-3 text-xs font-black text-slate-500">Payment due {dateLabel(row.paymentDueOn)}</div> : null}</div>)}</div></Panel> : null}
      <div className="grid gap-5 2xl:grid-cols-2"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><MessageSquareText className="text-emerald-600" /><h4 className="text-lg font-black text-slate-950">Submit club response</h4></div><div className="mt-4 space-y-3"><select className={INPUT} value={responseType} onChange={(event) => setResponseType(event.target.value)}><option value="response">Formal case response</option><option value="decision_acknowledged">Acknowledge decision</option><option value="payment">Payment evidence note</option></select><textarea className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={responseDetail} onChange={(event) => setResponseDetail(event.target.value)} placeholder="Enter the club's formal response, acknowledgement or payment reference." /><button type="button" onClick={submitResponse} disabled={busy || responseDetail.trim().length < 3} className={`${BUTTON} w-full bg-emerald-600 text-white`}><Send size={14} /> Submit securely</button></div></Panel><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><FilePlus2 className="text-sky-600" /><h4 className="text-lg font-black text-slate-950">Submit evidence link</h4></div><div className="mt-4 space-y-3"><input className={INPUT} value={document.title} onChange={(event) => setDocument((current) => ({ ...current, title: event.target.value }))} placeholder="Evidence title" /><input type="url" className={INPUT} value={document.documentUrl} onChange={(event) => setDocument((current) => ({ ...current, documentUrl: event.target.value }))} placeholder="Secure SharePoint, Drive or document URL" /><button type="button" onClick={addDocument} disabled={busy || !document.title.trim() || !isSecureLeagueDocumentUrl(document.documentUrl)} className={`${BUTTON} w-full bg-slate-950 text-white`}><Link2 size={14} /> Add evidence</button></div></Panel></div>
      {["decided", "closed"].includes(selectedCase.status) && !appeals.some((row) => ["submitted", "under_review", "hearing_scheduled"].includes(row.status)) ? <Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><Scale className="text-violet-600" /><div><h4 className="text-lg font-black text-slate-950">Submit appeal</h4><p className="mt-1 text-sm font-semibold text-slate-500">Appeal submissions are visible to the league discipline team and remain in the case audit record.</p></div></div><textarea className="mt-4 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={appealGrounds} onChange={(event) => setAppealGrounds(event.target.value)} placeholder="Set out the grounds for appeal." /><button type="button" onClick={submitAppeal} disabled={busy || appealGrounds.trim().length < 3} className={`${BUTTON} mt-3 bg-violet-600 text-white`}><Scale size={14} /> Submit appeal</button></Panel> : null}
      {appeals.length ? <Panel className="p-5 sm:p-6"><h4 className="text-lg font-black text-slate-950">Appeals</h4><div className="mt-4 space-y-3">{appeals.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">Appeal submitted {dateLabel(row.submittedAt, true)}</div><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{row.grounds}</p></div><Badge tone={tone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div>{row.decisionReason ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">League outcome: {row.decisionReason}</div> : null}</div>)}</div></Panel> : null}
      <Panel className="p-5 sm:p-6"><h4 className="text-lg font-black text-slate-950">Case timeline</h4><div className="mt-4 space-y-3">{events.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-sm font-black text-slate-950">{row.title}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.createdByName || "League or club user"}</div></div><div className="text-[11px] font-bold text-slate-400">{dateLabel(row.createdAt, true)}</div></div>{row.detail ? <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">{row.detail}</p> : null}</div>)}</div>{documents.length ? <div className="mt-5 border-t border-slate-200 pt-5"><div className={LABEL}>Documents</div><div className="space-y-2">{documents.map((row) => <a key={row.id} href={row.documentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-black text-slate-800 hover:bg-slate-100"><Link2 size={15} /> {row.title}</a>)}</div></div> : null}</Panel>
      </div> : null}
    </div>}
  </div>;
}
