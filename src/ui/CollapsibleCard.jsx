import React from "react";
import { ChevronDown } from "lucide-react";
import StatusChip from "./StatusChip.jsx";

const DOT_STYLES = {
  ready: "bg-emerald-500",
  success: "bg-emerald-500",
  watch: "bg-amber-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  error: "bg-rose-500",
  info: "bg-sky-500",
  neutral: "bg-slate-400",
};

export default function CollapsibleCard({
  id,
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  badge,
  status = "neutral",
  statusLabel,
  open,
  onToggle,
  highlighted = false,
  children,
  className = "",
}) {
  const safeId = id || String(title || "section").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const panelId = `${safeId}-panel`;

  return (
    <section
      id={`matchday-section-${safeId}`}
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition duration-300 ${
        highlighted ? "border-emerald-300 ring-4 ring-emerald-100 shadow-lg" : "border-slate-200"
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={Boolean(open)}
        aria-controls={panelId}
        className="group flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-slate-50 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            {Icon ? <Icon size={21} strokeWidth={2.5} /> : <span className={`h-3 w-3 rounded-full ${DOT_STYLES[status] || DOT_STYLES.neutral}`} />}
          </div>

          <div className="min-w-0">
            {eyebrow ? <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{eyebrow}</div> : null}
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
              {badge ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{badge}</span> : null}
            </div>
            {subtitle ? <p className="mt-1 truncate text-sm font-bold text-slate-500">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {statusLabel ? <StatusChip status={status} size="sm" className="hidden sm:inline-flex">{statusLabel}</StatusChip> : null}
          <ChevronDown
            size={22}
            strokeWidth={2.5}
            className={`text-slate-400 transition duration-200 group-hover:text-slate-700 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open ? <div id={panelId} className="border-t border-slate-200 p-4 sm:p-6">{children}</div> : null}
    </section>
  );
}
