import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { DB } from "../lib/supabase.js";
import {
  normalisePlatformBillingReadiness,
  validatePlatformLegalSettings,
} from "../lib/billing/billingModel.js";

const inputClass = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const textAreaClass = "min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const primaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function dateInput(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function readinessTone(ready) {
  return ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900";
}

function Metric({ label, value, helper, Icon }) {
  return <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Icon size={19} /></span><div className="mt-4 text-3xl font-black text-slate-950">{value}</div><div className="mt-1 text-sm font-black text-slate-800">{label}</div><div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div></div>;
}

function createSettingsDraft(settings = {}) {
  return {
    legalName: settings.legalName || "",
    tradingName: settings.tradingName || "Daxora",
    serviceAddress: settings.serviceAddress || "",
    websiteUrl: settings.websiteUrl || "",
    supportEmail: settings.supportEmail || "",
    privacyEmail: settings.privacyEmail || "",
    governingLaw: settings.governingLaw || "England and Wales",
    stripeMode: settings.stripeMode || "disabled",
    taxStatus: settings.taxStatus || "not_configured",
    vatNumber: settings.vatNumber || "",
    invoicePrefix: settings.invoicePrefix || "DAX",
  };
}

function createDocumentDraft(document = {}) {
  return {
    code: document.code || "",
    version: document.version || "1.0",
    title: document.title || "",
    category: document.category || "commercial",
    status: document.status || "draft",
    requiredForCheckout: Boolean(document.requiredForCheckout),
    documentUrl: document.documentUrl || "",
    contentHash: document.contentHash || "",
    effectiveAt: dateInput(document.effectiveAt || new Date()),
  };
}

export default function PlatformBillingLegalPanel({ isPlatformAdmin }) {
  const [status, setStatus] = useState("loading");
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState("");
  const [settingsDraft, setSettingsDraft] = useState(createSettingsDraft());
  const [documentDrafts, setDocumentDrafts] = useState({});
  const [busy, setBusy] = useState("");

  const applyPayload = useCallback((payload) => {
    const next = normalisePlatformBillingReadiness(payload || {});
    setReadiness(next);
    setSettingsDraft(createSettingsDraft(next.settings));
    setDocumentDrafts(Object.fromEntries(next.documents.map((document) => [`${document.code}:${document.version}`, createDocumentDraft(document)])));
    return next;
  }, []);

  const load = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setStatus("loading");
    setError("");
    try {
      applyPayload(await DB.platformGetBillingReadiness());
      setStatus("ready");
    } catch (loadError) {
      setStatus("error");
      setError(loadError?.message || "Billing readiness could not be loaded");
    }
  }, [applyPayload, isPlatformAdmin]);

  useEffect(() => { load(); }, [load]);

  const documentGroups = useMemo(() => {
    const docs = readiness?.documents || [];
    return docs.reduce((groups, document) => {
      if (!groups[document.code]) groups[document.code] = [];
      groups[document.code].push(document);
      return groups;
    }, {});
  }, [readiness?.documents]);

  const saveSettings = async () => {
    const errors = validatePlatformLegalSettings(settingsDraft);
    if (errors.length) {
      toast.error("Legal identity needs attention", { description: errors[0] });
      return;
    }
    setBusy("settings");
    try {
      applyPayload(await DB.platformUpdateLegalSettings(settingsDraft));
      toast.success("Billing and legal settings saved");
    } catch (saveError) {
      toast.error("Settings could not be saved", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const saveDocument = async (key) => {
    const document = documentDrafts[key];
    if (!document) return;
    if (!document.code || !document.version || !document.title) {
      toast.error("Document details are incomplete");
      return;
    }
    if (document.status === "published" && !/^https:\/\//i.test(document.documentUrl)) {
      toast.error("Published documents need a public HTTPS address");
      return;
    }
    setBusy(`document:${key}`);
    try {
      applyPayload(await DB.platformPublishLegalDocument({
        ...document,
        effectiveAt: document.effectiveAt ? new Date(document.effectiveAt).toISOString() : null,
      }));
      toast.success(`${document.title} updated`);
    } catch (saveError) {
      toast.error("Document could not be updated", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  if (!isPlatformAdmin) {
    return <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-900">Platform administrator access is required to configure commercial identity, legal documents or billing mode.</div>;
  }
  if (status === "loading") return <div className="flex min-h-[460px] items-center justify-center"><LoaderCircle className="animate-spin text-emerald-600" size={30} /></div>;
  if (!readiness) return <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-6"><div className="font-black text-rose-900">Billing readiness could not be loaded</div><div className="mt-2 text-sm font-semibold text-rose-800">{error}</div><button type="button" onClick={load} className={`${primaryButton} mt-5`}><RefreshCw size={16} /> Retry</button></div>;

  return (
    <div className="space-y-6">
      <section className={`rounded-[28px] border p-6 ${readinessTone(readiness.configurationReady)}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-start gap-3">{readiness.configurationReady ? <CheckCircle2 className="mt-0.5 shrink-0" size={22} /> : <AlertTriangle className="mt-0.5 shrink-0" size={22} />}<div><h2 className="text-xl font-black">{readiness.configurationReady ? "Billing launch gate passed" : "Billing launch gate is blocked"}</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6">The gate requires a complete sole-trader business identity, valid support and privacy contacts, test or live Stripe mode, and all required reviewed documents published at HTTPS addresses.</p></div></div><button type="button" onClick={load} className={secondaryButton}><RefreshCw size={15} /> Refresh</button></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Stripe customers" value={readiness.metrics.clubsWithStripeCustomer} helper="Club accounts linked to Stripe" Icon={CreditCard} />
        <Metric label="Active paid clubs" value={readiness.metrics.activePaidClubs} helper="Stripe-managed active subscriptions" Icon={ShieldCheck} />
        <Metric label="Failed webhooks" value={readiness.metrics.failedEvents} helper="Provider events needing investigation" Icon={AlertTriangle} />
        <Metric label="Pending webhooks" value={readiness.metrics.unprocessedEvents} helper="Events currently processing" Icon={RefreshCw} />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Scale size={21} /></span><div><h2 className="text-xl font-black text-slate-950">Business and invoicing identity</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Do not enable live mode until the legal name and service address have been reviewed for public use.</p></div></div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-black text-slate-600">Legal owner name<input value={settingsDraft.legalName} onChange={(event) => setSettingsDraft((current) => ({ ...current, legalName: event.target.value }))} className={`${inputClass} mt-2`} placeholder="Full sole-trader name" /></label>
          <label className="text-xs font-black text-slate-600">Trading name<input value={settingsDraft.tradingName} onChange={(event) => setSettingsDraft((current) => ({ ...current, tradingName: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-xs font-black text-slate-600 md:col-span-2">Service address<textarea value={settingsDraft.serviceAddress} onChange={(event) => setSettingsDraft((current) => ({ ...current, serviceAddress: event.target.value }))} className={`${textAreaClass} mt-2`} placeholder="Address where legal documents can be served" /></label>
          <label className="text-xs font-black text-slate-600">Website URL<input value={settingsDraft.websiteUrl} onChange={(event) => setSettingsDraft((current) => ({ ...current, websiteUrl: event.target.value }))} className={`${inputClass} mt-2`} placeholder="https://..." /></label>
          <label className="text-xs font-black text-slate-600">Governing law<input value={settingsDraft.governingLaw} onChange={(event) => setSettingsDraft((current) => ({ ...current, governingLaw: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-xs font-black text-slate-600">Support email<input type="email" value={settingsDraft.supportEmail} onChange={(event) => setSettingsDraft((current) => ({ ...current, supportEmail: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-xs font-black text-slate-600">Privacy email<input type="email" value={settingsDraft.privacyEmail} onChange={(event) => setSettingsDraft((current) => ({ ...current, privacyEmail: event.target.value }))} className={`${inputClass} mt-2`} /></label>
          <label className="text-xs font-black text-slate-600">Stripe mode<select value={settingsDraft.stripeMode} onChange={(event) => setSettingsDraft((current) => ({ ...current, stripeMode: event.target.value }))} className={`${inputClass} mt-2`}><option value="disabled">Disabled</option><option value="test">Test mode</option><option value="live">Live mode</option></select></label>
          <label className="text-xs font-black text-slate-600">Tax status<select value={settingsDraft.taxStatus} onChange={(event) => setSettingsDraft((current) => ({ ...current, taxStatus: event.target.value }))} className={`${inputClass} mt-2`}><option value="not_configured">Not configured</option><option value="not_vat_registered">Not VAT registered</option><option value="vat_registered">VAT registered</option></select></label>
          <label className="text-xs font-black text-slate-600">VAT number<input value={settingsDraft.vatNumber} onChange={(event) => setSettingsDraft((current) => ({ ...current, vatNumber: event.target.value }))} className={`${inputClass} mt-2`} disabled={settingsDraft.taxStatus !== "vat_registered"} /></label>
          <label className="text-xs font-black text-slate-600">Invoice prefix<input value={settingsDraft.invoicePrefix} onChange={(event) => setSettingsDraft((current) => ({ ...current, invoicePrefix: event.target.value }))} className={`${inputClass} mt-2`} /></label>
        </div>
        <button type="button" onClick={saveSettings} disabled={busy === "settings"} className={`${primaryButton} mt-6`}>{busy === "settings" ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save legal identity</button>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><FileCheck2 size={21} /></span><div><h2 className="text-xl font-black text-slate-950">Legal document register</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Drafts do not count toward billing readiness. Publish only reviewed documents hosted at stable public HTTPS addresses.</p></div></div>
        <div className="mt-6 space-y-4">
          {Object.entries(documentGroups).map(([code, versions]) => {
            const document = versions[0];
            const key = `${document.code}:${document.version}`;
            const draft = documentDrafts[key] || createDocumentDraft(document);
            return (
              <article key={key} className="rounded-[24px] border border-slate-200 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${draft.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{draft.status === "published" ? <CheckCircle2 size={19} /> : <FileText size={19} />}</span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{draft.title}</h3>{draft.requiredForCheckout ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">Checkout required</span> : null}</div><div className="mt-1 text-xs font-semibold text-slate-500">{code}</div></div></div>{draft.documentUrl ? <a href={draft.documentUrl} target="_blank" rel="noreferrer" className={secondaryButton}>Open <ExternalLink size={14} /></a> : null}</div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="text-xs font-black text-slate-600">Version<input value={draft.version} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, version: event.target.value } }))} className={`${inputClass} mt-2`} /></label>
                  <label className="text-xs font-black text-slate-600">Status<select value={draft.status} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, status: event.target.value } }))} className={`${inputClass} mt-2`}><option value="draft">Draft</option><option value="published">Published</option><option value="retired">Retired</option></select></label>
                  <label className="text-xs font-black text-slate-600">Category<select value={draft.category} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, category: event.target.value } }))} className={`${inputClass} mt-2`}><option value="commercial">Commercial</option><option value="privacy">Privacy</option><option value="security">Security</option><option value="operational">Operational</option></select></label>
                  <label className="text-xs font-black text-slate-600">Effective from<input type="datetime-local" value={draft.effectiveAt} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, effectiveAt: event.target.value } }))} className={`${inputClass} mt-2`} /></label>
                  <label className="text-xs font-black text-slate-600 xl:col-span-2">Public document URL<input value={draft.documentUrl} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, documentUrl: event.target.value } }))} className={`${inputClass} mt-2`} placeholder="https://..." /></label>
                  <label className="text-xs font-black text-slate-600">Content hash<input value={draft.contentHash} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, contentHash: event.target.value } }))} className={`${inputClass} mt-2`} placeholder="Optional SHA-256" /></label>
                  <label className="flex items-center gap-3 self-end rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700"><input type="checkbox" checked={draft.requiredForCheckout} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [key]: { ...draft, requiredForCheckout: event.target.checked } }))} /> Required for checkout</label>
                </div>
                <button type="button" onClick={() => saveDocument(key)} disabled={busy === `document:${key}`} className={`${primaryButton} mt-4`}>{busy === `document:${key}` ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save document version</button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
