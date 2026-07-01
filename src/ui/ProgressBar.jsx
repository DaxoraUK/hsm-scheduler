import React from "react";

const TONE = {
  success: "bg-emerald-500",
  ready: "bg-emerald-500",
  warning: "bg-amber-500",
  review: "bg-orange-500",
  danger: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
};

export default function ProgressBar({ value = 0, max = 100, tone = "success", label, className = "" }) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100)) : 0;
  return (
    <div className={className}>
      {label ? <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</div> : null}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${TONE[tone] || TONE.neutral}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
