import React from "react";

export default function StatRow({ label, value, detail, icon: Icon, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 ${className}`}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-800">{label}</div>
          {detail ? <div className="truncate text-xs font-semibold text-slate-500">{detail}</div> : null}
        </div>
      </div>
      <div className="shrink-0 text-right text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}
