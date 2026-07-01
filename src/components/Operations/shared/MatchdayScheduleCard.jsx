import React from "react";
import { cleanName } from "../../../lib/scheduler.js";
import MatchFixtureCard from "./MatchFixtureCard.jsx";

export default function MatchdayScheduleCard({
  day = "Matchday",
  club,
  mode,
  dateLabel,
  hasRun,
  games = [],
  conflicts = [],
  officialConflicts = [],
  refWarnings = 0,
  onFixtureClick,
}) {
  if (!hasRun || games.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Matchday Plan
          </div>

          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {day} Schedule
          </h2>

          <p className="mt-2 text-base font-medium text-slate-500">
            {mode === "test" ? "Test data" : dateLabel}
          </p>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {conflicts.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-900">
              Pitch Conflict{conflicts.length > 1 ? "s" : ""} Detected (
              {conflicts.length})
            </div>

            <div className="mt-2 space-y-1">
              {conflicts.map((conflict, index) => (
                <div key={index} className="text-sm font-medium text-red-800">
                  {cleanName(conflict.a.homeTeam, club?.name)} (
                  {conflict.a.koTime}) and{" "}
                  {cleanName(conflict.b.homeTeam, club?.name)} (
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

        {officialConflicts.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="text-sm font-black text-red-900">
              Official Clash{officialConflicts.length > 1 ? "es" : ""} Detected (
              {officialConflicts.length})
            </div>

            <div className="mt-2 space-y-1">
              {officialConflicts.map((conflict, index) => (
                <div key={index} className="text-sm font-medium text-red-800">
                  {conflict.referee || "This official"} is assigned to {" "}
                  {cleanName(conflict.a.homeTeam, club?.name)} (
                  {conflict.a.koTime}) and {" "}
                  {cleanName(conflict.b.homeTeam, club?.name)} (
                  {conflict.b.koTime}) at overlapping times.
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs font-bold text-red-700">
              Assign a different official or change one kick-off time to resolve.
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
          {games.map((fixture, index) => {
            const officialConflict = officialConflicts.some(
              (conflict) => conflict.a === fixture || conflict.b === fixture
            );

            return (
              <MatchFixtureCard
                key={fixture.id || fixture.fixtureId || `${fixture.homeTeam}-${index}`}
                fixture={fixture}
                index={index}
                club={club}
                officialConflict={officialConflict}
                onFixtureClick={onFixtureClick}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
