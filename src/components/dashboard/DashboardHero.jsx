import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CloudSun,
  MapPin,
  Rocket,
  TimerReset,
} from "lucide-react";

export default function DashboardHero({
  readiness,
  totalFixtures = 0,
  saturdayFixtures = 0,
  sundayFixtures = 0,
  peakCars = 0,
  carCap = 57,
  refWarnings = 0,
  weatherLocation,
  weatherStatus = "Ready",
  checklist = [],
  saveWeek,
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const pct = readiness?.pct ?? 0;
  const parkingPct = Math.round((peakCars / Math.max(carCap, 1)) * 100);
  const completeTasks = checklist.filter((item) => item.state === "done").length;
  const totalTasks = checklist.length || 1;
  const taskPct = Math.round((completeTasks / totalTasks) * 100);

  const readinessState = useMemo(() => {
    if (pct >= 95 && refWarnings === 0) {
      return {
        label: "Ready to publish",
        tone: "emerald",
        icon: CheckCircle2,
        message: "Weekend operations look controlled. Final checks are clear.",
      };
    }

    if (pct >= 75) {
      return {
        label: "Review required",
        tone: "amber",
        icon: AlertTriangle,
        message: "A few items still need attention before you publish fixtures.",
      };
    }

    return {
      label: "Action required",
      tone: "red",
      icon: AlertTriangle,
      message: "Complete the core matchday checks before publishing.",
    };
  }, [pct, refWarnings]);

  const StateIcon = readinessState.icon;
  const toneClasses = {
    emerald: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    amber: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
    red: "bg-red-400/10 text-red-200 ring-red-400/20",
  };

  return (
    <section className="overflow-hidden rounded-[32px] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-900 text-white shadow-xl">
      <div className="grid gap-8 p-8 lg:grid-cols-[1.35fr_430px] lg:p-10">
        <div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ring-1 ${
              toneClasses[readinessState.tone]
            }`}
          >
            <StateIcon size={15} />
            {readinessState.label}
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            Weekend Operations Centre
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            {readinessState.message} Ground Control is tracking fixtures,
            resources, weather, officials and communications from one place.
          </p>

          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            <HeroMetric
              icon={CalendarDays}
              label="Saturday"
              value={saturdayFixtures}
              suffix="fixtures"
            />
            <HeroMetric
              icon={CalendarDays}
              label="Sunday"
              value={sundayFixtures}
              suffix="fixtures"
            />
            <HeroMetric
              icon={CloudSun}
              label="Weather"
              value={weatherStatus}
              suffix={weatherLocation || "Location needed"}
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveWeek}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-7 py-4 text-base font-black text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 active:scale-[0.98]"
            >
              <Rocket size={20} strokeWidth={2.5} />
              Publish Weekend
            </button>

            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-5 py-4 text-sm font-black text-slate-200 ring-1 ring-white/10">
              <TimerReset size={18} />
              {totalFixtures} total fixtures
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white/10 p-6 backdrop-blur-md ring-1 ring-white/10 lg:p-8">
          <div className="flex items-start justify-between gap-4">
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

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">
              <CloudSun size={42} strokeWidth={1.8} />
            </div>
          </div>

          <div className="mt-8 rounded-3xl bg-white/10 p-5 ring-1 ring-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                  Today’s progress
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  {completeTasks}/{totalTasks} tasks complete
                </div>
              </div>

              <div className="text-right text-3xl font-black text-white">
                {taskPct}%
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${taskPct}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <StatusTile label="Readiness" value={`${pct}%`} />
            <StatusTile label="Parking" value={`${parkingPct}%`} />
            <StatusTile label="Officials" value={refWarnings === 0 ? "Clear" : refWarnings} />
            <StatusTile label="Weather" value={weatherStatus} />
          </div>

          {weatherLocation && (
            <div className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-300">
              <MapPin size={16} />
              Forecast location: {weatherLocation}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ icon: Icon, label, value, suffix }) {
  return (
    <div className="rounded-3xl bg-white/10 p-4 ring-1 ring-white/10">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
        {Icon && <Icon size={15} />}
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      <div className="mt-1 truncate text-xs font-bold text-slate-300">{suffix}</div>
    </div>
  );
}

function StatusTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
