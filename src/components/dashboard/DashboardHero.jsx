import React, { useEffect, useState } from "react";
import {
  Rocket,
  CheckCircle2,
  AlertTriangle,
  CloudSun,
  MapPin,
} from "lucide-react";

export default function DashboardHero({
  readiness,
  totalFixtures,
  peakCars,
  carCap,
  refWarnings,
  saveWeek,
  weather,
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pct = readiness?.pct ?? 0;
  const parkingPct = Math.round((peakCars / Math.max(carCap, 1)) * 100);
  const ready = pct >= 90;

  const weatherLocation = weather?.location || "Set postcode";
  const weatherReady = weather?.status !== "warning" && weather?.status !== "danger";

  return (
    <section className="overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-900 text-white shadow-xl">
      <div className="grid gap-10 p-10 lg:grid-cols-[1.35fr_460px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-300 ring-1 ring-emerald-400/20">
            {ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            {ready ? "Weekend Ready" : "Action Required"}
          </div>

          <h1 className="mt-5 text-5xl font-black tracking-tight">
            Weekend Operations Centre
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Everything required for this weekend is currently{" "}
            <span className="font-black text-white">{pct}% complete</span>.
            Monitor fixtures, parking, officials and readiness from one place.
          </p>

          <div className="mt-8 max-w-xl">
            <div className="mb-2 flex items-center justify-between text-sm font-bold">
              <span className="text-slate-300">Operational readiness</span>
              <span className="text-white">{pct}%</span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${
                  ready ? "bg-emerald-400" : "bg-amber-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={saveWeek}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-base font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <Rocket size={20} strokeWidth={2.5} />
              Publish Weekend
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white/10 p-8 backdrop-blur-md ring-1 ring-white/10">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
                Live Status
              </div>

              <div className="mt-3 text-5xl font-black">
                {now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>

              <div className="text-slate-300">
                {now.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>

            <div className="min-w-[150px] rounded-3xl bg-white/10 p-4 text-right ring-1 ring-white/10">
              <div
                className={`ml-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
                  weatherReady
                    ? "bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/30"
                    : "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30"
                }`}
              >
                <CloudSun size={30} strokeWidth={2.5} />
              </div>

              <div className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                Weather
              </div>
              <div className="mt-1 truncate text-sm font-black text-white">
                {weatherLocation}
              </div>
              <div className="mt-1 flex items-center justify-end gap-1 text-xs font-bold text-slate-300">
                <MapPin size={12} strokeWidth={2.5} />
                {weather?.provider || "Foundation"}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-5">
            <Stat label="Fixtures" value={totalFixtures} />
            <Stat label="Parking" value={`${parkingPct}%`} />
            <Stat label="Officials" value={refWarnings === 0 ? "Ready" : refWarnings} />
            <Stat label="Capacity" value={carCap} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}
