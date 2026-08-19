import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  XCircle,
} from "lucide-react";

const toneMap = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    detail: "text-emerald-800",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: "bg-amber-50 text-amber-700 ring-amber-200",
    detail: "text-amber-900",
  },
  danger: {
    icon: XCircle,
    iconWrap: "bg-rose-50 text-rose-700 ring-rose-200",
    detail: "text-rose-800",
  },
  muted: {
    icon: Circle,
    iconWrap: "bg-slate-100 text-slate-500 ring-slate-200",
    detail: "text-slate-700",
  },
};

const scopeOptions = [
  { key: "matchweek", label: "Matchweek", midweekOnly: true },
  { key: "weekend", label: "Weekend" },
  { key: "midweek", label: "Midweek", midweekOnly: true },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export default function DashboardStatusStrip({
  items = [],
  actionsMenu = null,
  primaryAction = null,
  scope = "weekend",
  onScopeChange,
  midweekEnabled = true,
}) {
  const visibleScopes = scopeOptions.filter(
    (option) => !option.midweekOnly || midweekEnabled,
  );

  return (
    <section className="relative z-20 overflow-visible rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">
            Matchweek overview
          </div>
          <div className="mt-1 text-sm font-black text-slate-950">
            Current operating position
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          {onScopeChange ? (
            <div
              className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200"
              aria-label="Mission Control scope"
            >
              {visibleScopes.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onScopeChange(option.key)}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition sm:px-3.5 ${
                    scope === option.key
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-500 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex shrink-0 items-center gap-2">
            {primaryAction?.onClick ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {primaryAction.label || "Open Operations"}
              </button>
            ) : null}
            {actionsMenu}
          </div>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-b-[26px] divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map((item) => {
          const tone = toneMap[item.status] || toneMap.muted;
          const Icon = tone.icon;

          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex min-w-0 items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.iconWrap}`}
              >
                <Icon size={17} strokeWidth={2.5} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </span>
                <span className={`mt-0.5 block truncate text-sm font-black ${tone.detail}`}>
                  {item.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
