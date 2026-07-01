import React from "react";
import MatchFixtureCard from "./shared/MatchFixtureCard.jsx";

export default function SundayScheduleCard({
  club,
  mode,
  sunDateLabel,
  sunHasRun,
  sunFinal = [],
  pitchCfg = [],
  closedPitches = [],
  refs = [],
  sunOv,
  onFixtureClick,
}) {
  if (!sunHasRun || sunFinal.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Matchday Plan
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Sunday Schedule
          </h2>

          <p className="mt-2 text-base font-medium text-slate-500">
            {mode === "test" ? "Test data" : sunDateLabel}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {sunFinal.map((fixture, index) => (
          <MatchFixtureCard
            key={index}
            fixture={fixture}
            index={index}
            club={club}
            refs={refs}
            pitchCfg={pitchCfg}
            closedPitches={closedPitches}
            onOverride={sunOv}
            showStatus
            onOpen={onFixtureClick}
          />
        ))}
      </div>
    </section>
  );
}