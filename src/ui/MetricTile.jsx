import React from "react";

const TONE_STYLES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-800",
  slate: "border-slate-200 bg-slate-50 text-slate-800",
};

export default function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  tone = "slate",
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${TONE_STYLES[tone] || TONE_STYLES.slate} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
          {helper ? (
            <div className="mt-1 text-sm font-bold text-slate-600">{helper}</div>
          ) : null}
        </div>
        {Icon ? <Icon className="h-5 w-5 shrink-0" /> : null}
      </div>
    </div>
  );
}
