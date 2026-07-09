import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, FileCheck2 } from "lucide-react";
import AnalyticsVisualDashboard from "../components/analytics/AnalyticsVisualDashboard.jsx";
import GrantImpactDashboard from "../components/analytics/GrantImpactDashboard.jsx";
import PlanFeatureNotice from "../components/PlanFeatureNotice.jsx";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";

const VIEWS = [
  {
    id: "performance",
    label: "Performance analytics",
    icon: BarChart3,
  },
  {
    id: "funding",
    label: "Funding evidence",
    icon: FileCheck2,
    entitlement: ENTITLEMENTS.ANALYTICS_ADVANCED,
  },
];

export default function AnalyticsPage({ subscription, onOpenSubscription, ...props }) {
  const [view, setView] = useState("performance");
  const advancedAnalyticsEnabled = hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_ADVANCED);
  const availableViews = useMemo(
    () => VIEWS.filter((item) => !item.entitlement || hasEntitlement(subscription, item.entitlement)),
    [subscription]
  );

  useEffect(() => {
    if (!availableViews.some((item) => item.id === view)) setView("performance");
  }, [availableViews, view]);

  return (
    <>
      <div className="mx-auto mb-6 w-full max-w-7xl space-y-4">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {availableViews.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${
                  active
                    ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={17} className={active ? "text-emerald-300" : "text-slate-400"} />
                {item.label}
              </button>
            );
          })}
        </div>

        {!advancedAnalyticsEnabled ? (
          <PlanFeatureNotice
            entitlement={ENTITLEMENTS.ANALYTICS_ADVANCED}
            subscription={subscription}
            title="Funding evidence is hidden on Core"
            description="Core includes the operational performance dashboard. The grant-impact evidence workspace and advanced evidence scoring are available from Pro."
            onOpenSubscription={onOpenSubscription}
            compact
          />
        ) : null}
      </div>

      {view === "performance" ? (
        <AnalyticsVisualDashboard {...props} />
      ) : (
        <GrantImpactDashboard {...props} />
      )}
    </>
  );
}
