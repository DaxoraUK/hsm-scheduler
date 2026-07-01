import React from "react";

export default function EmptyState({
  eyebrow = "Nothing here yet",
  title = "No data available",
  description = "Once information is available, it will appear here.",
  icon: Icon,
  action,
  className = "",
}) {
  return (
    <div className={`rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center ${className}`}>
      {Icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{eyebrow}</div>
      <div className="mt-2 text-lg font-black text-slate-950">{title}</div>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
