import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function GroundStatusCard({
  pitchCfg = [],
  closedPitches = [],
  setMainPage,
  setDayTab,
}) {
  const total = pitchCfg.length;
  const closed = closedPitches.length;
  const open = Math.max(total - closed, 0);

  return (
    <button
      type="button"
      onClick={() => {
        setMainPage("operations");
        setDayTab("saturday");
      }}
      className={`flex w-full items-center justify-between rounded-3xl border px-6 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        closed
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
            closed
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {closed ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
            Ground Status
          </div>

          <div className="mt-1 text-lg font-black text-slate-950">
            {closed
              ? `${closed} pitch${closed > 1 ? "es" : ""} closed`
              : "All pitches open"}
          </div>
        </div>
      </div>

      <div className="text-right">
        <div className="text-2xl font-black text-slate-950">
          {open}/{total}
        </div>
        <div className="text-xs font-bold text-slate-500">
          pitches open
        </div>
      </div>
    </button>
  );
}