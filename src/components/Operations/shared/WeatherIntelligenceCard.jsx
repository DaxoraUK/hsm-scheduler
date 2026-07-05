import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudRain,
  CloudSun,
  Clock3,
  Droplets,
  MapPin,
  RadioTower,
  RefreshCw,
  ShieldCheck,
  ThermometerSun,
  TriangleAlert,
  Wind,
} from "lucide-react";
import StatusChip from "@/ui/StatusChip.jsx";

function riskTone(status) {
  if (status === "danger") return "border-rose-200 bg-rose-50 text-rose-950";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function statusVariant(status) {
  if (status === "danger") return "danger";
  if (status === "warning") return "warning";
  if (status === "neutral") return "neutral";
  return "success";
}

function formatUpdatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CheckIcon({ status }) {
  const warning = status === "warn";
  const Icon = warning ? TriangleAlert : ShieldCheck;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${warning ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
        <Icon size={15} strokeWidth={2.5} /> {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value || "—"}</div>
      {detail ? <div className="mt-1 text-xs font-bold text-slate-500">{detail}</div> : null}
    </div>
  );
}

function PriorityBadge({ priority }) {
  const classes = priority === "high"
    ? "bg-rose-100 text-rose-700"
    : priority === "medium"
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${classes}`}>
      {priority || "low"}
    </span>
  );
}

export default function WeatherIntelligenceCard({ weather, onRefresh, refreshing = false }) {
  const forecast = weather?.forecast || {};
  const riskWindows = weather?.riskWindows || [];
  const actions = weather?.actions || [];
  const overallRisk = weather?.overallRisk || { label: "Not assessed", status: "warning" };
  const cardTone = riskTone(weather?.status);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <CloudSun size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              Weather Intelligence
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {weather?.location || "Location not set"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              Operational weather guidance for fixture exposure, pitch inspection, site safety and matchday communications.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && weather?.connectionStatus !== "disabled" ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || !weather?.hasLocation}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={15} strokeWidth={2.5} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
          <StatusChip variant={statusVariant(weather?.status)}>{weather?.label || "Ready"}</StatusChip>
        </div>
      </div>

      <div className={`mt-6 rounded-3xl border p-5 ${cardTone}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] opacity-70">Decision summary</div>
            <div className="mt-2 text-xl font-black">{weather?.decision?.headline || "Weather status pending"}</div>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 opacity-80">
              {weather?.decision?.detail || "Complete the weather setup to generate matchday guidance."}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/80 px-4 py-3 text-center shadow-sm ring-1 ring-black/5">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Readiness</div>
            <div className="mt-1 text-3xl font-black">{weather?.score ?? 0}%</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={ThermometerSun} label="Temperature" value={forecast.temperature} />
        <Metric icon={CloudSun} label="Conditions" value={forecast.conditions} />
        <Metric icon={Wind} label="Wind" value={forecast.wind} />
        <Metric icon={Droplets} label="Rain chance" value={forecast.rain} detail={forecast.rainfall && forecast.rainfall !== "—" ? `${forecast.rainfall} expected` : null} />
        <Metric icon={CloudRain} label="Matchday risk" value={overallRisk.label} />
        <Metric icon={RadioTower} label="Provider" value={weather?.provider || "Not connected"} />
      </div>

      {riskWindows.length ? (
        <div className="mt-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Risk windows</div>
              <h4 className="mt-1 text-lg font-black text-slate-950">When conditions affect the schedule</h4>
            </div>
            <StatusChip variant={riskWindows.some((window) => window.risk?.status === "danger") ? "danger" : "warning"}>
              {riskWindows.length} window{riskWindows.length === 1 ? "" : "s"}
            </StatusChip>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {riskWindows.slice(0, 4).map((window) => (
              <div key={window.id} className={`rounded-2xl border p-4 ${riskTone(window.risk?.status)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-black">
                    <Clock3 size={18} strokeWidth={2.5} /> {window.label}
                  </div>
                  <StatusChip variant={statusVariant(window.risk?.status)}>{window.risk?.label || "Watch"}</StatusChip>
                </div>
                <div className="mt-3 text-sm font-bold opacity-80">
                  {window.conditions || "Forecast"}
                  {window.rainProbability != null ? ` · ${Math.round(window.rainProbability)}% rain` : ""}
                  {window.windMph != null ? ` · ${Math.round(window.windMph)} mph wind` : ""}
                </div>
                <div className="mt-3 space-y-1.5">
                  {window.fixtures.slice(0, 3).map((fixture) => (
                    <div key={fixture.id} className="rounded-xl bg-white/70 px-3 py-2 text-xs font-black ring-1 ring-black/5">
                      {fixture.time} · {fixture.label}
                    </div>
                  ))}
                  {window.fixtures.length > 3 ? (
                    <div className="text-xs font-black opacity-60">+{window.fixtures.length - 3} more fixtures</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${weather?.forecastAvailable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {weather?.forecastAvailable ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <AlertTriangle size={22} strokeWidth={2.5} />}
            </div>
            <div>
              <div className="text-base font-black text-slate-950">
                {weather?.forecastAvailable ? "No material fixture risk windows detected" : "Live forecast data is not connected"}
              </div>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                {weather?.forecastAvailable
                  ? "The supplied forecast does not currently place scheduled fixtures into a medium or high-risk window."
                  : "The venue setup can be checked now, but rain, wind, frost and heat decisions require a connected forecast feed."}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Operational actions</div>
          <div className="mt-3 space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black text-slate-950">{action.title}</div>
                    <p className="mt-1 text-sm font-bold leading-5 text-slate-500">{action.detail}</p>
                  </div>
                  <PriorityBadge priority={action.priority} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Setup checks</div>
          <div className="mt-3 space-y-3">
            {(weather?.checks || []).map((check) => (
              <div key={check.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-3">
                  <CheckIcon status={check.status} />
                  <div>
                    <div className="text-sm font-black text-slate-950">{check.label}</div>
                    <p className="mt-1 text-sm font-bold leading-5 text-slate-500">{check.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={15} strokeWidth={2.5} /> {weather?.venueName || "Club ground"} · {weather?.dateLabel || "Matchday"}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <span>
            {weather?.updatedAt ? `Updated ${formatUpdatedAt(weather.updatedAt)}` : "Forecast values only appear when real provider data is supplied"}
          </span>
          {weather?.forecastAvailable ? (
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
              className="font-black underline decoration-sky-400/50 underline-offset-2 hover:text-sky-950"
            >
              Weather data by Open-Meteo.com
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
