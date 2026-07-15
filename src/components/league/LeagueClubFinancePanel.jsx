import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, ReceiptPoundSterling, RefreshCw } from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { leagueClubStatementToCsv, normaliseLeagueFinanceData } from "../../lib/league/leagueFinanceEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function pounds(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}
function dateLabel(value) {
  if (!value) return "—";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

export default function LeagueClubFinancePanel({ leagueId }) {
  const [data, setData] = useState(() => normaliseLeagueFinanceData({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    try { const next = normaliseLeagueFinanceData(await DB.getLeagueClubFinanceData(leagueId)); setData(next); setSelectedId((current) => current && next.invoices.some((row) => row.id === current) ? current : next.invoices[0]?.id || ""); setStatus("ready"); }
    catch (loadError) { setError(loadError?.message || "Your club finance records could not be loaded."); setStatus("error"); }
  }, [leagueId]);
  useEffect(() => { load(); }, [load]);
  const selected = useMemo(() => data.invoices.find((row) => row.id === selectedId) || null, [data.invoices, selectedId]);
  if (status === "loading") return <div className="flex min-h-72 items-center justify-center"><RefreshCw className="animate-spin text-emerald-600" /></div>;
  if (status === "error") return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-rose-600" /><div><div className="font-black text-rose-950">Club finance could not load</div><div className="mt-1 text-sm font-semibold text-rose-800">{error}</div><button type="button" onClick={() => load().catch((loadError) => toast.error(loadError?.message))} className={`${BUTTON} mt-4 bg-slate-950 text-white`}>Retry</button></div></div></div>;
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Outstanding</div><div className="mt-2 text-2xl font-black text-slate-950">{pounds(data.summary.outstandingPence)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{data.summary.outstandingInvoices} open invoice{data.summary.outstandingInvoices === 1 ? "" : "s"}</div></div><div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-700">Overdue</div><div className="mt-2 text-2xl font-black text-slate-950">{pounds(data.summary.overduePence)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{data.summary.overdueInvoices} overdue</div></div><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Paid</div><div className="mt-2 text-2xl font-black text-slate-950">{pounds(data.summary.receivedPence)}</div><button type="button" onClick={() => downloadText("club-finance-statement.csv", leagueClubStatementToCsv(data))} className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-800"><Download size={13} /> Download statement</button></div></div><div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><div className="space-y-2">{data.invoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => setSelectedId(invoice.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === invoice.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"}`}><div className="flex justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{invoice.invoiceNumber}</div><div className="mt-1 text-xs font-semibold text-slate-500">Due {dateLabel(invoice.dueOn)} · {invoice.status.replaceAll("_", " ")}</div></div><div className={`text-sm font-black ${invoice.isOverdue ? "text-rose-700" : "text-slate-950"}`}>{pounds(invoice.balancePence)}</div></div></button>)}{!data.invoices.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">Your club has no issued league invoices.</div> : null}</div><div className="rounded-3xl border border-slate-200 bg-white p-6">{selected ? <><div className="flex justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{selected.status.replaceAll("_", " ")}</div><h3 className="mt-2 text-2xl font-black text-slate-950">{selected.invoiceNumber}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Issued {dateLabel(selected.issueOn)} · due {dateLabel(selected.dueOn)}</p></div><div className="text-right"><div className="text-xs font-bold text-slate-400">Balance</div><div className="mt-1 text-2xl font-black text-slate-950">{pounds(selected.balancePence)}</div></div></div><div className="mt-5 space-y-2">{selected.lines.map((line) => <div key={line.id || line.description} className="flex justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div><div className="text-sm font-black text-slate-900">{line.description}</div><div className="mt-1 text-xs font-semibold text-slate-500">{line.quantity} × {pounds(line.unitAmountPence)}</div></div><div className="text-sm font-black text-slate-950">{pounds(line.totalPence)}</div></div>)}</div><div className="mt-5 flex justify-between border-t border-slate-200 pt-4"><span className="text-sm font-black text-slate-900">Invoice total</span><strong>{pounds(selected.totalPence)}</strong></div></> : <div className="flex min-h-64 items-center justify-center text-center"><div><ReceiptPoundSterling className="mx-auto text-slate-300" size={36} /><div className="mt-3 text-sm font-black text-slate-600">Select an invoice</div></div></div>}</div></div></div>;
}
