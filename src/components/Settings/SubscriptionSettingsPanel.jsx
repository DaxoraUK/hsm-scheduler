import React from "react";
import {
  BadgePoundSterling,
  CalendarClock,
  Check,
  CreditCard,
  Gauge,
  HardDrive,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  ENTITLEMENTS,
  formatEntitlementLimit,
  getEntitlementLimit,
  hasEntitlement,
  LIMIT_KEYS,
  getLaunchPlans,
} from "../../lib/subscriptions/entitlements.js";

const FEATURE_LABELS = [
  [ENTITLEMENTS.MATCHDAY_SCHEDULING, "Saturday and Sunday scheduling"],
  [ENTITLEMENTS.MIDWEEK_SCHEDULING, "Midweek scheduling"],
  [ENTITLEMENTS.PITCH_INTELLIGENCE, "Pitch suitability and closures"],
  [ENTITLEMENTS.PARKING_INTELLIGENCE, "Parking capacity checks"],
  [ENTITLEMENTS.WEATHER_INTELLIGENCE, "Weather forecast and risk"],
  [ENTITLEMENTS.OFFICIALS_MANAGEMENT, "Officials management"],
  [
    ENTITLEMENTS.OPERATIONS_ADVANCED,
    "Operations Overview and Matchweek Timeline",
  ],
  [ENTITLEMENTS.REPORTS_OPERATIONS, "Operational reports"],
  [ENTITLEMENTS.REPORTS_ADVANCED, "Analytics and funding evidence reports"],
  [ENTITLEMENTS.ANALYTICS_CORE, "Performance analytics"],
  [ENTITLEMENTS.ANALYTICS_ADVANCED, "Funding evidence analytics"],
  [ENTITLEMENTS.DATA_EXPORT, "CSV data export"],
  [ENTITLEMENTS.MULTI_VENUE, "Multi-venue operations"],
  [ENTITLEMENTS.ORGANISATION_COMMAND, "Organisation Command Centre"],
  [ENTITLEMENTS.EXECUTIVE_REPORTING, "Executive and board reporting"],
  [ENTITLEMENTS.GOVERNANCE_CONTROLS, "Organisation governance controls"],
  [ENTITLEMENTS.APPROVAL_WORKFLOWS, "Recorded approval workflows"],
  [ENTITLEMENTS.SITE_RESPONSIBILITY, "Site-scoped responsibility and reviewers"],
  [ENTITLEMENTS.COMMUNICATION_GOVERNANCE, "Controlled communication templates"],
  [ENTITLEMENTS.FUNDING_PORTFOLIO, "Organisation funding portfolio"],
  [ENTITLEMENTS.ENHANCED_AUDIT, "Enhanced governance audit trail"],
  [ENTITLEMENTS.ANNUAL_PLANNER, "Annual pitch booking, training and friendlies"],
];

const PLAN_HIGHLIGHTS = Object.freeze({
  core: ["15 active teams", "Single-site matchday control", "Annual Planner available as a paid bolt-on"],
  pro: ["40 active teams and 4 sites", "Annual Planner included", "Funding evidence and configured email delivery"],
  elite: ["60 active teams and 8 sites", "Annual Planner and organisation-wide command included", "Executive board packs and contracted scale"],
});

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
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    value,
  );
}

function statusTone(status) {
  if (["active", "internal"].includes(status))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["trialing", "grace"].includes(status))
    return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

function UsageMeter({ label, current = 0, limit = 0, over = false }) {
  const unlimited = Number(limit) < 0;
  const percentage = unlimited ? 0 : Math.min(100, Math.round((Number(current) / Math.max(Number(limit), 1)) * 100));
  return (
    <div className={`rounded-2xl border p-4 ${over ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-700"><span>{label}</span><span>{current} / {unlimited ? "Unlimited" : limit}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${over ? "bg-rose-500" : percentage >= 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${unlimited ? 0 : percentage}%` }} /></div>
      <div className="mt-2 text-[10px] font-bold text-slate-500">{unlimited ? "No package ceiling" : over ? `${current - limit} over the contracted limit` : `${Math.max(0, limit - current)} remaining`}</div>
    </div>
  );
}

export default function SubscriptionSettingsPanel({
  subscription,
  subscriptionStatus = "idle",
  subscriptionError = "",
  onRefreshSubscription,
  workspaceAccess,
  planUsage = {},
  planCompliance = null,
}) {
  if (subscriptionStatus === "loading" || subscriptionStatus === "idle") {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <RefreshCw
            className="mx-auto animate-spin text-emerald-600"
            size={28}
          />
          <div className="mt-4 text-sm font-black text-slate-900">
            Loading subscription entitlements…
          </div>
        </div>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className="rounded-[28px] border border-rose-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <LockKeyhole size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950">
              Subscription access could not be verified
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              {subscriptionError ||
                "Ground Control could not confirm the club plan."}
            </p>
            <button
              type="button"
              onClick={onRefreshSubscription}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
            >
              <RefreshCw size={15} /> Retry
            </button>
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
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              <BadgePoundSterling size={14} /> Subscription
            </div>
            <h2 className="mt-4 text-4xl font-black tracking-tight">
              {subscription.planName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              {subscription.plan.strapline}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusTone(subscription.status)}`}
            >
              {subscription.statusLabel}
            </span>
            {subscription.isInternal ? (
              <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">
                Billing exempt
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4 lg:p-8">
          <Metric
            icon={CreditCard}
            label="Billing interval"
            value={
              subscription.isInternal
                ? "Internal"
                : subscription.billingInterval
            }
          />
          <Metric
            icon={CalendarClock}
            label="Trial ends"
            value={formatDate(subscription.trialEndsAt)}
          />
          <Metric
            icon={CalendarClock}
            label="Current period"
            value={formatDate(subscription.currentPeriodEnd)}
          />
          <Metric
            icon={ShieldCheck}
            label="Workspace access"
            value={subscription.canWrite ? "Full access" : "Read only"}
          />
        </div>

        {subscription.message ? (
          <div className="mx-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 lg:mx-8 lg:mb-8">
            {subscription.message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Gauge size={21} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-950">Plan limits</h3>
              <p className="text-sm font-semibold text-slate-500">
                Enforced by Supabase as well as the interface.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {LIMIT_LABELS.map(([key, label, Icon]) => {
              const current = planUsage?.[key];
              const limit = getEntitlementLimit(subscription, key);
              const check = planCompliance?.checks?.find((item) => item.key === key);
              return current === undefined
                ? <Metric key={key} icon={Icon} label={label} value={formatEntitlementLimit(limit)} compact />
                : <UsageMeter key={key} label={label} current={Number(current) || 0} limit={limit} over={Boolean(check?.over)} />;
            })}
          </div>
          {planCompliance?.overages?.length ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">This workspace exceeds {planCompliance.overages.map((item) => item.label).join(", ")}. Operations remain protected until capacity is increased or inactive resources are reduced.</div> : null}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Sparkles size={21} />
            </span>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Included capabilities
              </h3>
              <p className="text-sm font-semibold text-slate-500">
                Explicit entitlement keys keep packaging independent from the
                codebase.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {FEATURE_LABELS.map(([key, label]) => {
              const included = hasEntitlement(subscription, key);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-sm font-bold ${included ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${included ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}
                  >
                    {included ? <Check size={14} /> : <LockKeyhole size={13} />}
                  </span>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><TrendingUp size={20} /></span>
          <div>
            <h3 className="text-lg font-black text-slate-950">Commercial safeguards</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">Capacity can be extended without forcing a club into the wrong feature package. Provider usage, evidence storage, support and offboarding terms must be explicit before paid activation.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Capacity extensions", subscription.plan.commercial?.capacityExtensions ? "Available by agreement" : "Not available"],
            ["Communications allowance", subscription.plan.commercial?.communications || "Confirmed before activation"],
            ["Evidence storage", subscription.plan.commercial?.storage || "Confirmed before activation"],
            ["Support and onboarding", subscription.plan.commercial?.support || "Confirmed in the order form"],
            ["Cancellation and data exit", subscription.plan.commercial?.offboarding || "Data export available before closure"],
            ["Retention", `${formatEntitlementLimit(getEntitlementLimit(subscription, LIMIT_KEYS.HISTORY_RETENTION_DAYS))} days of saved matchweek history`],
          ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400"><HardDrive size={14} /> {label}</div><div className="mt-2 text-sm font-black leading-5 text-slate-900">{value}</div></div>)}
        </div>
        {subscription.cancelAtPeriodEnd ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Cancellation is scheduled for the end of the current billing period. Export operational and governance evidence before the workspace becomes read only.</div> : null}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Plan catalogue
            </div>
            <h3 className="mt-2 text-2xl font-black text-slate-950">
              Ground Control packages
            </h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Only launch-ready packages are shown. Core and Pro can use
              self-service monthly billing once checkout is enabled; Elite is
              arranged directly with Daxora.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
            Owner view only
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {getLaunchPlans().map((plan) => {
            const current = plan.code === subscription.planCode;
            return (
              <article
                key={plan.code}
                className={`rounded-[24px] border p-5 ${current ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100" : "border-slate-200 bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xl font-black text-slate-950">
                    {plan.name}
                  </h4>
                  {current ? (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-white">
                      Current
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 text-sm font-black text-emerald-700">
                  {formatPrice(plan)}
                </div>
                <p className="mt-3 text-sm font-semibold leading-5 text-slate-500">
                  {plan.strapline}
                </p>
                <div className="mt-4 space-y-2">
                  {(PLAN_HIGHLIGHTS[plan.code] || []).map((item) => (
                    <div key={item} className="flex items-start gap-2 text-xs font-bold leading-5 text-slate-600">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          During the pilot period, plan changes are applied by Daxora and
          recorded in the club audit log. Link is intentionally excluded from
          the launch catalogue until the league-connected product is
          operational. Club owners cannot grant themselves additional
          entitlements from the browser.
          {!workspaceAccess?.canManageSubscription
            ? " Only the club owner can view subscription administration."
            : ""}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, compact = false }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-slate-50 ${compact ? "p-3.5" : "p-4"}`}
    >
      <div className="flex items-center gap-2 text-slate-400">
        <Icon size={15} />
        <span className="text-[9px] font-black uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-2 truncate text-sm font-black capitalize text-slate-950">
        {value}
      </div>
    </div>
  );
}
