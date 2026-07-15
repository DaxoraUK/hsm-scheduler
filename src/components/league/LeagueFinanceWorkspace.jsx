import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Download,
  FilePlus2,
  FileSpreadsheet,
  Landmark,
  Mail,
  Printer,
  Plus,
  ReceiptPoundSterling,
  RefreshCw,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { useDaxoraConfirm, useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import { DB } from "../../lib/supabase.js";
import {
  leagueClubStatementToCsv,
  leagueExpensesToCsv,
  leagueInvoicesToCsv,
  leaguePaymentsToCsv,
  leagueInvoiceToHtml,
  moneyPoundsToPence,
  normaliseLeagueFinanceData,
} from "../../lib/league/leagueFinanceEngine.js";
import { deliverLeagueFinanceDocument } from "../../lib/league/financeDeliveryService.js";
import LeagueFinanceAutomationWorkspace from "./LeagueFinanceAutomationWorkspace.jsx";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["command", "Finance command", Landmark],
  ["invoices", "Invoices", ReceiptPoundSterling],
  ["charges", "Charge catalogue", CircleDollarSign],
  ["payments", "Payments & credits", Banknote],
  ["expenses", "Expenses", WalletCards],
  ["automation", "Automation", Sparkles],
  ["reports", "Reports", FileSpreadsheet],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Badge({ children, tone = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${styles[tone] || styles.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}

function pounds(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}

function dateLabel(value) {
  if (!value) return "—";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function statusTone(status) {
  if (["paid", "received", "approved"].includes(status)) return "green";
  if (["overdue", "rejected", "void"].includes(status)) return "rose";
  if (["issued", "part_paid", "submitted"].includes(status)) return "amber";
  return "slate";
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function openHtmlDocument(html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) URL.revokeObjectURL(url);
  else window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function downloadHtml(filename, html) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function blankLine() {
  return { chargeTypeId: "", description: "", quantity: 1, unitAmountPounds: "", taxRate: 0, sourceType: null, sourceId: null, sourceLabel: "" };
}

function blankInvoice(workspace) {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  return {
    id: null,
    seasonId: workspace.seasons?.find((row) => row.isCurrent)?.id || workspace.seasons?.[0]?.id || "",
    parentClubId: "",
    invoiceNumber: "",
    issueOn: today.toISOString().slice(0, 10),
    dueOn: due.toISOString().slice(0, 10),
    periodLabel: "",
    purchaseOrderReference: "",
    notes: "",
    lines: [blankLine()],
  };
}

function blankCharge() {
  return { id: null, name: "", code: "", category: "affiliation", defaultAmountPounds: "", taxRate: 0, active: true, notes: "" };
}

function blankExpense(workspace) {
  return {
    id: null,
    seasonId: workspace.seasons?.find((row) => row.isCurrent)?.id || workspace.seasons?.[0]?.id || "",
    officialId: "",
    officialName: "",
    publicationFixtureId: "",
    fixtureLabel: "",
    expenseType: "match_fee",
    amountPounds: "",
    expenseOn: new Date().toISOString().slice(0, 10),
    status: "submitted",
    paymentReference: "",
    notes: "",
  };
}

export default function LeagueFinanceWorkspace({ leagueId, workspace, initialTab = "command", focusToken = 0, onSummaryChange }) {
  const daxoraConfirm = useDaxoraConfirm();
  const daxoraPrompt = useDaxoraPrompt();
  const [data, setData] = useState(() => normaliseLeagueFinanceData({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialTab || "command");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("open");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState(() => blankInvoice(workspace));
  const [chargeDraft, setChargeDraft] = useState(blankCharge);
  const [expenseDraft, setExpenseDraft] = useState(() => blankExpense(workspace));
  const [paymentDraft, setPaymentDraft] = useState({ amountPounds: "", paidOn: new Date().toISOString().slice(0, 10), paymentMethod: "bank_transfer", reference: "", notes: "" });
  const [creditDraft, setCreditDraft] = useState({ amountPounds: "", creditOn: new Date().toISOString().slice(0, 10), reason: "", reference: "" });

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = normaliseLeagueFinanceData(await DB.getLeagueFinanceData(leagueId));
      setData(next);
      setSelectedInvoiceId((current) => current && next.invoices.some((row) => row.id === current) ? current : next.invoices[0]?.id || "");
      onSummaryChange?.(next.summary);
      setStatus("ready");
      return next;
    } catch (loadError) {
      setError(loadError?.message || "League finance could not be loaded.");
      setStatus("error");
      return null;
    }
  }, [leagueId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [focusToken, initialTab]);

  const selectedInvoice = useMemo(() => data.invoices.find((row) => row.id === selectedInvoiceId) || null, [data.invoices, selectedInvoiceId]);
  const filteredInvoices = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.invoices.filter((invoice) => {
      if (invoiceFilter === "open" && ["draft", "void", "paid"].includes(invoice.status)) return false;
      if (invoiceFilter === "overdue" && !invoice.isOverdue) return false;
      if (invoiceFilter === "draft" && invoice.status !== "draft") return false;
      if (invoiceFilter === "paid" && invoice.status !== "paid") return false;
      if (search && ![invoice.invoiceNumber, invoice.parentClubName, invoice.periodLabel, invoice.status].some((value) => String(value || "").toLowerCase().includes(search))) return false;
      return true;
    });
  }, [data.invoices, invoiceFilter, query]);

  const canManage = data.access.canManage;

  const startInvoice = (invoice = null) => {
    if (!invoice) {
      setInvoiceDraft(blankInvoice(workspace));
    } else {
      setInvoiceDraft({
        id: invoice.id,
        seasonId: invoice.seasonId || "",
        parentClubId: invoice.parentClubId || "",
        invoiceNumber: invoice.invoiceNumber || "",
        issueOn: invoice.issueOn || new Date().toISOString().slice(0, 10),
        dueOn: invoice.dueOn || "",
        periodLabel: invoice.periodLabel || "",
        purchaseOrderReference: invoice.purchaseOrderReference || "",
        notes: invoice.notes || "",
        lines: invoice.lines.length ? invoice.lines.map((line) => ({ ...line, unitAmountPounds: String(line.unitAmountPence / 100) })) : [blankLine()],
      });
    }
    setShowInvoiceForm(true);
  };

  const setInvoiceLine = (index, patch) => setInvoiceDraft((current) => ({ ...current, lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));

  const selectChargeForLine = (index, chargeTypeId) => {
    const charge = data.chargeTypes.find((row) => row.id === chargeTypeId);
    setInvoiceLine(index, charge ? { chargeTypeId, description: charge.name, unitAmountPounds: String(charge.defaultAmountPence / 100), taxRate: charge.taxRate } : { chargeTypeId });
  };

  const saveInvoice = async () => {
    const lines = invoiceDraft.lines.filter((line) => line.description.trim() && moneyPoundsToPence(line.unitAmountPounds) !== 0);
    if (!invoiceDraft.parentClubId) { toast.error("Select the club to invoice"); return; }
    if (!invoiceDraft.issueOn || !invoiceDraft.dueOn) { toast.error("Add the issue and due dates"); return; }
    if (!lines.length) { toast.error("Add at least one invoice line"); return; }
    setBusy(true);
    try {
      const invoiceId = await DB.upsertLeagueFinanceInvoice(leagueId, invoiceDraft, lines.map((line) => ({ ...line, unitAmountPence: moneyPoundsToPence(line.unitAmountPounds) })));
      setShowInvoiceForm(false);
      const next = await load();
      setSelectedInvoiceId(invoiceId || next?.invoices?.[0]?.id || "");
      setTab("invoices");
      toast.success(invoiceDraft.id ? "Draft invoice updated" : "Draft invoice created");
    } catch (saveError) { toast.error("Invoice could not be saved", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const changeInvoiceStatus = async (invoice, nextStatus) => {
    if (!invoice) return;
    const destructive = ["void"].includes(nextStatus);
    const approved = await daxoraConfirm({
      title: nextStatus === "issued" ? `Issue ${invoice.invoiceNumber}?` : `${nextStatus === "void" ? "Void" : "Update"} ${invoice.invoiceNumber}?`,
      description: nextStatus === "issued" ? "The invoice will become visible in the club portal and enter the outstanding-balance queue." : "This status change is recorded in the league audit history.",
      confirmLabel: nextStatus === "issued" ? "Issue invoice" : nextStatus === "void" ? "Void invoice" : "Update status",
      tone: destructive ? "danger" : "default",
    });
    if (!approved) return;
    const note = await daxoraPrompt({ title: "Finance audit note", description: "Add an optional reason or reference for this status change.", label: "Audit note", confirmLabel: "Continue", required: false, multiline: true });
    if (note === null) return;
    setBusy(true);
    try { await DB.updateLeagueFinanceInvoiceStatus(leagueId, invoice.id, nextStatus, note); await load(); toast.success("Invoice status updated"); }
    catch (updateError) { toast.error("Invoice status could not be updated", { description: updateError?.message }); }
    finally { setBusy(false); }
  };

  const recordPayment = async () => {
    const amountPence = moneyPoundsToPence(paymentDraft.amountPounds);
    if (!selectedInvoice || amountPence <= 0) { toast.error("Enter the payment amount"); return; }
    if (amountPence > selectedInvoice.balancePence) { toast.error("Payment exceeds the outstanding balance", { description: `Maximum payment: ${pounds(selectedInvoice.balancePence)}.` }); return; }
    setBusy(true);
    try {
      await DB.recordLeagueFinancePayment(leagueId, selectedInvoice.id, { ...paymentDraft, amountPence });
      setPaymentDraft({ amountPounds: "", paidOn: new Date().toISOString().slice(0, 10), paymentMethod: "bank_transfer", reference: "", notes: "" });
      await load();
      toast.success("Payment recorded");
    } catch (paymentError) { toast.error("Payment could not be recorded", { description: paymentError?.message }); }
    finally { setBusy(false); }
  };

  const addCredit = async () => {
    const amountPence = moneyPoundsToPence(creditDraft.amountPounds);
    if (!selectedInvoice || amountPence <= 0 || creditDraft.reason.trim().length < 2) { toast.error("Add a credit amount and reason"); return; }
    if (amountPence > selectedInvoice.balancePence) { toast.error("Credit exceeds the outstanding balance", { description: `Maximum credit: ${pounds(selectedInvoice.balancePence)}.` }); return; }
    setBusy(true);
    try {
      await DB.addLeagueFinanceCredit(leagueId, selectedInvoice.id, { ...creditDraft, amountPence });
      setCreditDraft({ amountPounds: "", creditOn: new Date().toISOString().slice(0, 10), reason: "", reference: "" });
      await load();
      toast.success("Credit applied");
    } catch (creditError) { toast.error("Credit could not be applied", { description: creditError?.message }); }
    finally { setBusy(false); }
  };

  const saveCharge = async () => {
    if (chargeDraft.name.trim().length < 2 || chargeDraft.code.trim().length < 2) { toast.error("Add the charge name and code"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueFinanceChargeType(leagueId, { ...chargeDraft, defaultAmountPence: moneyPoundsToPence(chargeDraft.defaultAmountPounds) });
      setChargeDraft(blankCharge());
      await load();
      toast.success("Charge type saved");
    } catch (chargeError) { toast.error("Charge type could not be saved", { description: chargeError?.message }); }
    finally { setBusy(false); }
  };

  const invoiceFine = async (fine) => {
    const approved = await daxoraConfirm({ title: `Invoice ${fine.caseReference || "discipline fine"}?`, description: `${fine.parentClubName || "The respondent club"} will receive a draft invoice for ${pounds(fine.amountPence)}.`, confirmLabel: "Create draft invoice" });
    if (!approved) return;
    setBusy(true);
    try { const invoiceId = await DB.invoiceLeagueDisciplineFine(leagueId, fine.id); const next = await load(); setSelectedInvoiceId(invoiceId || next?.invoices?.[0]?.id || ""); setTab("invoices"); toast.success("Discipline fine added to a draft invoice"); }
    catch (fineError) { toast.error("Fine could not be invoiced", { description: fineError?.message }); }
    finally { setBusy(false); }
  };

  const saveExpense = async () => {
    if (expenseDraft.officialName.trim().length < 2 || moneyPoundsToPence(expenseDraft.amountPounds) <= 0) { toast.error("Add the payee and expense amount"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueFinanceExpense(leagueId, { ...expenseDraft, amountPence: moneyPoundsToPence(expenseDraft.amountPounds) });
      setExpenseDraft(blankExpense(workspace));
      await load();
      toast.success("Expense saved");
    } catch (expenseError) { toast.error("Expense could not be saved", { description: expenseError?.message }); }
    finally { setBusy(false); }
  };

  const changeExpenseStatus = async (expense, nextStatus) => {
    let reference = "";
    if (nextStatus === "paid") {
      const response = await daxoraPrompt({ title: "Mark expense as paid", description: `Record the payment reference for ${expense.officialName}.`, label: "Payment reference", confirmLabel: "Mark paid", required: true });
      if (response === null) return;
      reference = response;
    }
    setBusy(true);
    try { await DB.updateLeagueFinanceExpenseStatus(leagueId, expense.id, nextStatus, reference); await load(); toast.success("Expense status updated"); }
    catch (expenseError) { toast.error("Expense status could not be updated", { description: expenseError?.message }); }
    finally { setBusy(false); }
  };

  const financeProfileForInvoice = (invoice) => data.clubProfiles.find((row) => row.parentClubId === invoice?.parentClubId) || {};

  const emailFinanceDocument = async (invoice, deliveryKind = "invoice") => {
    if (!invoice) return;
    const profile = financeProfileForInvoice(invoice);
    if (!profile.billingEmail) {
      toast.error("Add a billing email first", { description: "Open Automation and complete the club finance profile before sending documents." });
      setTab("automation");
      return;
    }
    const approved = await daxoraConfirm({
      title: deliveryKind === "reminder" ? `Send payment reminder for ${invoice.invoiceNumber}?` : `Email ${invoice.invoiceNumber}?`,
      description: `${profile.billingEmail}${profile.ccEmails?.length ? ` plus ${profile.ccEmails.length} CC recipient${profile.ccEmails.length === 1 ? "" : "s"}` : ""} will receive a Daxora-branded message and invoice attachment.`,
      confirmLabel: deliveryKind === "reminder" ? "Send reminder" : "Send invoice",
    });
    if (!approved) return;
    setBusy(true);
    try {
      const result = await deliverLeagueFinanceDocument({ leagueId, invoiceId: invoice.id, deliveryKind });
      await load();
      toast.success(deliveryKind === "reminder" ? "Payment reminder delivered" : "Invoice delivered", { description: `${result?.recipients || 1} recipient${Number(result?.recipients || 1) === 1 ? "" : "s"} accepted by ${result?.provider || "the email provider"}.` });
    } catch (deliveryError) { toast.error("Finance document could not be delivered", { description: deliveryError?.message }); }
    finally { setBusy(false); }
  };

  if (status === "loading") return <Panel className="flex min-h-[380px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-800">Loading league finance…</div></div></Panel>;
  if (status === "error") return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="mt-1 shrink-0 text-rose-600" /><div><h2 className="text-xl font-black text-slate-950">League finance could not load</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5">
    <Panel className="overflow-hidden">
      <div className="grid gap-5 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div><div className="flex flex-wrap gap-2"><Badge tone="green">League Operations v3.9.1</Badge><Badge tone={data.summary.overdueInvoices ? "rose" : data.summary.outstandingInvoices ? "amber" : "green"}>{data.summary.overdueInvoices ? "Overdue balances" : data.summary.outstandingInvoices ? "Collection required" : "Finance controlled"}</Badge></div><h2 className="mt-4 text-3xl font-black tracking-tight">Finance and commercial administration</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Automated billing, professional invoices, payment reconciliation, collection evidence and league expenses in one auditable workspace.</p></div>
        <button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh finance</button>
      </div>
    </Panel>

    <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-xs font-black ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} />{label}</button>)}
    </div>

    {tab === "command" ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Outstanding" value={pounds(data.summary.outstandingPence)} detail={`${data.summary.outstandingInvoices} issued invoice${data.summary.outstandingInvoices === 1 ? "" : "s"}`} tone={data.summary.outstandingInvoices ? "amber" : "green"} />
        <Metric label="Overdue" value={pounds(data.summary.overduePence)} detail={`${data.summary.overdueInvoices} overdue`} tone={data.summary.overdueInvoices ? "rose" : "green"} />
        <Metric label="Received" value={pounds(data.summary.receivedPence)} detail="Recorded payments" tone="green" />
        <Metric label="Draft invoices" value={data.summary.draftInvoices} detail="Not yet issued" tone={data.summary.draftInvoices ? "blue" : "slate"} />
        <Metric label="Unbilled fines" value={pounds(data.summary.unbilledFinePence)} detail={`${data.summary.unbilledFines} sanctions`} tone={data.summary.unbilledFines ? "amber" : "slate"} />
        <Metric label="Unpaid expenses" value={pounds(data.summary.unpaidExpensePence)} detail={`${data.summary.unpaidExpenses} approved`} tone={data.summary.unpaidExpenses ? "amber" : "slate"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6"><div className="flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Collection queue</h3><p className="mt-1 text-sm font-semibold text-slate-500">Overdue and part-paid club balances first.</p></div><Badge tone={data.summary.overdueInvoices ? "rose" : "green"}>{data.summary.overdueInvoices} overdue</Badge></div><div className="mt-5 space-y-3">{data.invoices.filter((row) => row.isOverdue || row.status === "part_paid").slice(0, 8).map((invoice) => <button key={invoice.id} type="button" onClick={() => { setSelectedInvoiceId(invoice.id); setTab("invoices"); }} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-300"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{invoice.invoiceNumber} · {invoice.parentClubName}</div><div className="mt-1 text-xs font-semibold text-slate-500">Due {dateLabel(invoice.dueOn)} · {invoice.status.replaceAll("_", " ")}</div></div><div className="text-sm font-black text-rose-700">{pounds(invoice.balancePence)}</div></button>)}{!data.invoices.some((row) => row.isOverdue || row.status === "part_paid") ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No collection intervention is required.</div> : null}</div></Panel>
        <Panel className="p-6"><div className="flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Commercial actions</h3><p className="mt-1 text-sm font-semibold text-slate-500">Charges not yet converted into club debt.</p></div><button type="button" disabled={!canManage} onClick={() => startInvoice()} className={`${BUTTON} bg-emerald-600 text-white`}><FilePlus2 size={14} /> New invoice</button></div><div className="mt-5 space-y-3">{data.unbilledFines.slice(0, 8).map((fine) => <div key={fine.id} className="flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{fine.caseReference} · {fine.parentClubName}</div><div className="mt-1 text-xs font-semibold text-slate-600">{fine.subjectLabel || "Discipline fine"} · {pounds(fine.amountPence)}</div></div><button type="button" disabled={!canManage || busy} onClick={() => invoiceFine(fine)} className={`${BUTTON} border border-amber-300 bg-white text-amber-900`}>Invoice</button></div>)}{!data.unbilledFines.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">All active discipline fines are linked to invoices.</div> : null}</div></Panel>
      </div>
    </> : null}

    {tab === "invoices" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
      <Panel className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">Invoice register</h3><p className="mt-1 text-sm font-semibold text-slate-500">Draft, issue and collect club charges.</p></div><button type="button" disabled={!canManage} onClick={() => startInvoice()} className={`${BUTTON} bg-emerald-600 text-white`}><Plus size={14} /> New invoice</button></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px]"><input className={INPUT} placeholder="Search invoice or club" value={query} onChange={(event) => setQuery(event.target.value)} /><select className={INPUT} value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)}><option value="open">Open</option><option value="overdue">Overdue</option><option value="draft">Draft</option><option value="paid">Paid</option><option value="all">All</option></select></div><div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto">{filteredInvoices.map((invoice) => <button key={invoice.id} type="button" onClick={() => setSelectedInvoiceId(invoice.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedInvoiceId === invoice.id ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{invoice.invoiceNumber || "Draft invoice"}</div><div className="mt-1 truncate text-xs font-semibold text-slate-500">{invoice.parentClubName}</div></div><Badge tone={statusTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</Badge></div><div className="mt-3 flex items-end justify-between"><div className="text-[11px] font-bold text-slate-400">Due {dateLabel(invoice.dueOn)}</div><div className="text-lg font-black text-slate-950">{pounds(invoice.balancePence)}</div></div></button>)}{!filteredInvoices.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No invoices match this view.</div> : null}</div></Panel>
      <Panel className="p-6">{showInvoiceForm ? <InvoiceForm draft={invoiceDraft} setDraft={setInvoiceDraft} workspace={workspace} chargeTypes={data.chargeTypes} busy={busy} onLineChange={setInvoiceLine} onChargeSelect={selectChargeForLine} onSave={saveInvoice} onCancel={() => setShowInvoiceForm(false)} /> : selectedInvoice ? <InvoiceDetail invoice={selectedInvoice} canManage={canManage} busy={busy} onEdit={() => startInvoice(selectedInvoice)} onStatus={changeInvoiceStatus} paymentDraft={paymentDraft} setPaymentDraft={setPaymentDraft} onPayment={recordPayment} creditDraft={creditDraft} setCreditDraft={setCreditDraft} onCredit={addCredit} onEmail={emailFinanceDocument} onPrint={() => openHtmlDocument(leagueInvoiceToHtml(selectedInvoice, { leagueName: workspace.league?.name || workspace.name || "League", profile: financeProfileForInvoice(selectedInvoice) }))} onDownload={() => downloadHtml(`${selectedInvoice.invoiceNumber || "invoice"}.html`, leagueInvoiceToHtml(selectedInvoice, { leagueName: workspace.league?.name || workspace.name || "League", profile: financeProfileForInvoice(selectedInvoice) }))} /> : <div className="flex min-h-[380px] items-center justify-center text-center"><div><ReceiptPoundSterling className="mx-auto text-slate-300" size={38} /><div className="mt-3 text-sm font-black text-slate-700">Select or create an invoice</div></div></div>}</Panel>
    </div> : null}

    {tab === "charges" ? <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel className="p-6"><h3 className="text-xl font-black text-slate-950">Charge catalogue</h3><p className="mt-1 text-sm font-semibold text-slate-500">Reusable affiliation, competition, cup and sanction charges.</p><div className="mt-5 grid gap-3"><Field label="Charge name"><input className={INPUT} value={chargeDraft.name} onChange={(event) => setChargeDraft((current) => ({ ...current, name: event.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Code"><input className={INPUT} value={chargeDraft.code} onChange={(event) => setChargeDraft((current) => ({ ...current, code: event.target.value }))} /></Field><Field label="Category"><select className={INPUT} value={chargeDraft.category} onChange={(event) => setChargeDraft((current) => ({ ...current, category: event.target.value }))}><option value="affiliation">Affiliation</option><option value="team_entry">Team entry</option><option value="cup_entry">Cup entry</option><option value="fine">Fine</option><option value="official_fee">Officials</option><option value="other">Other</option></select></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Default amount (£)"><input className={INPUT} inputMode="decimal" value={chargeDraft.defaultAmountPounds} onChange={(event) => setChargeDraft((current) => ({ ...current, defaultAmountPounds: event.target.value }))} /></Field><Field label="VAT / tax rate %"><input className={INPUT} type="number" min="0" step="0.01" value={chargeDraft.taxRate} onChange={(event) => setChargeDraft((current) => ({ ...current, taxRate: event.target.value }))} /></Field></div><Field label="Notes"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" value={chargeDraft.notes} onChange={(event) => setChargeDraft((current) => ({ ...current, notes: event.target.value }))} /></Field><button type="button" disabled={!canManage || busy} onClick={saveCharge} className={`${BUTTON} bg-slate-950 text-white`}><CheckCircle2 size={14} /> Save charge type</button></div></Panel><Panel className="p-6"><div className="space-y-3">{data.chargeTypes.map((charge) => <button key={charge.id} type="button" onClick={() => setChargeDraft({ ...charge, defaultAmountPounds: String(charge.defaultAmountPence / 100) })} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-300"><div><div className="text-sm font-black text-slate-950">{charge.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{charge.code} · {charge.category.replaceAll("_", " ")} · {charge.taxRate}% tax</div></div><div className="text-base font-black text-slate-950">{pounds(charge.defaultAmountPence)}</div></button>)}{!data.chargeTypes.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">Create the league's first reusable charge type.</div> : null}</div></Panel></div> : null}

    {tab === "payments" ? <div className="grid gap-5 xl:grid-cols-2"><Panel className="p-6"><h3 className="text-xl font-black text-slate-950">Payment register</h3><div className="mt-5 space-y-3">{data.payments.slice(0, 30).map((payment) => { const invoice = data.invoices.find((row) => row.id === payment.invoiceId); return <div key={payment.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{invoice?.invoiceNumber || "Invoice"} · {invoice?.parentClubName || "Club"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(payment.paidOn)} · {payment.paymentMethod.replaceAll("_", " ")} · {payment.reference || "No reference"}</div></div><div className="text-sm font-black text-emerald-700">{pounds(payment.amountPence)}</div></div></div>; })}{!data.payments.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No payments recorded yet.</div> : null}</div></Panel><Panel className="p-6"><h3 className="text-xl font-black text-slate-950">Credit register</h3><div className="mt-5 space-y-3">{data.credits.slice(0, 30).map((credit) => { const invoice = data.invoices.find((row) => row.id === credit.invoiceId); return <div key={credit.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{invoice?.invoiceNumber || "Invoice"} · {invoice?.parentClubName || "Club"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(credit.creditOn)} · {credit.reason} · {credit.reference || "No reference"}</div></div><div className="text-sm font-black text-sky-700">{pounds(credit.amountPence)}</div></div></div>; })}{!data.credits.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No credits applied yet.</div> : null}</div></Panel></div> : null}

    {tab === "expenses" ? <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel className="p-6"><h3 className="text-xl font-black text-slate-950">Record expense</h3><p className="mt-1 text-sm font-semibold text-slate-500">Officials, travel, administration and other league expenditure.</p><div className="mt-5 grid gap-3"><Field label="Payee / official"><input className={INPUT} value={expenseDraft.officialName} onChange={(event) => setExpenseDraft((current) => ({ ...current, officialName: event.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Expense type"><select className={INPUT} value={expenseDraft.expenseType} onChange={(event) => setExpenseDraft((current) => ({ ...current, expenseType: event.target.value }))}><option value="match_fee">Match fee</option><option value="assistant_fee">Assistant fee</option><option value="travel">Travel</option><option value="mileage">Mileage</option><option value="parking">Parking</option><option value="equipment">Equipment</option><option value="administration">Administration</option><option value="other">Other</option></select></Field><Field label="Amount (£)"><input className={INPUT} inputMode="decimal" value={expenseDraft.amountPounds} onChange={(event) => setExpenseDraft((current) => ({ ...current, amountPounds: event.target.value }))} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Expense date"><input className={INPUT} type="date" value={expenseDraft.expenseOn} onChange={(event) => setExpenseDraft((current) => ({ ...current, expenseOn: event.target.value }))} /></Field><Field label="Fixture / purpose"><input className={INPUT} value={expenseDraft.fixtureLabel} onChange={(event) => setExpenseDraft((current) => ({ ...current, fixtureLabel: event.target.value }))} /></Field></div><Field label="Notes"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" value={expenseDraft.notes} onChange={(event) => setExpenseDraft((current) => ({ ...current, notes: event.target.value }))} /></Field><button type="button" disabled={!canManage || busy} onClick={saveExpense} className={`${BUTTON} bg-slate-950 text-white`}><Plus size={14} /> Save expense</button></div></Panel><Panel className="p-6"><div className="space-y-3">{data.expenses.map((expense) => <div key={expense.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{expense.officialName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{expense.expenseType.replaceAll("_", " ")} · {dateLabel(expense.expenseOn)}{expense.fixtureLabel ? ` · ${expense.fixtureLabel}` : ""}</div></div><div className="text-right"><div className="text-base font-black text-slate-950">{pounds(expense.amountPence)}</div><Badge tone={statusTone(expense.status)}>{expense.status}</Badge></div></div>{canManage ? <div className="mt-4 flex flex-wrap gap-2">{expense.status === "submitted" ? <><button type="button" disabled={busy} onClick={() => changeExpenseStatus(expense, "approved")} className={`${BUTTON} bg-emerald-600 text-white`}>Approve</button><button type="button" disabled={busy} onClick={() => changeExpenseStatus(expense, "rejected")} className={`${BUTTON} border border-rose-200 bg-rose-50 text-rose-700`}>Reject</button></> : null}{expense.status === "approved" ? <button type="button" disabled={busy} onClick={() => changeExpenseStatus(expense, "paid")} className={`${BUTTON} bg-slate-950 text-white`}>Mark paid</button> : null}</div> : null}</div>)}{!data.expenses.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No league expenses recorded.</div> : null}</div></Panel></div> : null}

    {tab === "automation" ? <LeagueFinanceAutomationWorkspace leagueId={leagueId} workspace={workspace} data={data} onReload={load} /> : null}

    {tab === "reports" ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">{[
      ["Invoice register", "Every invoice, status and balance.", "league-invoices.csv", () => leagueInvoicesToCsv(data)],
      ["Payment register", "Payments by invoice, method and reference.", "league-payments.csv", () => leaguePaymentsToCsv(data)],
      ["Expense register", "Official and league expenditure.", "league-expenses.csv", () => leagueExpensesToCsv(data)],
      ["Club statements", "A complete debit and credit statement for all clubs.", "league-club-statements.csv", () => leagueClubStatementToCsv(data)],
    ].map(([title, detail, filename, builder]) => <Panel key={title} className="p-6"><Download className="text-emerald-600" size={24} /><h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3><p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">{detail}</p><button type="button" onClick={() => downloadText(filename, builder())} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><Download size={14} /> Download CSV</button></Panel>)}</div> : null}
  </div>;
}

function InvoiceForm({ draft, setDraft, workspace, chargeTypes, busy, onLineChange, onChargeSelect, onSave, onCancel }) {
  return <div><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">{draft.id ? "Edit draft invoice" : "New draft invoice"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Build the complete club charge before issuing it.</p></div><button type="button" onClick={onCancel} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Cancel</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Club" className="sm:col-span-2"><select className={INPUT} value={draft.parentClubId} disabled={Boolean(draft.id)} onChange={(event) => setDraft((current) => ({ ...current, parentClubId: event.target.value }))}><option value="">Select club</option>{workspace.clubs?.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field><Field label="Issue date"><input className={INPUT} type="date" value={draft.issueOn} onChange={(event) => setDraft((current) => ({ ...current, issueOn: event.target.value }))} /></Field><Field label="Due date"><input className={INPUT} type="date" value={draft.dueOn} onChange={(event) => setDraft((current) => ({ ...current, dueOn: event.target.value }))} /></Field><Field label="Period / description"><input className={INPUT} value={draft.periodLabel} onChange={(event) => setDraft((current) => ({ ...current, periodLabel: event.target.value }))} /></Field><Field label="Purchase order reference"><input className={INPUT} value={draft.purchaseOrderReference} onChange={(event) => setDraft((current) => ({ ...current, purchaseOrderReference: event.target.value }))} /></Field></div><div className="mt-6 flex items-center justify-between"><h4 className="text-sm font-black text-slate-950">Invoice lines</h4><button type="button" onClick={() => setDraft((current) => ({ ...current, lines: [...current.lines, blankLine()] }))} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}><Plus size={14} /> Add line</button></div><div className="mt-3 space-y-3">{draft.lines.map((line, index) => <div key={`${index}-${line.id || "new"}`} className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 sm:grid-cols-[1fr_110px_110px_80px_auto]"><select className={INPUT} value={line.chargeTypeId || ""} onChange={(event) => onChargeSelect(index, event.target.value)}><option value="">Custom charge</option>{chargeTypes.filter((row) => row.active).map((charge) => <option key={charge.id} value={charge.id}>{charge.name}</option>)}</select><input className={INPUT} type="number" min="0.001" step="0.001" aria-label="Quantity" value={line.quantity} onChange={(event) => onLineChange(index, { quantity: event.target.value })} /><input className={INPUT} inputMode="decimal" aria-label="Unit amount pounds" value={line.unitAmountPounds} onChange={(event) => onLineChange(index, { unitAmountPounds: event.target.value })} /><input className={INPUT} type="number" min="0" step="0.01" aria-label="Tax rate" value={line.taxRate} onChange={(event) => onLineChange(index, { taxRate: event.target.value })} /><button type="button" aria-label="Remove line" disabled={draft.lines.length === 1} onClick={() => setDraft((current) => ({ ...current, lines: current.lines.filter((_, lineIndex) => lineIndex !== index) }))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-30"><Trash2 size={15} /></button></div><input className={`${INPUT} mt-3`} placeholder="Line description" value={line.description} onChange={(event) => onLineChange(index, { description: event.target.value })} /></div>)}</div><Field label="Invoice notes" className="mt-4 block"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></Field><button type="button" disabled={busy} onClick={onSave} className={`${BUTTON} mt-5 bg-emerald-600 text-white`}><CheckCircle2 size={14} /> Save draft invoice</button></div>;
}

function InvoiceDetail({ invoice, canManage, busy, onEdit, onStatus, paymentDraft, setPaymentDraft, onPayment, creditDraft, setCreditDraft, onCredit, onEmail, onPrint, onDownload }) {
  const editable = invoice.storedStatus === "draft";
  return <div><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge tone={statusTone(invoice.status)}>{invoice.status.replaceAll("_", " ")}</Badge>{invoice.isOverdue ? <Badge tone="rose">Overdue</Badge> : null}</div><h3 className="mt-3 text-2xl font-black text-slate-950">{invoice.invoiceNumber}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{invoice.parentClubName} · issued {dateLabel(invoice.issueOn)} · due {dateLabel(invoice.dueOn)}</p></div><div className="text-right"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Balance</div><div className={`mt-1 text-3xl font-black ${invoice.isOverdue ? "text-rose-700" : "text-slate-950"}`}>{pounds(invoice.balancePence)}</div></div></div><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={onPrint} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}><Printer size={14} /> Print / save PDF</button><button type="button" onClick={onDownload} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}><Download size={14} /> Download invoice</button>{canManage && !["draft", "void"].includes(invoice.status) ? <><button type="button" disabled={busy} onClick={() => onEmail(invoice, "invoice")} className={`${BUTTON} bg-emerald-600 text-white`}><Mail size={14} /> Email invoice</button>{invoice.balancePence > 0 ? <button type="button" disabled={busy} onClick={() => onEmail(invoice, "reminder")} className={`${BUTTON} border border-amber-200 bg-amber-50 text-amber-900`}><Mail size={14} /> Send reminder</button> : null}</> : null}</div><div className="mt-5 space-y-2">{invoice.lines.map((line) => <div key={line.id || line.description} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4"><div><div className="text-sm font-black text-slate-900">{line.description}</div><div className="mt-1 text-xs font-semibold text-slate-500">{line.quantity} × {pounds(line.unitAmountPence)} · {line.taxRate}% tax</div></div><div className="text-sm font-black text-slate-950">{pounds(line.totalPence)}</div></div>)}</div><div className="mt-5 grid gap-2 rounded-2xl border border-slate-200 p-4 text-sm"><div className="flex justify-between"><span className="font-semibold text-slate-500">Subtotal</span><strong>{pounds(invoice.subtotalPence)}</strong></div><div className="flex justify-between"><span className="font-semibold text-slate-500">Tax</span><strong>{pounds(invoice.taxPence)}</strong></div><div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-black text-slate-900">Invoice total</span><strong>{pounds(invoice.totalPence)}</strong></div><div className="flex justify-between text-emerald-700"><span className="font-semibold">Payments</span><strong>−{pounds(invoice.paidPence)}</strong></div><div className="flex justify-between text-sky-700"><span className="font-semibold">Credits</span><strong>−{pounds(invoice.creditedPence)}</strong></div></div>{canManage ? <><div className="mt-5 flex flex-wrap gap-2">{editable ? <><button type="button" disabled={busy} onClick={onEdit} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Edit draft</button><button type="button" disabled={busy} onClick={() => onStatus(invoice, "issued")} className={`${BUTTON} bg-emerald-600 text-white`}>Issue invoice</button></> : null}{!["void", "paid"].includes(invoice.status) ? <button type="button" disabled={busy} onClick={() => onStatus(invoice, "void")} className={`${BUTTON} border border-rose-200 bg-rose-50 text-rose-700`}>Void invoice</button> : null}</div>{!["draft", "void", "paid"].includes(invoice.status) ? <div className="mt-6 grid gap-5 border-t border-slate-200 pt-6 lg:grid-cols-2"><div><h4 className="text-sm font-black text-slate-950">Record payment</h4><div className="mt-3 grid gap-3"><input className={INPUT} placeholder="Amount £" inputMode="decimal" value={paymentDraft.amountPounds} onChange={(event) => setPaymentDraft((current) => ({ ...current, amountPounds: event.target.value }))} /><div className="grid grid-cols-2 gap-3"><input className={INPUT} type="date" value={paymentDraft.paidOn} onChange={(event) => setPaymentDraft((current) => ({ ...current, paidOn: event.target.value }))} /><select className={INPUT} value={paymentDraft.paymentMethod} onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentMethod: event.target.value }))}><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option></select></div><input className={INPUT} placeholder="Reference" value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} /><button type="button" disabled={busy} onClick={onPayment} className={`${BUTTON} bg-slate-950 text-white`}>Record payment</button></div></div><div><h4 className="text-sm font-black text-slate-950">Apply credit</h4><div className="mt-3 grid gap-3"><input className={INPUT} placeholder="Amount £" inputMode="decimal" value={creditDraft.amountPounds} onChange={(event) => setCreditDraft((current) => ({ ...current, amountPounds: event.target.value }))} /><input className={INPUT} type="date" value={creditDraft.creditOn} onChange={(event) => setCreditDraft((current) => ({ ...current, creditOn: event.target.value }))} /><input className={INPUT} placeholder="Reason" value={creditDraft.reason} onChange={(event) => setCreditDraft((current) => ({ ...current, reason: event.target.value }))} /><input className={INPUT} placeholder="Reference" value={creditDraft.reference} onChange={(event) => setCreditDraft((current) => ({ ...current, reference: event.target.value }))} /><button type="button" disabled={busy} onClick={onCredit} className={`${BUTTON} border border-sky-200 bg-sky-50 text-sky-800`}>Apply credit</button></div></div></div> : null}</> : null}</div>;
}
