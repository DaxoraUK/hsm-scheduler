import React from "react";
import { cleanName } from "../../lib/scheduler.js";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

export default function SaturdayPitchAssignmentsCard({
  club,
  satHasRun,
  satActive = [],
  satFinal = [],
  satOverrides = {},
  pitchCfg = [],
  closedPitches = [],
  day = "Saturday",
}) {
  if (!satHasRun) return null;

  const usedPitches = pitchCfg.filter((pitch) =>
    satActive.some(
      (game) =>
        (satOverrides[satFinal.indexOf(game)]?.pitchId || game.pitchId) ===
        pitch.id
    )
  );

  return (
    <Card
      eyebrow="Facilities"
      title={`${day} Pitch Assignments`}
      subtitle="Live view of which teams are allocated to each pitch."
      action={<StatusChip variant="neutral">{usedPitches.length} in use</StatusChip>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pitchCfg.map((pitch) => {
          const games = satActive.filter(
            (game) =>
              (satOverrides[satFinal.indexOf(game)]?.pitchId || game.pitchId) ===
              pitch.id
          );

          const closed = closedPitches.includes(pitch.id);

          return (
            <div
              key={pitch.id}
              className={`rounded-3xl border p-4 transition ${
                closed
                  ? "border-red-200 bg-red-50 opacity-70"
                  : games.length
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-950">
                    {pitch.label}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">
                    {pitch.desc || pitch.format || "Pitch"}
                  </div>
                </div>

                {closed ? (
                  <StatusChip variant="danger">Closed</StatusChip>
                ) : games.length ? (
                  <StatusChip variant="success">{games.length} game{games.length > 1 ? "s" : ""}</StatusChip>
                ) : (
                  <StatusChip variant="neutral">Free</StatusChip>
                )}
              </div>

              <div className="mt-4 space-y-2">
                {games.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-sm font-bold text-slate-400">
                    No games allocated
                  </div>
                ) : (
                  games.map((game, index) => (
                    <div
                      key={`${game.homeTeam}-${index}`}
                      className="rounded-2xl border border-white/70 bg-white px-4 py-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-900">
                            {cleanName(game.homeTeam, club?.name)}
                          </div>
                          <div className="mt-0.5 truncate text-xs font-bold text-slate-500">
                            vs {game.awayTeam || "TBC"}
                          </div>
                        </div>

                        <div className="shrink-0 rounded-full bg-slate-950 px-3 py-1 text-xs font-black text-white">
                          {game.koTime}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}