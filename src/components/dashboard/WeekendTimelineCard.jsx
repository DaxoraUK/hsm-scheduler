import React, { useState } from "react";
import MatchdayTimelineCard from "../Operations/shared/MatchdayTimelineCard.jsx";

export default function WeekendTimelineCard({
  satFinal = [],
  sunFinal = [],
  satHasRun,
  sunHasRun,
  pitchCfg = [],
  club,
  onFixtureClick,
}) {
  const [activeDay, setActiveDay] = useState("saturday");

  const isSaturday = activeDay === "saturday";
  const games = isSaturday
    ? satHasRun
      ? satFinal
      : []
    : sunHasRun
    ? sunFinal
    : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveDay("saturday")}
            className={`rounded-xl px-5 py-2 text-sm font-black transition ${
              activeDay === "saturday"
                ? "bg-slate-950 text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Saturday
          </button>

          <button
            type="button"
            onClick={() => setActiveDay("sunday")}
            className={`rounded-xl px-5 py-2 text-sm font-black transition ${
              activeDay === "sunday"
                ? "bg-slate-950 text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Sunday
          </button>
        </div>
      </div>

      <MatchdayTimelineCard
        variant="compact"
        title={isSaturday ? "Saturday Timeline" : "Sunday Timeline"}
        subtitle={
          isSaturday
            ? "Pitch usage and kick-off flow for Saturday fixtures."
            : "Pitch usage and kick-off flow for Sunday fixtures."
        }
        games={games}
        pitchCfg={pitchCfg}
        club={club}
        onFixtureClick={onFixtureClick}
      />
    </div>
  );
}