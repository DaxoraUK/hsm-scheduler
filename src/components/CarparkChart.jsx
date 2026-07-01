import React, { useMemo } from "react";
import { AlertTriangle, Car, CheckCircle2 } from "lucide-react";
import { AM, AVG_CARS, G, RE } from "../lib/constants.js";
import { t2s } from "../lib/scheduler.js";
import {
  fixtureAffectsParking,
  getEstimatedCarsForFixture,
} from "../lib/intelligence/parking/parkingService.js";
import { getValidatedFixRecommendations } from "../lib/engines/recommendationEngine.js";

function getActiveParkingFixtures(games = [], t, pitchCfg = []) {
  return games
    .map((game, index) => ({ ...game, __index: index }))
    .filter(
      (game) =>
        fixtureAffectsParking(game, pitchCfg) &&
        game.koMins <= t &&
        game.endMins > t
    );
}

function CarparkChart({
  games = [],
  startMins,
  capacity = 57,
  primary = G,
  avgCars = AVG_CARS,
  club = {},
  pitchCfg = [],
  closedPitches = [],
  onApplyRecommendation,
}) {
  const CP_OK = primary;
  const CP_WARN = "#E67E22";
  const CP_OVER = "#922B21";
  const CP_OVER_TEXT = "#FDECEA";

  const slots = useMemo(() => {
    if (!games.length) return [];

    const rows = [];
    for (let t = startMins; t <= 15 * 60; t += 30) {
      const active = getActiveParkingFixtures(games, t, pitchCfg);
      const cars = active.reduce(
        (sum, game) =>
          sum +
          (getEstimatedCarsForFixture(game, { ...club, avgCars }) || 8),
        0
      );

      rows.push({ label: t2s(t), cars, count: active.length, active });
    }

    return rows;
  }, [avgCars, club, games, pitchCfg, startMins]);

  const peakSlot = slots.reduce(
    (best, slot) => (!best || slot.cars > best.cars ? slot : best),
    null
  );

  const recommendations = useMemo(() => {
    if (!peakSlot || peakSlot.cars <= capacity || !onApplyRecommendation) {
      return [];
    }

    const candidates = [];
    const seen = new Set();

    for (const fixture of peakSlot.active) {
      const fixes = getValidatedFixRecommendations({
        fixtures: games,
        fixtureIndex: fixture.__index,
        pitchCfg,
        closedPitches,
        club,
        start: club.startTime,
        end: club.endTime,
        limit: 2,
      });

      for (const fix of fixes) {
        const key = `${fixture.__index}|${fix.id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        candidates.push({
          ...fix,
          fixtureIndex: fixture.__index,
          fixtureName: fixture.homeTeam || "Fixture",
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [capacity, closedPitches, club, games, onApplyRecommendation, peakSlot, pitchCfg]);

  if (!games.length || !slots.length) return null;

  const peak = Math.max(...slots.map((slot) => slot.cars), 1);
  const maxY = Math.max(peak, capacity) * 1.15;
  const height = 140;
  const capY = Math.round((1 - capacity / maxY) * height);
  const over = slots.filter((slot) => slot.cars > capacity);
  const peakPercent = capacity ? Math.round((peak / capacity) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              peak > capacity
                ? "border border-red-200 bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            <Car size={24} strokeWidth={2.7} />
          </div>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
              Parking Peak
            </div>
            <div className="mt-2 text-4xl font-black text-slate-950">
              {peakPercent}%
            </div>
            <div className="mt-1 text-sm font-bold text-slate-500">
              {peak}/{capacity} spaces at {peakSlot?.label || "TBC"}
            </div>
          </div>
        </div>
      </div>

      {over.length > 0 && (
        <div
          style={{
            background: CP_OVER_TEXT,
            border: `1px solid ${CP_OVER}`,
            borderRadius: 18,
            padding: "14px 16px",
            color: CP_OVER,
          }}
          className="flex items-start gap-3 text-sm font-bold"
        >
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            Parking is projected to exceed capacity at: {over
              .map((slot) => `${slot.label} (~${slot.cars} cars)`)
              .join(", ")}
            . Spread kick-offs, reduce concurrent parking-impact fixtures, or open
            overflow parking.
          </div>
        </div>
      )}

      <div style={{ position: "relative", height: height + 20, marginBottom: 4 }}>
        <div
          style={{
            position: "absolute",
            top: capY,
            left: 0,
            right: 0,
            borderTop: "2px dashed #922B21",
            zIndex: 2,
          }}
        >
          <span
            style={{
              position: "absolute",
              right: 0,
              top: -16,
              fontSize: 9,
              color: "#922B21",
              fontWeight: 700,
              background: "#fff",
              padding: "0 3px",
            }}
          >
            {capacity} spaces
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 4,
            height,
            position: "relative",
            zIndex: 1,
          }}
        >
          {slots.map((slot, index) => {
            const barHeight = Math.round((slot.cars / maxY) * height);
            const colour =
              slot.cars > capacity ? RE : slot.cars > capacity * 0.85 ? AM : G;

            return (
              <div
                key={index}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  height: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: slot.cars > capacity ? CP_OVER : "#888",
                    fontWeight: slot.cars > capacity ? 700 : 400,
                  }}
                >
                  {slot.cars}
                </div>
                <div
                  style={{
                    width: "100%",
                    height: barHeight,
                    background: colour,
                    borderRadius: "3px 3px 0 0",
                    minHeight: 2,
                  }}
                  title={`${slot.label}: ~${slot.cars} cars, ${slot.count} parking-impact games`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {slots.map((slot, index) => (
          <div key={index} style={{ flex: 1, fontSize: 8, color: "#aaa", textAlign: "center" }}>
            {slot.label}
          </div>
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
            <CheckCircle2 size={16} />
            Validated Parking Fixes
          </div>

          <div className="grid gap-2">
            {recommendations.map((recommendation) => (
              <button
                type="button"
                key={`${recommendation.fixtureIndex}-${recommendation.id}`}
                onClick={() =>
                  onApplyRecommendation?.(
                    recommendation.fixtureIndex,
                    recommendation.patch
                  )
                }
                className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left shadow-sm transition hover:bg-emerald-100"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-slate-950">
                      {recommendation.fixtureName}
                    </div>
                    <div className="mt-1 text-sm font-bold text-emerald-800">
                      {recommendation.title}
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {recommendation.detail}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm">
                    Fix now
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#666", flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: CP_OK, borderRadius: 2, marginRight: 4 }} />Under 85%</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: CP_WARN, borderRadius: 2, marginRight: 4 }} />85-100%</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: RE, borderRadius: 2, marginRight: 4 }} />Over capacity</span>
        <span style={{ color: "#aaa" }}>Off-site/non-parking-impact pitches are excluded from these estimates.</span>
      </div>
    </div>
  );
}

export default CarparkChart;
