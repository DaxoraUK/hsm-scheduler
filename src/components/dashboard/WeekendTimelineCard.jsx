import React, { useState } from "react";
import MatchdayTimelineCard from "../Operations/shared/MatchdayTimelineCard.jsx";

export default function WeekendTimelineCard({
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satHasRun,
  sunHasRun,
  midweekHasRun,
  pitchCfg = [],
  club,
  onFixtureClick,
}) {
  const [activeDay, setActiveDay] = useState("saturday");

  const dayConfig = {
    saturday: {
      label: "Saturday",
      games: satHasRun ? satFinal : [],
      subtitle: "Pitch usage and kick-off flow for Saturday fixtures.",
    },
    sunday: {
      label: "Sunday",
      games: sunHasRun ? sunFinal : [],
      subtitle: "Pitch usage and kick-off flow for Sunday fixtures.",
    },
    midweek: {
      label: "Midweek",
      games: midweekHasRun ? midweekFinal : [],
      subtitle: "Pitch usage and kick-off flow for the selected weekday fixture date.",
    },
  };

  const selected = dayConfig[activeDay] || dayConfig.saturday;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {Object.entries(dayConfig).map(([key, option]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveDay(key)}
              className={`rounded-xl px-5 py-2 text-sm font-black transition ${
                activeDay === key
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <MatchdayTimelineCard
        variant="compact"
        title={`${selected.label} Timeline`}
        subtitle={selected.subtitle}
        games={selected.games}
        pitchCfg={pitchCfg}
        club={club}
        onFixtureClick={onFixtureClick}
      />
    </div>
  );
}
