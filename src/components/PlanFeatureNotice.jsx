import { ArrowRight, LockKeyhole } from "lucide-react";
import {
  ENTITLEMENTS,
  getPlanDefinition,
  getUpgradePlanForEntitlement,
} from "../lib/subscriptions/entitlements.js";

export default function PlanFeatureNotice({
  entitlement,
  subscription,
  title = "More capability is available on a higher plan",
  description = "This feature has been removed from the active workspace because it is not included in the club's current package.",
  onOpenSubscription,
  compact = false,
}) {
  const currentPlan = getPlanDefinition(subscription?.planCode);
  const requiredPlan = getUpgradePlanForEntitlement(entitlement);
  const isAnnualPlannerAddOn = entitlement === ENTITLEMENTS.ANNUAL_PLANNER && currentPlan.code === "core";
  const availabilityLabel = isAnnualPlannerAddOn
    ? "Available as a Core add-on or included in Pro and Elite"
    : `Available from ${requiredPlan.name}`;

  return (
    <section className={`rounded-[24px] border border-amber-200 bg-amber-50 ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-200">
            <LockKeyhole size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
              {currentPlan.name} plan
            </div>
            <h3 className="mt-1 text-base font-black text-amber-950">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-5 text-amber-900/75">{description}</p>
            <div className="mt-2 text-xs font-black text-amber-800">{availabilityLabel}</div>
          </div>
        </div>

        {onOpenSubscription ? (
          <button
            type="button"
            onClick={onOpenSubscription}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-950 px-4 text-xs font-black text-white transition hover:bg-amber-900"
          >
            {isAnnualPlannerAddOn ? "Review add-on" : "Review plans"} <ArrowRight size={15} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
