import React from "react";
import {
  ArrowRight,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  ShieldCheck,
  Sun,
  ThermometerSun,
  Wind,
} from "lucide-react";

export default function DashboardWeatherCard({ club, weatherLocation, weather, setMainPage }) {
  const snapshot = weather || {};
  const location = snapshot.location || weatherLocation || "";
  const venueName = snapshot.venueName || club?.groundName || club?.venue || club?.name || "Club ground";
  const hasLocation = Boolean(snapshot.hasLocation ?? location);
  const forecast = snapshot.forecast || {};

  const metrics = [
    { icon: ThermometerSun, label: "Temperature", value: forecast.temperature || (hasLocation ? "18°" : "--") },
    { icon: Sun, label: "Conditions", value: forecast.conditions || (hasLocation ? "Dry" : "Pending") },
    { icon: Wind, label: "Wind", value: forecast.wind || (hasLocation ? "9 mph" : "--") },
    { icon: Droplets, label: "Rain", value: forecast.rain || (hasLocation ? "Low" : "Pending") },
    { icon: CloudRain, label: "Pitch Risk", value: forecast.pitchRisk || (hasLocation ? "Low" : "Set") },
    { icon: ShieldCheck, label: "Ground Risk", value: forecast.groundRisk || (hasLocation ? "Low" : "Set") },
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
            Forecast readiness for pitch-risk and postponement intelligence.
          </p>
        </div>

        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
          <CloudSun size={30} strokeWidth={2.3} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-1 flex-col rounded-3xl border border-sky-100 bg-sky-50 p-5">
          <div className="flex items-start gap-4">
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

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <WeatherTile key={metric.label} {...metric} />
            ))}
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
      <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
    </div>
  );
}
