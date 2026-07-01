import React from "react";
import { cleanName } from "../../lib/scheduler.js";
import MatchFixtureCard from "./shared/MatchFixtureCard.jsx";

export default function SaturdayScheduleCard({
  club,
  mode,
  satDateLabel,
  satHasRun,
  satFinal = [],
  satConflicts = [],
  refWarnings = 0,
  refs = [],
  pitchCfg = [],
  closedPitches = [],
  satOv,
  onFixtureClick,
}) {
  if (!satHasRun || satFinal.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Matchday Plan
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Saturday Schedule
          </h2>

          <p className="mt-2 text-base font-medium text-slate-500">
            {mode === "test" ? "Test data" : satDateLabel}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {satConflicts.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-900">
              Pitch Conflict{satConflicts.length > 1 ? "s" : ""} Detected (
              {satConflicts.length})
            </div>

            <div className="mt-2 space-y-1">
              {satConflicts.map((conflict, index) => (
                <div key={index} className="text-sm font-medium text-red-800">
                  {cleanName(conflict.a.homeTeam, club.name)} (
                  {conflict.a.koTime}) and{" "}
                  {cleanName(conflict.b.homeTeam, club.name)} (
                  {conflict.b.koTime}) cannot both use{" "}
                  {conflict.a.pitchId === conflict.b.pitchId
                    ? "the same pitch"
                    : "linked pitches"}{" "}
                  at the same time.
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs font-bold text-red-700">
              Change a pitch or kick-off time to resolve.
            </div>
          </div>
        )}

        {mode === "test" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Test data only — switch to Live for real fixtures.
          </div>
        )}

        {refWarnings > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
            {refWarnings} fixture{refWarnings > 1 ? "s" : ""} without confirmed
            referee — chase before Friday.
          </div>
        )}

        <div className="space-y-4">
          {satFinal.map((fixture, index) => (
            <MatchFixtureCard
              key={index}
              fixture={fixture}
              index={index}
              club={club}
              refs={refs}
              pitchCfg={pitchCfg}
              closedPitches={closedPitches}
              onOverride={satOv}
              showStatus
              onOpen={onFixtureClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}