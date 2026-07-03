import React from "react";
import {
  BadgePoundSterling,
  CalendarClock,
  Check,
  CreditCard,
  Gauge,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  ENTITLEMENTS,
  formatEntitlementLimit,
  getEntitlementLimit,
  hasEntitlement,
  LIMIT_KEYS,
  PLAN_CATALOGUE,
} from "../../lib/subscriptions/entitlements.js";

const FEATURE_LABELS = [
  [ENTITLEMENTS.LEAGUE_LINK, "League connection foundation"],
  [ENTITLEMENTS.MATCHDAY_SCHEDULING, "Matchday scheduling"],
  [ENTITLEMENTS.PARKING_INTELLIGENCE, "Parking intelligence"],
  [ENTITLEMENTS.WEATHER_INTELLIGENCE, "Live weather intelligence"],
  [ENTITLEMENTS.OFFICIALS_MANAGEMENT, "Officials management"],
  [ENTITLEMENTS.REPORTS_OPERATIONS, "Operational reports"],
  [ENTITLEMENTS.ANALYTICS_CORE, "Performance analytics"],
  [ENTITLEMENTS.ANALYTICS_ADVANCED, "Advanced analytics"],
  [ENTITLEMENTS.MULTI_VENUE, "Multi-venue operations"],
  [ENTITLEMENTS.PREMIUM_SUPPORT, "Premium support"],
];

const LIMIT_LABELS = [
  [LIMIT_KEYS.TEAMS, "Teams", UsersRound],
  [LIMIT_KEYS.VENUES, "Venues", Gauge],
  [LIMIT_KEYS.USERS, "Workspace users", ShieldCheck],
  [LIMIT_KEYS.PITCHES, "Pitches", Gauge],
  [LIMIT_KEYS.HISTORY_ENTRIES, "Saved matchweeks", CalendarClock],
  [LIMIT_KEYS.HISTORY_RETENTION_DAYS, "History retention days", CalendarClock],
];

function formatPrice(plan) {
  const monthly = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(plan.monthlyPricePence / 100);

  if (plan.annualPricePence) {
    const annual = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(plan.annualPricePence / 100);
    return `${monthly}/month or ${annual}/year`;
  }
  return plan.code === "elite" ? `From ${monthly}/month` : `${monthly}/month`;
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(value);
}

function statusTone(status) {
  if (["active", "internal"].includes(status)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["trialing", "grace"].includes(status)) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function SubscriptionSettingsPanel({
  subscription,
  subscriptionStatus = "idle",
  subscriptionError = "",
  onRefreshSubscription,
  workspaceAccess,
}) {
  if (subscriptionStatus === "loading" || subscriptionStatus === "idle") {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} />
          <div className="mt-4 text-sm font-black text-slate-900">Loading subscription entitlements…</div>
        </div>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className="rounded-[28px] border border-rose-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><LockKeyhole size={22} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950">Subscription access could not be verified</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{subscriptionError || "Ground Control could not confirm the club plan."}</p>
            <button type="button" onClick={onRefreshSubscription} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"><RefreshCw size={15} /> Retry</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-slate-950 p-6 text-white lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><BadgePoundSterling size={14} /> Subscription</div>
            <h2 className="mt-4 text-4xl font-black tracking-tight">{subscription.planName}</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">{subscription.plan.strapline}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(subscription.status)}`}>{subscription.statusLabel}</span>
            {subscription.isInternal ? <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">Billing exempt</span> : null}
          </div>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4 lg:p-8">
          <Metric icon={CreditCard} label="Billing interval" value={subscription.isInternal ? "Internal" : subscription.billingInterval} />
          <Metric icon={CalendarClock} label="Trial ends" value={formatDate(subscription.trialEndsAt)} />
          <Metric icon={CalendarClock} label="Current period" value={formatDate(subscription.currentPeriodEnd)} />
          <Metric icon={ShieldCheck} label="Workspace access" value={subscription.canWrite ? "Full access" : "Read only"} />
        </div>

        {subscription.message ? <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 lg:mx-8 lg:mb-8">{subscription.message}</div> : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Gauge size={21} /></span><div><h3 className="text-lg font-black text-slate-950">Plan limits</h3><p className="text-sm font-semibold text-slate-500">Enforced by Supabase as well as the interface.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {LIMIT_LABELS.map(([key, label, Icon]) => <Metric key={key} icon={Icon} label={label} value={formatEntitlementLimit(getEntitlementLimit(subscription, key))} compact />)}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Sparkles size={21} /></span><div><h3 className="text-lg font-black text-slate-950">Included capabilities</h3><p className="text-sm font-semibold text-slate-500">Explicit entitlement keys keep packaging independent from the codebase.</p></div></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {FEATURE_LABELS.map(([key, label]) => {
              const included = hasEntitlement(subscription, key);
              return <div key={key} className={`flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-bold ${included ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-400"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-full ${included ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>{included ? <Check size={14} /> : <LockKeyhole size={13} />}</span>{label}</div>;
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plan catalogue</div><h3 className="mt-2 text-2xl font-black text-slate-950">Ground Control packages</h3><p className="mt-2 text-sm font-semibold text-slate-500">Pricing is shown for commercial planning. Live self-service billing is connected in the billing phase.</p></div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">Owner view only</div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {Object.values(PLAN_CATALOGUE).map((plan) => {
            const current = plan.code === subscription.planCode;
            return <article key={plan.code} className={`rounded-[24px] border p-5 ${current ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><h4 className="text-xl font-black text-slate-950">{plan.name}</h4>{current ? <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">Current</span> : null}</div><div className="mt-2 text-sm font-black text-emerald-700">{formatPrice(plan)}</div><p className="mt-3 text-sm font-semibold leading-5 text-slate-500">{plan.strapline}</p></article>;
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          During the pilot period, plan changes are applied by Daxora and recorded in the club audit log. Club owners cannot grant themselves additional entitlements from the browser.
          {!workspaceAccess?.canManageSubscription ? " Only the club owner can view subscription administration." : ""}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, compact = false }) {
  return <div className={`rounded-2xl border border-slate-200 bg-slate-50 ${compact ? "p-3.5" : "p-4"}`}><div className="flex items-center gap-2 text-slate-400"><Icon size={15} /><span className="text-[9px] font-black uppercase tracking-[0.16em]">{label}</span></div><div className="mt-2 truncate text-sm font-black capitalize text-slate-950">{value}</div></div>;
}
