import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgePoundSterling,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";

import { DB } from "../../lib/supabase.js";
import {
  buildAcceptancePayload,
  canSelfServePlan,
} from "../../lib/billing/billingModel.js";
import { PLAN_CATALOGUE } from "../../lib/subscriptions/entitlements.js";

const primaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value, fallback = "Not recorded") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function priceLabel(plan, interval) {
  const pence = interval === "annual" ? plan.annualPricePence : plan.monthlyPricePence;
  if (!Number.isFinite(Number(pence))) return "Contact Daxora";
  const value = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(Number(pence) / 100);
  return interval === "annual" ? `${value}/year` : `${value}/month`;
}

function StatusCard({ icon: Icon, label, value, helper, tone = "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone] || tones.slate}`}><Icon size={19} /></span>
      <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-950">{value}</div>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{helper}</p>
    </div>
  );
}

export default function BillingLegalPanel({
  activeClubId,
  subscription,
  billing,
  billingStatus = "idle",
  billingError = "",
  onRefreshBilling,
  onRefreshSubscription,
  workspaceAccess,
}) {
  const [authorityConfirmed, setAuthorityConfirmed] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [selectedIntervals, setSelectedIntervals] = useState({ link: "monthly", core: "monthly", pro: "monthly" });

  const requiredDocuments = billing?.requiredDocuments || [];
  const supportingDocuments = useMemo(
    () => (billing?.documents || []).filter((document) => !document.requiredForCheckout),
    [billing?.documents]
  );
  const ownerAllowed = Boolean(workspaceAccess?.canManageSubscription);
  const billingExempt = Boolean(subscription?.billingExempt || subscription?.isInternal);

  const acceptDocuments = async () => {
    if (!activeClubId || !authorityConfirmed || !requiredDocuments.length) return;
    setBusyAction("accept");
    try {
      const payload = buildAcceptancePayload(requiredDocuments);
      await DB.acceptBillingLegalDocuments(activeClubId, payload, true);
      await onRefreshBilling?.();
      setAuthorityConfirmed(false);
      toast.success("Commercial documents accepted", { description: "The acceptance was recorded against this club and owner account." });
    } catch (error) {
      toast.error("Documents could not be accepted", { description: error?.message });
    } finally {
      setBusyAction("");
    }
  };

  const startCheckout = async (planCode) => {
    const interval = selectedIntervals[planCode] || "monthly";
    if (!canSelfServePlan(planCode, interval)) {
      toast.info("Contact Daxora for this package", { description: "Elite and bespoke arrangements are configured manually." });
      return;
    }
    setBusyAction(`checkout:${planCode}`);
    try {
      const result = await DB.createCheckoutSession(activeClubId, planCode, interval);
      if (!result?.url) throw new Error("Stripe did not return a checkout link.");
      window.location.assign(result.url);
    } catch (error) {
      toast.error("Checkout could not be opened", { description: error?.message });
      setBusyAction("");
    }
  };

  const openPortal = async () => {
    setBusyAction("portal");
    try {
      const result = await DB.createBillingPortal(activeClubId);
      if (!result?.url) throw new Error("Stripe did not return a billing portal link.");
      window.location.assign(result.url);
    } catch (error) {
      toast.error("Billing portal could not be opened", { description: error?.message });
      setBusyAction("");
    }
  };

  if (["idle", "loading"].includes(billingStatus)) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-4 text-sm font-black text-slate-900">Checking billing and legal readiness…</div></div>
      </section>
    );
  }

  if (!billing) {
    return (
      <section className="rounded-[28px] border border-rose-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><AlertTriangle size={22} /></span><div className="min-w-0 flex-1"><h2 className="text-xl font-black text-slate-950">Billing readiness could not be verified</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{billingError || "Ground Control could not confirm the legal or payment configuration."}</p><button type="button" onClick={onRefreshBilling} className={`${primaryButton} mt-5`}><RefreshCw size={15} /> Retry</button></div></div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 bg-slate-950 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><BadgePoundSterling size={14} /> Billing & legal</div><h2 className="mt-4 text-3xl font-black tracking-tight">Commercial account readiness</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Review the current legal documents, subscription payment state and secure Stripe billing actions for this club.</p></div>
          <button type="button" onClick={async () => { await onRefreshBilling?.(); await onRefreshSubscription?.(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15"><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={CreditCard} label="Payment provider" value={billingExempt ? "Billing exempt" : billing.provider === "stripe" ? "Stripe" : "Not connected"} helper={billing.externalCustomerId ? "A Stripe customer record is connected." : "No external customer is connected yet."} tone={billing.externalCustomerId ? "emerald" : "slate"} />
        <StatusCard icon={Scale} label="Legal documents" value={billing.legalAcceptanceComplete ? "Accepted" : "Action required"} helper={billing.legalAcceptanceComplete ? "Current required versions are accepted." : "The club owner must accept the current required documents."} tone={billing.legalAcceptanceComplete ? "emerald" : "amber"} />
        <StatusCard icon={ShieldCheck} label="Self-service billing" value={billing.billingEnabled ? "Enabled" : "Not live"} helper={billing.billingEnabled ? `${billing.stripeMode} billing configuration is active.` : "Daxora must publish reviewed documents and configure Stripe."} tone={billing.billingEnabled ? "emerald" : "amber"} />
        <StatusCard icon={Clock3} label="Last payment" value={formatDate(billing.lastPaymentAt, "None recorded")} helper={billing.lastInvoiceStatus ? `Latest invoice status: ${billing.lastInvoiceStatus}.` : "No paid invoice has been recorded."} tone={billing.paymentFailureCount > 0 ? "rose" : "sky"} />
      </section>

      {billingExempt ? (
        <section className="rounded-[28px] border border-violet-200 bg-violet-50 p-6">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 text-violet-700" size={22} /><div><h3 className="text-lg font-black text-violet-950">Internal billing exemption</h3><p className="mt-2 text-sm font-semibold leading-6 text-violet-800">This design-partner workspace is not charged through self-service billing. Its plan can only be changed by a Daxora platform administrator.</p></div></div>
        </section>
      ) : null}

      {!billing.billingEnabled ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 text-amber-700" size={22} /><div><h3 className="text-lg font-black text-amber-950">Checkout remains safely disabled</h3><p className="mt-2 text-sm font-semibold leading-6 text-amber-900">Daxora has not yet completed the business identity, reviewed legal documents and Stripe environment configuration. Ground Control will not collect payment until all three are ready.</p></div></div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><FileCheck2 size={21} /></span><div><h3 className="text-xl font-black text-slate-950">Commercial documents</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Privacy information is provided for transparency. Only documents marked required form the checkout acceptance record.</p></div></div>

          {!billing.documents.length ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-600">No reviewed documents have been published yet.</div> : (
            <div className="mt-5 space-y-3">
              {billing.documents.map((document) => (
                <div key={`${document.code}:${document.version}`} className="flex flex-col gap-3 rounded-[22px] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${document.accepted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{document.accepted ? <Check size={17} /> : <FileText size={17} />}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="font-black text-slate-950">{document.title}</div>{document.requiredForCheckout ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">Required</span> : null}{document.accepted ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-800">Accepted</span> : null}</div><div className="mt-1 text-xs font-semibold text-slate-500">Version {document.version}{document.effectiveAt ? ` · Effective ${formatDate(document.effectiveAt, "")}` : ""}</div></div></div>
                  {document.documentUrl ? <a href={document.documentUrl} target="_blank" rel="noreferrer" className={secondaryButton}>Read <ExternalLink size={15} /></a> : null}
                </div>
              ))}
            </div>
          )}

          {requiredDocuments.length && !billing.legalAcceptanceComplete && !billingExempt ? (
            <div className="mt-5 rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
              <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={authorityConfirmed} onChange={(event) => setAuthorityConfirmed(event.target.checked)} className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600" /><span className="text-sm font-semibold leading-6 text-emerald-950">I confirm that I am authorised to bind this club and accept the current Business Service Terms, Data Processing Addendum and Acceptable Use Policy.</span></label>
              <button type="button" onClick={acceptDocuments} disabled={!authorityConfirmed || busyAction === "accept" || !billing.billingEnabled} className={`${primaryButton} mt-4`}>{busyAction === "accept" ? <LoaderCircle className="animate-spin" size={16} /> : <FileCheck2 size={16} />} Accept current documents</button>
            </div>
          ) : null}

          {supportingDocuments.length ? <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">The Privacy Notice and Cookie Notice are supplied as information, not treated as consent to process personal data.</p> : null}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><CreditCard size={21} /></span><div><h3 className="text-xl font-black text-slate-950">Manage billing</h3><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Payment methods, invoices and cancellation are handled in Stripe’s hosted customer portal.</p></div></div>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Current package</div><div className="mt-1 text-lg font-black text-slate-950">{subscription?.planName || "Unverified"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{subscription?.statusLabel || "Unknown status"}</div></div>
            {billing.externalCustomerId && !billingExempt ? <button type="button" onClick={openPortal} disabled={busyAction === "portal"} className={`${primaryButton} w-full`}>{busyAction === "portal" ? <LoaderCircle className="animate-spin" size={16} /> : <ExternalLink size={16} />} Open secure billing portal</button> : null}
            {!billing.externalCustomerId && !billingExempt ? <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm font-semibold leading-6 text-slate-600">A Stripe customer will be created only when the owner starts a valid checkout.</div> : null}
          </div>
        </div>
      </section>

      {!billingExempt ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Secure checkout</div><h3 className="mt-2 text-2xl font-black text-slate-950">Choose a Ground Control package</h3><p className="mt-2 text-sm font-semibold text-slate-500">Checkout is available only to the club owner after the current required documents have been accepted.</p></div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {["link", "core", "pro"].map((planCode) => {
              const plan = PLAN_CATALOGUE[planCode];
              const interval = selectedIntervals[planCode] || "monthly";
              const current = subscription?.planCode === planCode;
              const checkoutDisabled = !ownerAllowed || !billing.checkoutReady || current;
              return (
                <article key={planCode} className={`rounded-[24px] border p-5 ${current ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-3"><h4 className="text-xl font-black text-slate-950">{plan.name}</h4>{current ? <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">Current</span> : null}</div>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-500">{plan.strapline}</p>
                  <div className="mt-4 text-xl font-black text-emerald-700">{priceLabel(plan, interval)}</div>
                  {plan.annualPricePence ? <select value={interval} onChange={(event) => setSelectedIntervals((currentIntervals) => ({ ...currentIntervals, [planCode]: event.target.value }))} className="mt-4 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"><option value="monthly">Monthly billing</option><option value="annual">Annual billing</option></select> : null}
                  <button type="button" onClick={() => startCheckout(planCode)} disabled={checkoutDisabled || busyAction.startsWith("checkout:")} className={`${primaryButton} mt-4 w-full`}>{busyAction === `checkout:${planCode}` ? <LoaderCircle className="animate-spin" size={16} /> : current ? <CheckCircle2 size={16} /> : <CreditCard size={16} />}{current ? "Current plan" : `Choose ${plan.name}`}</button>
                </article>
              );
            })}
          </div>
          {!billing.checkoutReady ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /> Checkout remains disabled until Daxora billing is live and the club owner has accepted every current required document.</div> : null}
        </section>
      ) : null}
    </div>
  );
}
