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

export default function DashboardWeatherCard({ club, weatherLocation, setMainPage }) {
  const venueName = club?.groundName || club?.venue || club?.name || "Club ground";
  const hasLocation = Boolean(weatherLocation);

  return (
    <section className="flex h-full min-h-[390px] flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
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
                {hasLocation ? weatherLocation : "Postcode needed"}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-500">
                {hasLocation ? venueName : "Add a ground postcode in Settings Centre."}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <WeatherMetric label="Temp" value={hasLocation ? "18°" : "--"} icon={ThermometerSun} />
            <WeatherMetric label="Conditions" value={hasLocation ? "Dry" : "Pending"} icon={Sun} />
            <WeatherMetric label="Wind" value={hasLocation ? "9 mph" : "--"} icon={Wind} />
            <WeatherMetric label="Risk" value={hasLocation ? "Low" : "Set"} icon={ShieldCheck} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <WeatherInsight
              icon={Droplets}
              label="Rain"
              value={hasLocation ? "Low" : "Pending"}
            />
            <WeatherInsight
              icon={CloudRain}
              label="Pitch risk"
              value={hasLocation ? "Low" : "Set location"}
            />
          </div>

          <button
            type="button"
            onClick={() => setMainPage(hasLocation ? "operations" : "settings")}
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left font-black text-slate-950 shadow-sm ring-1 ring-sky-100 transition hover:bg-sky-100"
          >
            {hasLocation ? "Open weather intelligence" : "Set weather location"}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function WeatherMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl bg-white/90 p-3 text-center ring-1 ring-sky-100">
      <Icon className="mx-auto text-sky-700" size={20} strokeWidth={2.4} />
      <div className="mt-2 text-base font-black text-slate-950">{value}</div>
      <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
    </div>
  );
}

function WeatherInsight({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-sky-100">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-sm font-black text-slate-950">{value}</div>
      </div>
      <Icon className="text-sky-700" size={19} strokeWidth={2.4} />
    </div>
  );
}
