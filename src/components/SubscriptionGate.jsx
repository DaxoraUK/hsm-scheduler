import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  getPlanDefinition,
  getUpgradePlanForEntitlement,
} from "../lib/subscriptions/entitlements.js";

function formatPrice(plan) {
  if (!Number.isFinite(Number(plan?.monthlyPricePence))) return "Contact Daxora";
  const amount = Number(plan.monthlyPricePence) / 100;
  return `${new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(amount)}/month`;
}

export default function SubscriptionGate({
  entitlement,
  subscription,
  title = "This workspace is not included in the current plan",
  onOpenSubscription,
}) {
  const currentPlan = getPlanDefinition(subscription?.planCode);
  const requiredPlan = getUpgradePlanForEntitlement(entitlement);

  return (
    <div className="mx-auto flex min-h-[560px] w-full max-w-5xl items-center justify-center py-10">
      <section className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-xl shadow-slate-950/5">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="bg-slate-950 p-7 text-white sm:p-10">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <LockKeyhole size={27} />
            </span>
            <div className="mt-6 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Plan entitlement</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              {currentPlan.name} remains active for the features included in that package. Ground Control has blocked this area before any restricted action or data request is made.
            </p>
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200">
              <ShieldCheck size={15} className="text-emerald-300" /> Current plan: {currentPlan.name}
            </div>
          </div>

          <div className="p-7 sm:p-10">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Available from</div>
            <div className="mt-3 text-3xl font-black text-slate-950">{requiredPlan.name}</div>
            <div className="mt-2 text-sm font-black text-emerald-700">{formatPrice(requiredPlan)}</div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">{requiredPlan.strapline}</p>

            <button
              type="button"
              onClick={onOpenSubscription}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900"
            >
              Review plans <ArrowRight size={17} className="text-emerald-300" />
            </button>
            <p className="mt-3 text-center text-xs font-semibold text-slate-400">Plan changes remain manually controlled during the pilot period.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
