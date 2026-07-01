import React from "react";
import { CloudSun, MapPin, RadioTower, ArrowRight, TriangleAlert, ShieldCheck } from "lucide-react";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

function getStatusVariant(status) {
  if (status === "warning") return "warning";
  if (status === "danger") return "danger";
  return "success";
}

function WeatherCheck({ check }) {
  const isWarning = check?.status === "warn";
  const Icon = isWarning ? TriangleAlert : ShieldCheck;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isWarning ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          <Icon size={18} strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-950">{check?.label}</div>
          <p className="mt-1 text-sm font-bold leading-5 text-slate-500">{check?.message}</p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardWeatherCard({ weather, setMainPage, setDayTab }) {
  const statusVariant = getStatusVariant(weather?.status);
  const checks = Array.isArray(weather?.checks) ? weather.checks.slice(0, 3) : [];

  return (
    <Card
      eyebrow="Weather"
      title="Ground Weather"
      subtitle="Venue postcode readiness for forecast, pitch-risk and postponement intelligence."
      action={<StatusChip variant={statusVariant}>{weather?.label || "Ready"}</StatusChip>}
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
        <div className="rounded-3xl border border-sky-100 bg-sky-50 p-5 text-sky-950">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100">
              <CloudSun size={26} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-sky-600">Forecast location</div>
              <div className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                {weather?.location || "Not set"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-sky-100">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <RadioTower size={14} strokeWidth={2.5} /> Provider
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">{weather?.provider || "Foundation"}</div>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-sky-100">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                <MapPin size={14} strokeWidth={2.5} /> Sites
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {weather?.siteCount || 1} configured
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMainPage?.("operations");
              setDayTab?.("saturday");
            }}
            className="mt-5 inline-flex w-full items-center justify-between rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-sky-100"
          >
            Open weather intelligence
            <ArrowRight size={17} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-3">
          {checks.length ? (
            checks.map((check) => <WeatherCheck key={check.id} check={check} />)
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-500">
              Weather checks are ready once a venue postcode has been configured.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
