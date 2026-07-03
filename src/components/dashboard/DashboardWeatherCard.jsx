import React from "react";
import {
  ArrowRight,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ThermometerSun,
  Wind,
} from "lucide-react";

function statusClasses(status) {
  if (status === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "neutral") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function DashboardWeatherCard({
  club,
  weatherLocation,
  weather,
  setMainPage,
  onRefresh,
  refreshing = false,
}) {
  const snapshot = weather || {};
  const location = snapshot.location || weatherLocation || "";
  const venueName = snapshot.venueName || club?.groundName || club?.venue || club?.name || "Club ground";
  const hasLocation = Boolean(snapshot.hasLocation ?? location);
  const forecast = snapshot.forecast || {};
  const forecastAvailable = Boolean(snapshot.forecastAvailable);
  const connecting = ["loading", "refreshing"].includes(snapshot.connectionStatus) || refreshing;

  const metrics = [
    { icon: ThermometerSun, label: "Temperature", value: forecastAvailable ? forecast.temperature : "--" },
    { icon: CloudSun, label: "Conditions", value: forecastAvailable ? forecast.conditions : connecting ? "Connecting" : "Unavailable" },
    { icon: Wind, label: "Wind", value: forecastAvailable ? forecast.wind : "--" },
    { icon: Droplets, label: "Rain", value: forecastAvailable ? forecast.rain : "--" },
    { icon: CloudRain, label: "Pitch Risk", value: forecastAvailable ? forecast.pitchRisk : "Not assessed" },
    { icon: ShieldCheck, label: "Ground Risk", value: forecastAvailable ? forecast.groundRisk : "Not assessed" },
  ];

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-5 border-b border-slate-200 p-6">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">
            Weather
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Ground Weather
          </h2>
          <p className="mt-2 max-w-xl text-base font-semibold leading-7 text-slate-500">
            Live forecast readiness for pitch-risk and postponement intelligence.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && hasLocation && snapshot.connectionStatus !== "disabled" ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh live weather"
              title="Refresh live weather"
            >
              <RefreshCw size={19} strokeWidth={2.5} className={refreshing ? "animate-spin" : ""} />
            </button>
          ) : null}
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <CloudSun size={30} strokeWidth={2.3} />
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-1 flex-col rounded-3xl border border-sky-100 bg-sky-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm ring-1 ring-sky-100">
                <MapPin size={22} strokeWidth={2.5} />
              </div>

              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">
                  Forecast Location
                </div>
                <div className="mt-1 text-3xl font-black text-slate-950">
                  {hasLocation ? location : "Postcode needed"}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-500">
                  {hasLocation ? venueName : "Add a ground postcode in Settings Centre."}
                </div>
              </div>
            </div>

            <span className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${statusClasses(snapshot.status)}`}>
              {snapshot.label || (hasLocation ? "Forecast needed" : "Configure")}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <WeatherTile key={metric.label} {...metric} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-sky-900/70">
            <span>
              {forecastAvailable ? (
                <>
                  Provider:{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-sky-400/50 underline-offset-2 hover:text-sky-950"
                  >
                    {snapshot.provider || "Open-Meteo"}
                  </a>
                </>
              ) : snapshot.connectionError || "No live forecast loaded yet"}
            </span>
            <span>{snapshot.dateLabel || "Selected matchday"}</span>
          </div>

          <button
            type="button"
            onClick={() => setMainPage(hasLocation ? "operations" : "settings")}
            className="mt-5 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md active:scale-[0.99]"
          >
            {hasLocation ? "Open weather intelligence" : "Set weather location"}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

function WeatherTile({ icon: Icon, label, value }) {
  return (
    <div className="flex aspect-square min-h-[112px] flex-col items-center justify-center rounded-2xl border border-sky-100 bg-white p-3 text-center shadow-sm">
      <Icon className="text-sky-700" size={22} strokeWidth={2.35} />
      <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{value || "--"}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
    </div>
  );
}
