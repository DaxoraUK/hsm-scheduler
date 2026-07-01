import React from "react";
import Card from "../../ui/Card.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { cleanName } from "../../../lib/scheduler.js";
import { sortPitches } from "../../../lib/pitches.js";
import { getPitchDisplayFormat } from "../../../lib/intelligence/pitch/pitchService.js";

export default function MatchdayTimelineCard({
  title = "Operations Timeline",
  subtitle = "Pitch usage across the day.",
  games = [],
  pitchCfg = [],
  club,
  variant = "full",
  onFixtureClick = () => {}
}) {
  const isCompact = variant === "compact";

  const activeGames = games.filter(
    (game) =>
      game.status !== "postponed" &&
      game.koMins != null &&
      game.endMins != null
  );

  const pitches = sortPitches(pitchCfg).filter((pitch) =>
    activeGames.some((game) => game.pitchId === pitch.id)
  );

  const start = activeGames.length
    ? Math.min(...activeGames.map((game) => game.koMins))
    : 8 * 60;

  const end = activeGames.length
    ? Math.max(...activeGames.map((game) => game.endMins))
    : 13 * 60;

  const range = Math.max(end - start, 60);
  const ticks = buildTicks(start, end);

  return (
    <Card
      eyebrow="Timeline"
      title={title}
      subtitle={subtitle}
      action={
        <StatusChip variant="neutral">
          {activeGames.length} fixtures
        </StatusChip>
      }
    >
      {activeGames.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
          No scheduled fixtures yet. Run the scheduler to populate the timeline.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              <div
                className={`grid border-b border-slate-100 ${
                  isCompact
                    ? "grid-cols-[130px_1fr] gap-3 pb-2"
                    : "grid-cols-[150px_1fr] gap-4 pb-3"
                }`}
              >
                <div />

                <div className="relative h-8">
                  {ticks.map((tick) => (
                    <div
                      key={tick.value}
                      className="absolute top-0 -translate-x-1/2 text-xs font-black text-slate-400"
                      style={{
                        left: `${((tick.value - start) / range) * 100}%`,
                      }}
                    >
                      {tick.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`mt-3 ${isCompact ? "space-y-2" : "space-y-4"}`}>
                {pitches.map((pitch) => {
                  const pitchGames = activeGames.filter(
                    (game) => game.pitchId === pitch.id
                  );

                  return (
                    <div
                      key={pitch.id}
                      className={`grid items-center ${
                        isCompact
                          ? "grid-cols-[130px_1fr] gap-3"
                          : "grid-cols-[150px_1fr] gap-4"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black text-slate-800">
                          {pitch.label}
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          {getPitchDisplayFormat(pitch)}
                        </div>
                      </div>

                      <div
                        className={`relative rounded-2xl bg-slate-100 ${
                          isCompact ? "h-11" : "h-16"
                        }`}
                      >
                        {ticks.map((tick) => (
                          <div
                            key={tick.value}
                            className="absolute top-0 h-full w-px bg-white/80"
                            style={{
                              left: `${((tick.value - start) / range) * 100}%`,
                            }}
                          />
                        ))}

                        {pitchGames.map((game, index) => {
                          const left = ((game.koMins - start) / range) * 100;
                          const width =
                            ((game.endMins - game.koMins) / range) * 100;

                          const label = cleanName(game.homeTeam, club?.name);
                          const opposition = game.awayTeam || "TBC";
                          const colour = getGameColour(game);

                          return (
                            <button
                              key={`${game.homeTeam}-${index}`}
                              type="button"
                              onClick={() => onFixtureClick?.(game)}
                              className={`absolute flex items-center overflow-hidden rounded-2xl border px-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colour} ${
                                isCompact
                                  ? "top-1.5 h-8 min-w-[110px]"
                                  : "top-2 h-12 min-w-[120px]"
                              }`}
                              style={{
                                left: `${left}%`,
                                width: `${Math.max(width, 10)}%`,
                              }}
                              title={`${label} vs ${opposition} • ${game.koTime}`}
                            >
                              <div className="min-w-0">
                                <div
                                  className={`truncate font-black ${
                                    isCompact ? "text-[10px]" : "text-xs"
                                  }`}
                                >
                                  {label}
                                </div>
                                <div
                                  className={`truncate font-bold text-white/80 ${
                                    isCompact ? "text-[9px]" : "text-[10px]"
                                  }`}
                                >
                                  {game.koTime} · {opposition}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
            <LegendItem colour="bg-emerald-600" label="Preferred" />
            <LegendItem colour="bg-amber-500" label="Alternative" />
            <LegendItem colour="bg-blue-600" label="Astro" />
            <LegendItem colour="bg-red-600" label="Emergency" />
          </div>
        </>
      )}
    </Card>
  );
}

function getGameColour(game) {
  if (game.usingFallback) {
    return "border-red-700 bg-red-600";
  }

  if (game.usingAstro) {
    return "border-blue-700 bg-blue-600";
  }

  if (game.usingAlt) {
    return "border-amber-600 bg-amber-500";
  }

  return "border-emerald-700 bg-emerald-600";
}

function LegendItem({ colour, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${colour}`} />
      <span>{label}</span>
    </div>
  );
}

function buildTicks(start, end) {
  const ticks = [];
  const firstHour = Math.floor(start / 60) * 60;
  const lastHour = Math.ceil(end / 60) * 60;

  for (let mins = firstHour; mins <= lastHour; mins += 60) {
    ticks.push({
      value: mins,
      label: formatTime(mins),
    });
  }

  return ticks;
}

function formatTime(totalMins) {
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}