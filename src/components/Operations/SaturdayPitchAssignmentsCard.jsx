import React, { useMemo } from "react";
import { cleanName } from "../../lib/scheduler.js";
import { createPitchRegistry } from "../../lib/registry/pitchRegistry.js";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

const ARTIFICIAL_SURFACES = new Set(["astro", "3g", "4g", "artificial"]);

function normaliseClosedIds(closedPitches = []) {
  if (Array.isArray(closedPitches)) {
    return closedPitches.map((value) => String(value || "")).filter(Boolean);
  }

  return Object.entries(closedPitches || {})
    .filter(([, value]) => Boolean(value))
    .map(([pitchId]) => String(pitchId));
}

export default function SaturdayPitchAssignmentsCard({
  club,
  satHasRun,
  satActive = [],
  satFinal = [],
  satOverrides = {},
  pitchCfg = [],
  closedPitches = [],
  useAstro = false,
  day = "Saturday",
}) {
  const registry = useMemo(() => createPitchRegistry(pitchCfg), [pitchCfg]);
  const explicitClosed = useMemo(
    () => new Set(normaliseClosedIds(closedPitches)),
    [closedPitches]
  );

  const gamesByPitch = useMemo(() => {
    const map = new Map();
    pitchCfg.forEach((pitch) => map.set(pitch.id, []));
    satActive.forEach((game) => {
      const fixtureIndex = satFinal.indexOf(game);
      const pitchId = satOverrides[fixtureIndex]?.pitchId || game.pitchId;
      if (!pitchId) return;
      const current = map.get(pitchId) || [];
      current.push(game);
      map.set(pitchId, current);
    });
    return map;
  }, [pitchCfg, satActive, satFinal, satOverrides]);

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
      subtitle="Live view of pitch allocations and operational availability."
      action={<StatusChip variant="neutral">{usedPitches.length} in use</StatusChip>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pitchCfg.map((pitch) => {
          const games = gamesByPitch.get(pitch.id) || [];
          const linkedUsage = registry
            .getLinkedPitchIds(pitch.id)
            .filter((pitchId) => pitchId !== pitch.id)
            .flatMap((pitchId) =>
              (gamesByPitch.get(pitchId) || []).map((game) => ({ pitchId, game }))
            );
          const linkedUsageLabel = [...new Set(linkedUsage.map(({ pitchId, game }) => `${pitchId} at ${game.koTime || game.ko || "scheduled time"}`))].join(", ");

          const linkedClosureSources = registry
            .getLinkedPitchIds(pitch.id)
            .filter((pitchId) => explicitClosed.has(pitchId));
          const explicitlyClosed = explicitClosed.has(pitch.id);
          const linkedClosed = !explicitlyClosed && linkedClosureSources.length > 0;
          const artificialDisabled =
            !useAstro &&
            ARTIFICIAL_SURFACES.has(String(pitch.surface || "").toLowerCase());
          const unavailable = explicitlyClosed || linkedClosed || artificialDisabled;

          return (
            <div
              key={pitch.id}
              className={`rounded-3xl border p-4 transition ${
                explicitlyClosed
                  ? "border-red-200 bg-red-50"
                  : linkedClosed
                    ? "border-amber-200 bg-amber-50"
                    : artificialDisabled
                      ? "border-slate-300 bg-slate-100"
                      : games.length
                        ? "border-emerald-200 bg-emerald-50"
                        : linkedUsage.length
                          ? "border-blue-200 bg-blue-50"
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

                {explicitlyClosed ? (
                  <StatusChip variant="danger">Closed</StatusChip>
                ) : linkedClosed ? (
                  <StatusChip variant="warning">Linked closure</StatusChip>
                ) : artificialDisabled ? (
                  <StatusChip variant="neutral">Surface disabled</StatusChip>
                ) : games.length ? (
                  <StatusChip variant="success">{games.length} game{games.length > 1 ? "s" : ""}</StatusChip>
                ) : linkedUsage.length ? (
                  <StatusChip variant="info">Shared layout in use</StatusChip>
                ) : (
                  <StatusChip variant="neutral">Open fallback</StatusChip>
                )}
              </div>

              {linkedClosed ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-white/70 px-3 py-2 text-xs font-bold text-amber-800">
                  Blocked by {linkedClosureSources.join(", ")} because the layouts share one physical footprint.
                </div>
              ) : null}

              {artificialDisabled ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-bold text-slate-600">
                  Enable artificial surfaces in the matchday controls to use this pitch.
                </div>
              ) : null}

              {!unavailable && !games.length && linkedUsage.length ? (
                <div className="mt-3 rounded-2xl border border-blue-200 bg-white/70 px-3 py-2 text-xs font-bold leading-5 text-blue-900">
                  This pitch is open, but its shared footprint is occupied by {linkedUsageLabel}. It remains available outside those bookings.
                </div>
              ) : null}

              {!unavailable && !games.length && !linkedUsage.length ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
                  Open and available as a fallback. No fixture was allocated because the scheduler selected higher-priority compatible pitches, team defaults or the best overall flow.
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {games.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-sm font-bold text-slate-400">
                    {unavailable ? "Unavailable to scheduler" : linkedUsage.length ? "No game allocated on this layout" : "Available if the schedule changes"}
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
