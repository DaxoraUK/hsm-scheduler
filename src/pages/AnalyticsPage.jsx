import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileCheck2 } from "lucide-react";
import AnalyticsVisualDashboard from "../components/analytics/AnalyticsVisualDashboard.jsx";
import GrantImpactDashboard from "../components/analytics/GrantImpactDashboard.jsx";
import AnnualPlannerAnalyticsSummary from "../components/analytics/AnnualPlannerAnalyticsSummary.jsx";
import PlanFeatureNotice from "../components/PlanFeatureNotice.jsx";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { buildAnnualPlannerAnalyticsModel } from "../lib/analytics/annualPlannerAnalyticsEngine.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";

const VIEWS = [
  { id: "performance", label: "Operations analytics", icon: BarChart3 },
  { id: "funding", label: "Funding evidence", icon: FileCheck2, entitlement: ENTITLEMENTS.ANALYTICS_ADVANCED },
];

function yearRange(year) {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export default function AnalyticsPage({
  subscription,
  advancedAnalyticsEnabled: authoritativeAdvancedAnalyticsEnabled,
  onOpenSubscription,
  activeClubId,
  ...props
}) {
  const [view, setView] = useState("performance");
  const [plannerData, setPlannerData] = useState({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [] });
  const [plannerStatus, setPlannerStatus] = useState("idle");
  const year = new Date().getFullYear();
  const advancedAnalyticsEnabled = authoritativeAdvancedAnalyticsEnabled ?? hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_ADVANCED);
  const availableViews = useMemo(() => VIEWS.filter((item) => !item.entitlement || advancedAnalyticsEnabled), [advancedAnalyticsEnabled]);

  useEffect(() => {
    if (!availableViews.some((item) => item.id === view)) setView("performance");
  }, [availableViews, view]);

  useEffect(() => {
    let cancelled = false;
    if (!activeClubId || !isSupaConfigured()) {
      setPlannerData({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [] });
      return undefined;
    }
    setPlannerStatus("loading");
    DB.getAnnualPlannerAnalyticsData(activeClubId, yearRange(year))
      .then((data) => { if (!cancelled) { setPlannerData(data || {}); setPlannerStatus("ready"); } })
      .catch(() => { if (!cancelled) setPlannerStatus("error"); });
    return () => { cancelled = true; };
  }, [activeClubId, year]);

  const plannerModel = useMemo(() => buildAnnualPlannerAnalyticsModel({
    bookings: plannerData.bookings,
    blackouts: plannerData.blackouts,
    winterSites: plannerData.winter_sites || plannerData.winterSites,
    winterSlots: plannerData.winter_slots || plannerData.winterSlots,
    requests: plannerData.requests,
  }, { year }), [plannerData, year]);

  return <>
    <div className="mx-auto mb-6 w-full max-w-7xl space-y-4">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Analytics sections">
        {availableViews.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} role="tab" aria-selected={active} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={17} className={active ? "text-emerald-300" : "text-slate-400"} />{item.label}</button>; })}
      </div>
      {!advancedAnalyticsEnabled ? <PlanFeatureNotice entitlement={ENTITLEMENTS.ANALYTICS_ADVANCED} subscription={subscription} title="Funding evidence is hidden on Core" description="Core includes the operational analytics dashboard. The grant-impact evidence workspace and advanced evidence scoring are available from Pro." onOpenSubscription={onOpenSubscription} compact /> : null}
    </div>

    <div className="mx-auto mb-6 w-full max-w-7xl">
      {plannerStatus === "loading" ? <div className="h-36 animate-pulse rounded-[28px] bg-slate-200" /> : plannerStatus === "error" ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Annual Planner facility analytics are temporarily unavailable. Matchday analytics remain active.</div> : <AnnualPlannerAnalyticsSummary model={plannerModel} compact title="Training, weather and facility evidence" />}
    </div>

    {view === "performance" ? <AnalyticsVisualDashboard {...props} activeClubId={activeClubId} /> : <GrantImpactDashboard {...props} activeClubId={activeClubId} />}
  </>;
}
