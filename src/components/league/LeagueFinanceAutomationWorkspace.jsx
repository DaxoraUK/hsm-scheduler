import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Mail,
  Sparkles,
  Upload,
  Users,
  WandSparkles,
} from "lucide-react";
import { useDaxoraConfirm } from "../../contexts/DaxoraInteractionContext.jsx";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { matchFinancePaymentRows, parseFinancePaymentCsv } from "../../lib/league/leagueFinanceEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Field({ label, children, className = "", hint = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}{hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}</label>;
}

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(pence || 0) / 100);
}

function dateLabel(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return String(value); }
}

function profileDraft(club, existing) {
  return {
    parentClubId: club?.id || "",
    billingEmail: existing?.billingEmail || "",
    ccEmailsText: (existing?.ccEmails || []).join("; "),
    accountReference: existing?.accountReference || "",
    paymentTermsDays: existing?.paymentTermsDays || 30,
    remindersEnabled: existing?.remindersEnabled !== false,
    reminderDaysText: (existing?.reminderDays?.length ? existing.reminderDays : [0, 7, 14]).join(", "),
    purchaseOrderRequired: Boolean(existing?.purchaseOrderRequired),
    notes: existing?.notes || "",
  };
}

function blankTemplate(workspace) {
  return {
    id: null,
    name: "",
    chargeTypeId: "",
    scope: "club",
    seasonId: workspace.seasons?.find((season) => season.isCurrent)?.id || workspace.seasons?.[0]?.id || "",
    quantity: 1,
    dueDays: 30,
    active: true,
    notes: "",
  };
}

function blankRun(workspace, templateId = "") {
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30);
  return {
    templateId,
    seasonId: workspace.seasons?.find((season) => season.isCurrent)?.id || workspace.seasons?.[0]?.id || "",
    name: "Season charges",
    issueOn: issueDate.toISOString().slice(0, 10),
    dueOn: dueDate.toISOString().slice(0, 10),
    issueImmediately: false,
    parentClubIds: [],
  };
}

function parseList(text) {
  return [...new Set(String(text || "").split(/[;,\n]/).map((value) => value.trim()).filter(Boolean))];
}

export default function LeagueFinanceAutomationWorkspace({ leagueId, workspace, data, onReload }) {
  const daxoraConfirm = useDaxoraConfirm();
  const clubs = useMemo(() => (workspace.clubs || []).filter((club) => club.status !== "withdrawn" && club.status !== "inactive"), [workspace.clubs]);
  const [busy, setBusy] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState(clubs[0]?.id || "");
  const [profile, setProfile] = useState(() => profileDraft(clubs[0], data.clubProfiles.find((row) => row.parentClubId === clubs[0]?.id)));
  const [template, setTemplate] = useState(() => blankTemplate(workspace));
  const [run, setRun] = useState(() => blankRun(workspace));
  const [paymentFilename, setPaymentFilename] = useState("");
  const [paymentRows, setPaymentRows] = useState([]);

  useEffect(() => {
    const club = clubs.find((row) => row.id === selectedClubId) || clubs[0];
    if (!club) return;
    const existing = data.clubProfiles.find((row) => row.parentClubId === club.id);
    setProfile(profileDraft(club, existing));
  }, [clubs, data.clubProfiles, selectedClubId]);

  useEffect(() => {
    if (!run.templateId && data.billingTemplates[0]?.id) setRun((current) => ({ ...current, templateId: data.billingTemplates[0].id }));
  }, [data.billingTemplates, run.templateId]);

  const activeTemplate = data.billingTemplates.find((row) => row.id === run.templateId) || null;
  const activeCharge = data.chargeTypes.find((row) => row.id === activeTemplate?.chargeTypeId) || null;
  const selectedClubIds = run.parentClubIds.length ? run.parentClubIds : clubs.map((club) => club.id);
  const runPreview = useMemo(() => {
    if (!activeTemplate || !activeCharge) return [];
    return clubs.filter((club) => selectedClubIds.includes(club.id)).map((club) => {
      const units = activeTemplate.scope === "team"
        ? (workspace.teams || []).filter((team) => team.parentClubId === club.id && team.status !== "withdrawn" && (!run.seasonId || team.seasonId === run.seasonId)).length
        : 1;
      const quantity = units * Number(activeTemplate.quantity || 1);
      const netPence = Math.round(quantity * Number(activeCharge.defaultAmountPence || 0));
      const taxPence = Math.round(netPence * Number(activeCharge.taxRate || 0) / 100);
      return { clubId: club.id, clubName: club.name, units, quantity, totalPence: netPence + taxPence };
    }).filter((row) => row.units > 0);
  }, [activeCharge, activeTemplate, clubs, run.seasonId, selectedClubIds, workspace.teams]);

  const matchedRows = paymentRows.filter((row) => row.matchedInvoiceId && row.amountPence > 0);

  const saveProfile = async () => {
    if (!profile.parentClubId) return;
    if (profile.billingEmail && !/^\S+@\S+\.\S+$/.test(profile.billingEmail)) { toast.error("Enter a valid billing email address"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueFinanceClubProfile(leagueId, {
        ...profile,
        ccEmails: parseList(profile.ccEmailsText),
        reminderDays: parseList(profile.reminderDaysText).map(Number).filter((value) => Number.isFinite(value) && value >= 0),
      });
      await onReload?.();
      toast.success("Club finance profile saved");
    } catch (error) { toast.error("Finance profile could not be saved", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const saveTemplate = async () => {
    if (template.name.trim().length < 2 || !template.chargeTypeId) { toast.error("Add a template name and charge type"); return; }
    setBusy(true);
    try {
      const templateId = await DB.upsertLeagueFinanceBillingTemplate(leagueId, template);
      await onReload?.();
      setTemplate(blankTemplate(workspace));
      setRun((current) => ({ ...current, templateId: templateId || current.templateId }));
      toast.success("Billing template saved");
    } catch (error) { toast.error("Billing template could not be saved", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const createBillingRun = async () => {
    if (!activeTemplate) { toast.error("Select a billing template"); return; }
    if (!runPreview.length) { toast.error("No eligible clubs or teams are available for this run"); return; }
    const totalPence = runPreview.reduce((sum, row) => sum + row.totalPence, 0);
    const approved = await daxoraConfirm({
      title: `${run.issueImmediately ? "Issue" : "Create"} ${runPreview.length} club invoice${runPreview.length === 1 ? "" : "s"}?`,
      description: `${activeTemplate.name} will create ${money(totalPence)} of league charges. ${run.issueImmediately ? "Invoices will immediately appear in club portals and collection queues." : "Invoices will remain draft until reviewed."}`,
      confirmLabel: run.issueImmediately ? "Create and issue" : "Create drafts",
    });
    if (!approved) return;
    setBusy(true);
    try {
      const result = await DB.createLeagueFinanceBillingRun(leagueId, {
        ...run,
        parentClubIds: selectedClubIds,
        idempotencyKey: `billing-${activeTemplate.id}-${run.issueOn}-${Date.now()}`,
      });
      await onReload?.();
      toast.success(`${result?.invoice_count || result?.invoiceCount || runPreview.length} invoices created`, { description: `${money(result?.total_pence || result?.totalPence || totalPence)} added to league finance.` });
    } catch (error) { toast.error("Bulk billing could not be completed", { description: error?.message }); }
    finally { setBusy(false); }
  };

  const readPaymentFile = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = matchFinancePaymentRows(parseFinancePaymentCsv(text), data.invoices);
      setPaymentFilename(file.name);
      setPaymentRows(parsed);
      toast.success("Payment file analysed", { description: `${parsed.filter((row) => row.matchStatus === "matched").length} of ${parsed.length} rows matched automatically.` });
    } catch (error) { toast.error("Payment file could not be read", { description: error?.message }); }
  };

  const setPaymentInvoice = (rowNumber, invoiceId) => {
    const invoice = data.invoices.find((row) => row.id === invoiceId);
    setPaymentRows((current) => current.map((row) => row.rowNumber === rowNumber ? { ...row, matchedInvoiceId: invoiceId, matchedInvoiceNumber: invoice?.invoiceNumber || "", matchStatus: invoiceId ? "matched" : "unmatched" } : row));
  };

  const applyPayments = async () => {
    if (!matchedRows.length) { toast.error("Match at least one payment to an invoice"); return; }
    const total = matchedRows.reduce((sum, row) => sum + row.amountPence, 0);
    const approved = await daxoraConfirm({ title: `Apply ${matchedRows.length} imported payment${matchedRows.length === 1 ? "" : "s"}?`, description: `${money(total)} will be posted to the matched invoices. Every payment will be retained in the finance audit history.`, confirmLabel: "Apply payments" });
    if (!approved) return;
    setBusy(true);
    try {
      const result = await DB.applyLeagueFinancePaymentBatch(leagueId, paymentFilename, matchedRows);
      await onReload?.();
      setPaymentRows([]);
      setPaymentFilename("");
      toast.success("Payment import applied", { description: `${result?.applied_count || result?.appliedCount || matchedRows.length} payments · ${money(result?.total_pence || result?.totalPence || total)}.` });
    } catch (error) { toast.error("Payment import could not be applied", { description: error?.message }); }
    finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Panel className="p-6">
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Building2 size={22} /></div><div><h3 className="text-xl font-black text-slate-950">Club billing profiles</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Set the correct treasurer address, account reference and payment terms once.</p></div></div>
        <div className="mt-5 space-y-3">
          <Field label="Club"><select className={INPUT} value={selectedClubId} onChange={(event) => setSelectedClubId(event.target.value)}>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></Field>
          <Field label="Billing email"><input className={INPUT} type="email" value={profile.billingEmail} onChange={(event) => setProfile((current) => ({ ...current, billingEmail: event.target.value }))} placeholder="treasurer@club.org" /></Field>
          <Field label="CC recipients" hint="Separate multiple addresses with commas or semicolons."><input className={INPUT} value={profile.ccEmailsText} onChange={(event) => setProfile((current) => ({ ...current, ccEmailsText: event.target.value }))} placeholder="secretary@club.org" /></Field>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Account reference"><input className={INPUT} value={profile.accountReference} onChange={(event) => setProfile((current) => ({ ...current, accountReference: event.target.value }))} placeholder="CLUB-001" /></Field><Field label="Payment terms"><select className={INPUT} value={profile.paymentTermsDays} onChange={(event) => setProfile((current) => ({ ...current, paymentTermsDays: Number(event.target.value) }))}>{[7,14,21,30,45,60].map((days) => <option key={days} value={days}>{days} days</option>)}</select></Field></div>
          <Field label="Reminder cadence" hint="Days overdue at which the club should appear in the reminder queue."><input className={INPUT} value={profile.reminderDaysText} onChange={(event) => setProfile((current) => ({ ...current, reminderDaysText: event.target.value }))} placeholder="0, 7, 14" /></Field>
          <div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={profile.remindersEnabled} onChange={(event) => setProfile((current) => ({ ...current, remindersEnabled: event.target.checked }))} /> Automated reminders enabled</label><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={profile.purchaseOrderRequired} onChange={(event) => setProfile((current) => ({ ...current, purchaseOrderRequired: event.target.checked }))} /> PO reference required</label></div>
          <button type="button" disabled={busy || !data.access.canManage} onClick={saveProfile} className={`${BUTTON} bg-slate-950 text-white`}><CheckCircle2 size={14} /> Save finance profile</button>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-sky-50 p-3 text-sky-700"><WandSparkles size={22} /></div><div><h3 className="text-xl font-black text-slate-950">Reusable billing templates</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Turn annual affiliation, team entry and competition charges into a controlled one-click run.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Template name" className="sm:col-span-2"><input className={INPUT} value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} placeholder="2026/27 team affiliation" /></Field>
          <Field label="Charge type"><select className={INPUT} value={template.chargeTypeId} onChange={(event) => setTemplate((current) => ({ ...current, chargeTypeId: event.target.value }))}><option value="">Select charge</option>{data.chargeTypes.filter((row) => row.active).map((charge) => <option key={charge.id} value={charge.id}>{charge.name} · {money(charge.defaultAmountPence)}</option>)}</select></Field>
          <Field label="Scope"><select className={INPUT} value={template.scope} onChange={(event) => setTemplate((current) => ({ ...current, scope: event.target.value }))}><option value="club">Once per club</option><option value="team">Once per active team</option></select></Field>
          <Field label="Season"><select className={INPUT} value={template.seasonId} onChange={(event) => setTemplate((current) => ({ ...current, seasonId: event.target.value }))}><option value="">Any season</option>{(workspace.seasons || []).map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></Field>
          <Field label="Payment terms"><select className={INPUT} value={template.dueDays} onChange={(event) => setTemplate((current) => ({ ...current, dueDays: Number(event.target.value) }))}>{[7,14,21,30,45,60].map((days) => <option key={days} value={days}>{days} days</option>)}</select></Field>
        </div>
        <button type="button" disabled={busy || !data.access.canManage} onClick={saveTemplate} className={`${BUTTON} mt-4 bg-emerald-600 text-white`}><Sparkles size={14} /> Save billing template</button>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{data.billingTemplates.map((row) => <button key={row.id} type="button" onClick={() => { setTemplate({ ...row }); setRun((current) => ({ ...current, templateId: row.id })); }} className="rounded-2xl border border-slate-200 p-4 text-left hover:border-emerald-300"><div className="text-sm font-black text-slate-950">{row.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.chargeName} · per {row.scope} · {row.dueDays} days</div></button>)}{!data.billingTemplates.length ? <div className="sm:col-span-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">Create the first template to unlock bulk billing.</div> : null}</div>
      </Panel>
    </div>

    <Panel className="overflow-hidden">
      <div className="grid gap-5 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-300"><Users size={15} /> Bulk seasonal billing</div><h3 className="mt-3 text-2xl font-black">Preview the complete run before creating debt</h3><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Daxora calculates eligible clubs, active teams, tax and the exact invoice total. The same idempotency protection prevents accidental duplicate runs.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">Run total</div><div className="mt-1 text-3xl font-black">{money(runPreview.reduce((sum, row) => sum + row.totalPence, 0))}</div><div className="text-xs font-bold text-slate-300">{runPreview.length} club invoices</div></div></div>
      <div className="p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><Field label="Template" className="xl:col-span-2"><select className={INPUT} value={run.templateId} onChange={(event) => setRun((current) => ({ ...current, templateId: event.target.value }))}><option value="">Select template</option>{data.billingTemplates.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Run label"><input className={INPUT} value={run.name} onChange={(event) => setRun((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Issue date"><input className={INPUT} type="date" value={run.issueOn} onChange={(event) => setRun((current) => ({ ...current, issueOn: event.target.value }))} /></Field><Field label="Due date"><input className={INPUT} type="date" value={run.dueOn} onChange={(event) => setRun((current) => ({ ...current, dueOn: event.target.value }))} /></Field></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{clubs.map((club) => { const explicit = run.parentClubIds.length > 0; const checked = explicit ? run.parentClubIds.includes(club.id) : true; return <label key={club.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => setRun((current) => { const base = current.parentClubIds.length ? current.parentClubIds : clubs.map((row) => row.id); return { ...current, parentClubIds: event.target.checked ? [...new Set([...base, club.id])] : base.filter((id) => id !== club.id) }; })} />{club.name}</label>; })}</div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[1fr_90px_120px] bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"><span>Club</span><span className="text-right">Units</span><span className="text-right">Invoice</span></div>{runPreview.slice(0, 18).map((row) => <div key={row.clubId} className="grid grid-cols-[1fr_90px_120px] border-t border-slate-100 px-4 py-3 text-sm"><span className="font-black text-slate-900">{row.clubName}</span><span className="text-right font-semibold text-slate-500">{row.quantity}</span><span className="text-right font-black text-slate-950">{money(row.totalPence)}</span></div>)}{runPreview.length > 18 ? <div className="border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-slate-500">And {runPreview.length - 18} more clubs</div> : null}</div>
        <div className="mt-5 flex flex-wrap items-center gap-3"><label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-900"><input type="checkbox" checked={run.issueImmediately} onChange={(event) => setRun((current) => ({ ...current, issueImmediately: event.target.checked }))} /> Issue immediately to club portals</label><button type="button" disabled={busy || !data.access.canManage || !runPreview.length} onClick={createBillingRun} className={`${BUTTON} bg-emerald-600 text-white`}><WandSparkles size={14} /> {run.issueImmediately ? "Create and issue invoices" : "Create draft invoices"}</button></div>
      </div>
    </Panel>

    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <Panel className="p-6">
        <div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Upload size={22} /></div><div><h3 className="text-xl font-black text-slate-950">Payment reconciliation</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Upload a bank CSV, review Daxora's invoice matches and apply the approved payments as one controlled batch.</p></div></div><label className={`${BUTTON} cursor-pointer border border-slate-200 bg-white text-slate-700`}><Upload size={14} /> Select CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => readPaymentFile(event.target.files?.[0])} /></label></div>
        {paymentRows.length ? <><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{paymentFilename}</span><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{matchedRows.length} matched</span><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{paymentRows.length - matchedRows.length} need review</span></div><div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">{paymentRows.map((row) => { const selected = data.invoices.find((invoice) => invoice.id === row.matchedInvoiceId); const invalidAmount = selected && row.amountPence > selected.balancePence; return <div key={row.rowNumber} className={`rounded-2xl border p-4 ${row.matchedInvoiceId && !invalidAmount ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}><div className="grid gap-3 lg:grid-cols-[90px_110px_1fr_1.1fr]"><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Date</div><div className="mt-1 text-sm font-black">{row.date || "—"}</div></div><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Amount</div><div className="mt-1 text-sm font-black">{money(row.amountPence)}</div></div><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Bank reference</div><div className="mt-1 truncate text-sm font-bold">{row.reference || row.clubName || "No reference"}</div></div><select className={INPUT} value={row.matchedInvoiceId} onChange={(event) => setPaymentInvoice(row.rowNumber, event.target.value)}><option value="">Select invoice</option>{data.invoices.filter((invoice) => invoice.balancePence > 0 && !["draft", "void", "paid"].includes(invoice.status)).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.parentClubName} · {money(invoice.balancePence)}</option>)}</select></div>{invalidAmount ? <div className="mt-2 flex items-center gap-2 text-xs font-black text-rose-700"><AlertTriangle size={14} /> Payment exceeds the selected invoice balance.</div> : null}</div>; })}</div><button type="button" disabled={busy || !matchedRows.length || matchedRows.some((row) => { const invoice = data.invoices.find((item) => item.id === row.matchedInvoiceId); return !invoice || row.amountPence > invoice.balancePence; })} onClick={applyPayments} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><CheckCircle2 size={14} /> Apply {matchedRows.length} matched payments</button></> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center"><FileText className="mx-auto text-slate-300" size={30} /><div className="mt-3 text-sm font-black text-slate-700">No payment file loaded</div><div className="mt-1 text-xs font-semibold text-slate-500">Expected headings can include date, amount, reference, invoice and club.</div></div>}
      </Panel>

      <Panel className="p-6">
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-rose-50 p-3 text-rose-700"><Mail size={22} /></div><div><h3 className="text-xl font-black text-slate-950">Finance delivery history</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Invoice and reminder delivery evidence from the authorised email provider.</p></div></div>
        <div className="mt-5 space-y-3">{data.deliveryEvents.slice(0, 12).map((event) => <div key={event.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{event.invoiceNumber} · {event.parentClubName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{event.deliveryKind} · {dateLabel(event.createdAt)}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${event.status === "delivered" ? "bg-emerald-100 text-emerald-800" : event.status === "failed" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>{event.status}</span></div>{event.errorMessage ? <div className="mt-2 text-xs font-semibold text-rose-700">{event.errorMessage}</div> : null}</div>)}{!data.deliveryEvents.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No finance documents have been emailed yet.</div> : null}</div>
        <div className="mt-5 border-t border-slate-200 pt-5"><div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Recent automation runs</div><div className="mt-3 space-y-2">{data.billingRuns.slice(0, 8).map((runItem) => <div key={runItem.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><div className="text-sm font-black text-slate-900">{runItem.name}</div><div className="text-xs font-semibold text-slate-500">{runItem.invoiceCount} invoices · {dateLabel(runItem.createdAt)}</div></div><div className="text-right"><div className="text-sm font-black">{money(runItem.totalPence)}</div><div className="text-[10px] font-black uppercase text-slate-500">{runItem.status.replaceAll("_", " ")}</div></div></div>)}{!data.billingRuns.length ? <div className="text-sm font-semibold text-slate-500">No bulk runs completed yet.</div> : null}</div></div>
      </Panel>
    </div>
  </div>;
}
