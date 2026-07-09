import React, { useMemo } from "react";
import { CloudRain, CloudSun, Droplets, ThermometerSun, Wind } from "lucide-react";
import useLiveWeather from "../../hooks/useLiveWeather.js";
import { calculateWeatherIntelligence } from "../../lib/engines/weatherIntelligenceEngine.js";

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-sky-100 bg-white p-3">
      <div className="flex items-center gap-2 text-sky-700">
        <Icon size={15} strokeWidth={2.5} />
        <span className="text-[9px] font-black uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="mt-2 text-sm font-black text-slate-900">{value || "—"}</div>
    </div>
  );
}

export default function ReportWeatherSummary({ club, day, current = false }) {
  const activeFixtures = useMemo(
    () => (day?.rows || []).filter((row) => row.status === "delivered").map((row) => row.raw),
    [day]
  );
  const liveWeather = useLiveWeather({
    club,
    date: day?.date,
    fixtures: activeFixtures,
    enabled: current && Boolean(day?.date) && Boolean(day?.hasRun),
  });
  const snapshot = useMemo(
    () => calculateWeatherIntelligence({
      club,
      fixtures: activeFixtures,
      dateLabel: day?.dateLabel || day?.label || "Matchday",
      forecastSource: liveWeather.data,
      connectionStatus: current ? liveWeather.status : "idle",
      connectionError: current ? liveWeather.error : null,
    }),
    [activeFixtures, club, current, day?.dateLabel, day?.label, liveWeather.data, liveWeather.error, liveWeather.status]
  );

  if (!day?.hasRun) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
        Weather risk is not assessed until the schedule has been built for this day.
      </div>
    );
  }

  if (!current) {
    const savedRisks = (day?.rows || []).filter((row) => row.weatherRisk !== "unknown");
    if (!savedRisks.length) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
          Historical weather was not captured with this saved matchday. Ground Control will not replace it with a current forecast.
        </div>
      );
    }
    const high = savedRisks.filter((row) => row.weatherRisk === "high").length;
    const watch = savedRisks.filter((row) => row.weatherRisk === "watch").length;
    return (
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Saved weather exposure</div>
        <div className="mt-2 text-sm font-bold text-slate-700">
          {savedRisks.length} fixture{savedRisks.length === 1 ? "" : "s"} captured · {high} high risk · {watch} watch
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-700">Live weather</div>
          <div className="mt-1 text-base font-black text-slate-900">{snapshot.decision?.headline || snapshot.label}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{snapshot.location} · {snapshot.provider}</div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
          snapshot.status === "danger"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : snapshot.status === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : snapshot.status === "neutral"
                ? "border-slate-200 bg-slate-100 text-slate-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>{snapshot.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric icon={ThermometerSun} label="Temperature" value={snapshot.forecast?.temperature} />
        <Metric icon={CloudSun} label="Conditions" value={snapshot.forecast?.conditions} />
        <Metric icon={Wind} label="Wind" value={snapshot.forecast?.wind} />
        <Metric icon={Droplets} label="Rain" value={snapshot.forecast?.rain} />
        <Metric icon={CloudRain} label="Risk" value={snapshot.forecast?.groundRisk} />
      </div>
      {snapshot.forecastAvailable ? (
        <div className="mt-3 text-[10px] font-semibold text-sky-900/70">
          Forecast data: Open-Meteo · refreshed {snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString("en-GB") : "for this report"}
        </div>
      ) : (
        <div className="mt-3 text-xs font-semibold text-amber-700">{snapshot.connectionError || snapshot.decision?.detail}</div>
      )}
    </div>
  );
}
