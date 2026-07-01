import React from "react";
import { ChevronRight } from "lucide-react";

export default function QuickActionCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md"
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon size={22} strokeWidth={2.5} />
        </div>

        <div className="min-w-0">
          <div className="truncate font-black text-slate-900">{title}</div>
          <div className="truncate text-sm font-medium text-slate-500">
            {subtitle}
          </div>
        </div>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700"
      />
    </button>
  );
}