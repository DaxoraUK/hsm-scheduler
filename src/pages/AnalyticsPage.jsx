import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, FileCheck2, Gauge } from "lucide-react";
import AnalyticsVisualDashboard from "../components/analytics/AnalyticsVisualDashboard.jsx";
import GrantImpactDashboard from "../components/analytics/GrantImpactDashboard.jsx";
import AnnualPlannerAnalyticsSummary from "../components/analytics/AnnualPlannerAnalyticsSummary.jsx";
import UnifiedFacilityAnalyticsDashboard from "../components/analytics/UnifiedFacilityAnalyticsDashboard.jsx";
import PlanFeatureNotice from "../components/PlanFeatureNotice.jsx";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { buildAnnualPlannerAnalyticsModel } from "../lib/analytics/annualPlannerAnalyticsEngine.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";

const VIEWS = [
  { id: "facilities", label: "Facility usage", icon: Gauge },
  { id: "matchday", label: "Matchday detail", icon: BarChart3 },
  { id: "funding", label: "Funding evidence", icon: FileCheck2, entitlement: ENTITLEMENTS.ANALYTICS_ADVANCED },
];

function analyticsRange(year) {
  return { startDate: `${year - 1}-01-01`, endDate: `${year + 1}-12-31` };
}

export default function AnalyticsPage({
  subscription,
  advancedAnalyticsEnabled: authoritativeAdvancedAnalyticsEnabled,
  onOpenSubscription,
  activeClubId,
  ...props
}) {
  const [view, setView] = useState("facilities");
  const [plannerData, setPlannerData] = useState({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [] });
  const [plannerStatus, setPlannerStatus] = useState("idle");
  const year = new Date().getFullYear();
  const advancedAnalyticsEnabled = authoritativeAdvancedAnalyticsEnabled ?? hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_ADVANCED);
  const availableViews = useMemo(() => VIEWS.filter((item) => !item.entitlement || advancedAnalyticsEnabled), [advancedAnalyticsEnabled]);

  useEffect(() => {
    if (!availableViews.some((item) => item.id === view)) setView("facilities");
  }, [availableViews, view]);

  const loadPlannerData = useCallback(() => {
    let active = true;
    if (!activeClubId || !isSupaConfigured()) {
      setPlannerData({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [] });
      setPlannerStatus("ready");
      return () => { active = false; };
    }
    setPlannerStatus("loading");
    DB.getAnnualPlannerAnalyticsData(activeClubId, analyticsRange(year))
      .then((data) => { if (active) { setPlannerData(data || {}); setPlannerStatus("ready"); } })
      .catch(() => { if (active) setPlannerStatus("error"); });
    return () => { active = false; };
  }, [activeClubId, year]);

  useEffect(() => loadPlannerData(), [loadPlannerData]);

  const plannerModel = useMemo(() => buildAnnualPlannerAnalyticsModel({
    bookings: plannerData.bookings,
    blackouts: plannerData.blackouts,
    winterSites: plannerData.winter_sites || plannerData.winterSites,
    winterSlots: plannerData.winter_slots || plannerData.winterSlots,
    requests: plannerData.requests,
    allocationRuns: plannerData.allocation_runs || plannerData.allocationRuns,
    allocationItems: plannerData.allocation_items || plannerData.allocationItems,
    closureImpacts: plannerData.closure_impacts || plannerData.closureImpacts,
    resources: plannerData.resources,
    waitlist: plannerData.waitlist,
    seasonRollovers: plannerData.season_rollovers || plannerData.seasonRollovers,
    waitlistOffers: plannerData.waitlist_offers || plannerData.waitlistOffers,
    bulkCommands: plannerData.bulk_commands || plannerData.bulkCommands,
  }, { year }), [plannerData, year]);

  return <>
    <div className="mx-auto mb-6 w-full max-w-7xl space-y-4">
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="Analytics sections">
        {availableViews.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" onClick={() => setView(item.id)} role="tab" aria-selected={active} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={17} className={active ? "text-emerald-300" : "text-slate-400"} />{item.label}</button>; })}
      </div>
      {!advancedAnalyticsEnabled ? <PlanFeatureNotice entitlement={ENTITLEMENTS.ANALYTICS_ADVANCED} subscription={subscription} title="Funding evidence is hidden on Core" description="Core includes the unified facility and matchday analytics dashboards. The grant-impact evidence workspace and advanced evidence scoring are available from Pro." onOpenSubscription={onOpenSubscription} compact /> : null}
    </div>

    {view === "facilities" ? <>
      <UnifiedFacilityAnalyticsDashboard {...props} activeClubId={activeClubId} plannerData={plannerData} plannerStatus={plannerStatus} onRefresh={loadPlannerData} />
      <div className="mx-auto mt-6 w-full max-w-7xl">
        {plannerStatus === "loading" ? <div className="h-36 animate-pulse rounded-[28px] bg-slate-200" /> : <AnnualPlannerAnalyticsSummary model={plannerModel} compact title="Annual Planner demand, weather and recovery detail" />}
      </div>
    </> : null}
    {view === "matchday" ? <AnalyticsVisualDashboard {...props} activeClubId={activeClubId} /> : null}
    {view === "funding" ? <GrantImpactDashboard {...props} activeClubId={activeClubId} /> : null}
  </>;
}
