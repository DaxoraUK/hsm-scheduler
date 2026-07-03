import React from "react";
import {
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  Gauge,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getWorkspaceFeatures, withWorkspaceFeature } from "../../lib/settings/workspaceSettings.js";
import { tenantSetItem } from "../../lib/storage/tenantStorage.js";
import { ENTITLEMENTS, hasEntitlement } from "../../lib/subscriptions/entitlements.js";

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => { if (!disabled) onChange(!checked); }}
      disabled={disabled}
      className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300"} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition ${checked ? "left-7" : "left-1"}`} />
    </button>
  );
}

function ModuleCard({ icon: Icon, title, description, status = "Included", active = true, children }) {
  return (
    <div className={`rounded-[24px] border p-5 ${active ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${active ? "bg-slate-950 text-emerald-300" : "bg-slate-200 text-slate-500"}`}>
            <Icon size={21} strokeWidth={2.4} />
          </span>
          <div>
            <div className="text-base font-black text-slate-950">{title}</div>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
          {status}
        </span>
      </div>
      {children ? <div className="mt-5 border-t border-slate-100 pt-5">{children}</div> : null}
    </div>
  );
}

export default function WorkspaceSettingsPanel({
  club = {},
  setClub,
  saveTab,
  savedTab,
  productionMode,
  setProductionMode,
  setMode,
  subscription,
}) {
  const features = getWorkspaceFeatures(club);
  const parkingIncluded = hasEntitlement(subscription, ENTITLEMENTS.PARKING_INTELLIGENCE);
  const midweekIncluded = hasEntitlement(subscription, ENTITLEMENTS.MIDWEEK_SCHEDULING);
  const analyticsIncluded = hasEntitlement(subscription, ENTITLEMENTS.ANALYTICS_CORE);

  const updateMidweek = (enabled) => {
    if (!midweekIncluded) return;
    setClub((current) => withWorkspaceFeature(current, "midweekEnabled", enabled));
  };

  const updateParking = (enabled) => {
    if (!parkingIncluded) return;
    setClub((current) => withWorkspaceFeature(current, "parkingEnabled", enabled));
  };

  const updateProductionMode = (enabled) => {
    setProductionMode?.(enabled);
    setMode?.(enabled ? "live" : "test");
    tenantSetItem("productionMode", enabled ? "1" : "0");
  };

  const save = () => saveTab?.("workspace", { club });

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
              <Gauge size={14} />
              Workspace configuration
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Choose the product the club actually needs.</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 sm:text-base">
              Optional workspaces should disappear cleanly when they are not relevant. The underlying data is retained, so a module can be re-enabled later without losing previous records.
            </p>
          </div>

          <button
            type="button"
            onClick={save}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900"
          >
            <CheckCircle2 size={17} className="text-emerald-300" />
            {savedTab === "workspace" ? "Workspace saved" : "Save workspace"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ModuleCard
          icon={CalendarDays}
          title="Weekend Operations"
          description="Saturday and Sunday scheduling, resources, intelligence and communications."
          status="Core"
        />

        <ModuleCard
          icon={Car}
          title="Parking & Arrivals"
          description="Parking capacity, arrival-wave forecasting and parking-safe fixture recommendations."
          status={!parkingIncluded ? `${subscription?.planName || "Plan"} locked` : features.parkingEnabled ? "Enabled" : "Hidden"}
          active={parkingIncluded && features.parkingEnabled}
        >
          <div className="flex items-center justify-between gap-5">
            <div>
              <div className="text-sm font-black text-slate-900">Use parking intelligence</div>
              <div className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                Turn this off for clubs that do not manage on-site parking. Ground Control will remove parking checks, cards and recommendations without deleting saved capacities or vehicle estimates.
              </div>
            </div>
            <Toggle checked={parkingIncluded && features.parkingEnabled} onChange={updateParking} label="Enable Parking and Arrivals" disabled={!parkingIncluded} />
          </div>

          {!parkingIncluded ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-5 text-amber-900">
              Parking intelligence is not included in {subscription?.planName || "the current plan"}. Review Plan & subscription for upgrade options.
            </div>
          ) : !features.parkingEnabled ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm font-semibold leading-5 text-slate-700">
              Parking is excluded from launch readiness, schedule validation, recommendations and operational workspaces until it is switched back on.
            </div>
          ) : null}
        </ModuleCard>

        <ModuleCard
          icon={Clock3}
          title="Midweek Operations"
          description="Weekday fixture scheduling with a dedicated date and evening operating window."
          status={!midweekIncluded ? `${subscription?.planName || "Plan"} locked` : features.midweekEnabled ? "Enabled" : "Hidden"}
          active={midweekIncluded && features.midweekEnabled}
        >
          <div className="flex items-center justify-between gap-5">
            <div>
              <div className="text-sm font-black text-slate-900">Show Midweek across Ground Control</div>
              <div className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                Turning this off removes Midweek from Operations tabs, Mission Control scopes, analytics filters and workspace totals.
              </div>
            </div>
            <Toggle checked={midweekIncluded && features.midweekEnabled} onChange={updateMidweek} label="Enable Midweek Operations" disabled={!midweekIncluded} />
          </div>

          {!midweekIncluded ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-5 text-amber-900">
              Midweek operations are not included in {subscription?.planName || "the current plan"}.
            </div>
          ) : !features.midweekEnabled ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-5 text-amber-900">
              Existing Midweek data is retained but excluded from active matchweek views until the module is switched back on.
            </div>
          ) : null}
        </ModuleCard>

        <ModuleCard
          icon={RadioTower}
          title="Operations Centre & Timeline"
          description="Live control-room monitoring and the operational command timeline."
          status="Included"
        />

        <ModuleCard
          icon={BarChart3}
          title="Analytics & Funding Evidence"
          description="Operational trends, heatmaps, evidence readiness and reporting."
          status={analyticsIncluded ? "Included" : `${subscription?.planName || "Plan"} locked`}
          active={analyticsIncluded}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
            <ShieldCheck size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-950">Environment mode</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Production mode forces live operations and hides test-data controls. Keep development mode available only while the product is being demonstrated or configured.
            </p>

            <div className="mt-5 flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${productionMode ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  <Sparkles size={19} />
                </span>
                <div>
                  <div className="text-sm font-black text-slate-950">{productionMode ? "Production mode" : "Development mode"}</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-500">
                    {productionMode ? "Live data only. Test controls are hidden." : "Test data and demonstration controls remain available."}
                  </div>
                </div>
              </div>
              <Toggle checked={Boolean(productionMode)} onChange={updateProductionMode} label="Enable production mode" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
