import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

const severityStyles = {
  critical: {
    Icon: AlertTriangle,
    chip: "danger",
    row: "border-red-200 bg-red-50/70",
    icon: "bg-white text-red-700 ring-red-200",
  },
  attention: {
    Icon: AlertTriangle,
    chip: "warning",
    row: "border-amber-200 bg-amber-50/70",
    icon: "bg-white text-amber-700 ring-amber-200",
  },
  watch: {
    Icon: Sparkles,
    chip: "warning",
    row: "border-slate-200 bg-white",
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  healthy: {
    Icon: CheckCircle2,
    chip: "success",
    row: "border-emerald-100 bg-white",
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
};

const actionLabels = {
  fixtures: "Open fixtures",
  flow: "Review schedule",
  parking: "Review parking",
  officials: "Review officials",
  pitches: "Review pitches",
  rules: "Review rules",
  weather: "Review weather",
  optimiser: "Open optimiser",
  communications: "Open messages",
  operations: "Review operations",
};

function getActionLabel(insight = {}) {
  return actionLabels[insight.domain] || "Review area";
}

function InsightRow({ insight, onNavigate }) {
  const style = severityStyles[insight.severity] || severityStyles.watch;
  const Icon = style.Icon;
  const canNavigate = Boolean(insight.target && typeof onNavigate === "function");

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${style.row}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${style.icon}`}>
          <Icon size={20} strokeWidth={2.6} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-base font-black tracking-tight text-slate-950">{insight.title}</h4>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{insight.detail}</p>
            </div>
            <StatusChip variant={style.chip}>{insight.metric || insight.severity}</StatusChip>
          </div>

          {insight.guidance ? (
            <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white">
              {insight.guidance}
            </div>
          ) : null}

          {canNavigate ? (
            <button
              type="button"
              onClick={() => onNavigate(insight.target)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {getActionLabel(insight)}
              <ArrowRight size={14} strokeWidth={2.8} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OperationsIntelligenceCard({ intelligence = {}, onNavigate }) {
  const insights = intelligence.insights || intelligence.items || [];
  const next = intelligence.nextAction || insights[0] || null;
  const metrics = intelligence.metrics || {};
  const canNavigateToNext = Boolean(next?.target && typeof onNavigate === "function");

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-100">
              <Sparkles size={15} strokeWidth={2.8} />
              Operations Intelligence v2
            </div>

            <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
              {next ? next.title : "No major operational risks"}
            </h3>

            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              {intelligence.summary ||
                "Ground Control is reading fixtures, parking, officials, rules and weather as one operational picture."}
            </p>

            {next ? (
              <div className="mt-5 rounded-3xl border border-slate-900 bg-slate-950 p-5 text-white">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">
                      Next best move
                    </div>
                    <div className="mt-2 text-lg font-black">{next.guidance || next.detail}</div>
                  </div>

                  {canNavigateToNext ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(next.target)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-emerald-50"
                    >
                      {getActionLabel(next)}
                      <ArrowRight size={15} strokeWidth={2.8} />
                    </button>
                  ) : (
                    <div className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                      Review {next.domain || "operations"}
                      <ArrowRight size={15} strokeWidth={2.8} />
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-6 xl:border-l xl:border-t-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Clock size={14} strokeWidth={2.5} /> Busiest KO
                </div>
                <div className="mt-2 text-2xl font-black text-slate-950">{metrics.busiestKickoff || "—"}</div>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Car size={14} strokeWidth={2.5} /> Parking peak
                </div>
                <div className="mt-2 text-2xl font-black text-slate-950">{metrics.parkingPeak || 0}%</div>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <ShieldAlert size={14} strokeWidth={2.5} /> Officials
                </div>
                <div className="mt-2 text-2xl font-black text-slate-950">{metrics.missingOfficials || 0} TBC</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {insights.slice(0, 8).map((insight) => (
          <InsightRow key={insight.id} insight={insight} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}
