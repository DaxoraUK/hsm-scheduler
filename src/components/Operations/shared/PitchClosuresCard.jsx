import React from "react";
import Card from "../../ui/Card.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { sortPitches } from "../../../lib/pitches.js";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function PitchClosuresCard({
  pitchCfg = [],
  closedPitches = [],
  toggleClosed,
  closeAllPitches,
  reopenAllPitches,
}) {
  const sorted = sortPitches(pitchCfg);
  const closedCount = closedPitches.length;

  const availableCount = sorted.length - closedCount;

  const capacity =
    sorted.length > 0
      ? Math.round((availableCount / sorted.length) * 100)
      : 0;

  return (
    <Card
      eyebrow="Ground Status"
      title="Pitch Closures"
      subtitle="Temporarily close unavailable pitches before generating or adjusting the schedule."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip variant={closedCount ? "warning" : "success"}>
            {closedCount ? `${closedCount} closed` : "All open"}
          </StatusChip>

          <button
            type="button"
            onClick={() => closeAllPitches?.()}
            disabled={
              sorted.length === 0 || closedCount === sorted.length
            }
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Close All
          </button>

          <button
            type="button"
            onClick={() => reopenAllPitches?.()}
            disabled={closedCount === 0}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reopen All
          </button>
        </div>
      }
    >
      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Operational Capacity
            </div>

            <div className="mt-1 text-lg font-black text-slate-900">
              {availableCount} / {sorted.length} available
            </div>
          </div>

          <StatusChip
            variant={
              capacity <= 20
                ? "danger"
                : capacity <= 50
                ? "warning"
                : "success"
            }
          >
            {capacity}%
          </StatusChip>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              capacity <= 20
                ? "bg-red-500"
                : capacity <= 50
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{
              width: `${capacity}%`,
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((pitch) => {
          const closed = closedPitches.includes(pitch.id);

          return (
            <button
              key={pitch.id}
              type="button"
              onClick={() => toggleClosed(pitch.id)}
              className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                closed
                  ? "border-red-200 bg-red-50 hover:bg-red-100"
                  : "border-slate-200 bg-slate-50 hover:bg-white"
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-900">
                  {pitch.label}
                </div>

                <div className="mt-0.5 text-xs font-bold text-slate-500">
                  {pitch.format || "Any"} · {pitch.surface || "Grass"}
                </div>
              </div>

              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  closed
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {closed ? (
                  <AlertTriangle size={19} strokeWidth={2.5} />
                ) : (
                  <CheckCircle2 size={19} strokeWidth={2.5} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {closedCount > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {closedCount} pitch{closedCount === 1 ? " is" : "es are"} closed.
          Re-run or review the schedule after changing closures.
        </div>
      )}
    </Card>
  );
}