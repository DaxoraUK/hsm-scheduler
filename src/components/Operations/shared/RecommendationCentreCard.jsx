import React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, Sparkles } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

const severityStyles = {
  critical: {
    icon: AlertTriangle,
    chip: "danger",
    card: "border-red-200 bg-red-50/70 text-red-950",
    iconBox: "bg-white text-red-700 ring-red-200",
  },
  attention: {
    icon: AlertTriangle,
    chip: "warning",
    card: "border-amber-200 bg-amber-50/70 text-amber-950",
    iconBox: "bg-white text-amber-700 ring-amber-200",
  },
  watch: {
    icon: Sparkles,
    chip: "warning",
    card: "border-amber-100 bg-white text-slate-950",
    iconBox: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  healthy: {
    icon: CheckCircle2,
    chip: "success",
    card: "border-emerald-100 bg-white text-slate-950",
    iconBox: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  excellent: {
    icon: CheckCircle2,
    chip: "success",
    card: "border-emerald-100 bg-white text-slate-950",
    iconBox: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
};

function RecommendationItem({ item }) {
  const style = severityStyles[item.severity] || severityStyles.watch;
  const Icon = style.icon;

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${style.card}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${style.iconBox}`}>
            <Icon size={19} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-black tracking-tight text-slate-950">{item.title}</div>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{item.description}</p>
          </div>
        </div>
        <StatusChip variant={style.chip}>{item.statusLabel || item.severity}</StatusChip>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">
          {item.target?.label || "Review"}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black text-white">
          Action ready <ArrowRight size={13} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

export default function RecommendationCentreCard({ centre = {} }) {
  const items = centre.items || centre.actions || [];
  const metrics = centre.metrics || {};
  const nextAction = centre.nextAction || items[0] || null;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
              Recommendation Centre
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {nextAction ? nextAction.title : "No urgent recommendations"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              {centre.summary || "Ground Control has combined parking, officials, rules, weather and resources into one action queue."}
            </p>
          </div>
          <StatusChip variant={centre.status || "success"}>{centre.label || "Healthy"}</StatusChip>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Total</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{metrics.total || items.length}</div>
          </div>
          <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">Critical</div>
            <div className="mt-2 text-3xl font-black text-red-900">{metrics.critical || 0}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500">Attention</div>
            <div className="mt-2 text-3xl font-black text-amber-900">{metrics.attention || 0}</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">Watch</div>
            <div className="mt-2 text-3xl font-black text-emerald-900">{metrics.watch || 0}</div>
          </div>
        </div>
      </div>

      {items.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.slice(0, 6).map((item) => (
            <RecommendationItem key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 ring-1 ring-emerald-200">
              <ClipboardCheck size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl font-black">No actions required</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
                Ground Control has not found any immediate recommendations for this matchday.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
