import React from "react";
import { CheckCircle2, Route, Sparkles, TrendingDown } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

export default function DayOptimiserCard({ optimisation }) {
  const moves = optimisation?.moves || [];
  const metrics = optimisation?.metrics || {};

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
            <Sparkles size={15} strokeWidth={2.8} /> Day Optimiser
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {optimisation?.label || "Optimisation"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
            {optimisation?.summary || "Ground Control will surface the best validated matchday improvements here."}
          </p>
        </div>
        <StatusChip variant={optimisation?.status === "warning" ? "warning" : optimisation?.status === "danger" ? "danger" : "success"}>
          Score {optimisation?.score ?? 100}%
        </StatusChip>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <Metric label="Active fixtures" value={metrics.activeFixtures ?? 0} />
        <Metric label="Validated moves" value={metrics.validatedMoves ?? 0} />
        <Metric label="Car reduction" value={metrics.estimatedCarReduction ?? 0} />
        <Metric label="Peak reduction" value={`${metrics.peakReduction ?? 0}%`} />
      </div>

      <div className="mt-6 space-y-3">
        {moves.length ? (
          moves.map((move, index) => (
            <div key={`${move.fixtureIndex}-${move.id || index}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-amber-700">
                    <Route size={14} strokeWidth={2.8} /> Move {index + 1}
                  </div>
                  <div className="mt-1 text-base font-black text-slate-950">{move.fixtureTitle}</div>
                  <div className="mt-1 text-sm font-bold text-slate-600">{move.summary}</div>
                  {move.detail ? <p className="mt-2 text-sm font-semibold leading-6 text-amber-900">{move.detail}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                  <TrendingDown size={14} strokeWidth={2.8} />
                  {Math.round(Number(move.percentReduction || 0))}% peak improvement
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={22} strokeWidth={2.6} />
              <div>
                <div className="font-black">No optimisation needed</div>
                <p className="mt-1 text-sm font-bold leading-6 text-emerald-800">
                  The current schedule does not have a better validated parking or timing move available.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
