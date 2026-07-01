import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudSun,
  Rocket,
} from "lucide-react";

export default function DashboardMissionHero({
  club,
  missionState,
  totalFixtures = 0,
  satCount = 0,
  sunCount = 0,
  completedSteps = 0,
  totalSteps = 6,
  nextAction,
  weatherLocation,
  onContinue,
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const progress = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const ready = missionState?.tone === "success";

  const displayDate = useMemo(
    () =>
      now.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [now]
  );

  return (
    <section className="overflow-hidden rounded-[34px] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white shadow-xl">
      <div className="grid gap-8 p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
        <div className="flex flex-col justify-between">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.2em] ring-1 ${
                ready
                  ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
                  : "bg-amber-400/10 text-amber-200 ring-amber-300/20"
              }`}
            >
              {ready ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              {missionState?.label || "Mission Control"}
            </div>

            <div className="mt-6 text-xs font-black uppercase tracking-[0.32em] text-emerald-300">
              Mission Control
            </div>

            <h1 className="mt-3 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight lg:text-6xl">
              Weekend Operations
            </h1>

            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-300">
              {missionState?.detail ||
                "Review your club's operational readiness and continue the next matchday task."}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onContinue}
                className={`inline-flex items-center justify-center gap-3 rounded-2xl px-7 py-4 text-base font-black shadow-lg transition active:scale-[0.98] ${
                  ready
                    ? "bg-emerald-500 text-white shadow-emerald-950/30 hover:bg-emerald-400"
                    : "bg-amber-400 text-slate-950 shadow-amber-950/20 hover:bg-amber-300"
                }`}
              >
                {ready ? <Rocket size={20} /> : <ArrowRight size={20} />}
                {nextAction?.title || "Continue Operations"}
              </button>

              <div className="text-sm font-bold text-slate-400">
                {completedSteps}/{totalSteps} workflow checks complete
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[30px] bg-white/10 p-6 backdrop-blur-md ring-1 ring-white/10">
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

              <div className="mt-1 text-sm font-semibold text-slate-300">
                {displayDate}
              </div>
            </div>

            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-300/20">
              <CloudSun size={38} strokeWidth={2.2} />
            </div>
          </div>

          <div className="mt-7 rounded-3xl bg-slate-950/35 p-5 ring-1 ring-white/10">
            <div className="flex items-end justify-between gap-5">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Weekend Progress
                </div>
                <div className="mt-2 text-4xl font-black text-white">
                  {progress}%
                </div>
              </div>

              <div className="text-right text-sm font-bold text-slate-300">
                {totalFixtures} fixture{totalFixtures === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full ${ready ? "bg-emerald-400" : "bg-amber-400"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat label="Saturday" value={satCount} />
            <MiniStat label="Sunday" value={sunCount} />
            <MiniStat label="Weather" value={weatherLocation ? "Ready" : "Set postcode"} />
            <MiniStat label="Club" value={club?.name || "Ground Control"} compact />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className={`mt-2 font-black text-white ${compact ? "truncate text-sm" : "text-2xl"}`}>
        {value}
      </div>
    </div>
  );
}
