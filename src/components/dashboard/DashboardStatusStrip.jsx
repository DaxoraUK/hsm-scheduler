import React from "react";
import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";

const toneMap = {
  success: {
    icon: CheckCircle2,
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "text-emerald-600",
  },
  warning: {
    icon: AlertTriangle,
    wrap: "border-amber-200 bg-amber-50 text-amber-900",
    dot: "text-amber-600",
  },
  danger: {
    icon: XCircle,
    wrap: "border-red-200 bg-red-50 text-red-800",
    dot: "text-red-600",
  },
  muted: {
    icon: Circle,
    wrap: "border-slate-200 bg-white text-slate-600",
    dot: "text-slate-400",
  },
};

export default function DashboardStatusStrip({ items = [], actionsMenu = null }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
            Live Operations
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            Jump to the right area from one compact control strip.
          </div>
        </div>

        {actionsMenu ? <div className="shrink-0 self-start sm:self-auto">{actionsMenu}</div> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => {
          const tone = toneMap[item.status] || toneMap.muted;
          const Icon = tone.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone.wrap}`}
            >
              <Icon size={19} strokeWidth={2.5} className={tone.dot} />
              <div className="min-w-0">
                <div className="truncate text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                  {item.label}
                </div>
                <div className="mt-0.5 truncate text-sm font-black">
                  {item.detail}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
