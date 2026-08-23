import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Car,
  CheckCircle2,
  CloudSun,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import StatusChip from "@/ui/StatusChip.jsx";
import { dedupeActions } from "../../../lib/engines/actionFramework.js";

const SEVERITY_ORDER = { critical: 0, danger: 0, attention: 1, warning: 1, watch: 2, healthy: 3, success: 3 };

const DOMAIN_META = {
  fixtures: { label: "Schedule", icon: CalendarDays, target: "schedule" },
  unresolved: { label: "Schedule", icon: CalendarDays, target: "unresolved" },
  flow: { label: "Schedule", icon: CalendarDays, target: "schedule" },
  pitches: { label: "Pitches", icon: MapPinned, target: "pitchAssignments" },
  pitchClosures: { label: "Pitches", icon: MapPinned, target: "pitchClosures" },
  parking: { label: "Parking", icon: Car, target: "parkingIntelligence" },
  officials: { label: "Officials", icon: UsersRound, target: "officialsIntelligence" },
  weather: { label: "Weather", icon: CloudSun, target: "weatherIntelligence" },
  communications: { label: "Messages", icon: MessageSquareText, target: "coachMessages" },
  rules: { label: "Rules", icon: ShieldCheck, target: "competitionRules" },
  competitionRules: { label: "Rules", icon: ShieldCheck, target: "competitionRules" },
  optimiser: { label: "Optimiser", icon: Sparkles, target: "dayOptimiser" },
  operations: { label: "Operations", icon: Sparkles, target: "operationsHealth" },
};

function normaliseSeverity(value) {
  const severity = String(value || "watch").toLowerCase();
  if (["critical", "danger"].includes(severity)) return "critical";
  if (["attention", "warning"].includes(severity)) return "attention";
  if (["healthy", "success", "excellent"].includes(severity)) return "healthy";
  return "watch";
}

function normaliseAction(item = {}, source = "intelligence") {
  const domain = item.domain || item.target || "operations";
  const meta = DOMAIN_META[domain] || DOMAIN_META.operations;
  return {
    id: item.id || `${source}-${domain}-${item.title || item.description}`,
    source,
    dedupeKey: item.dedupeKey || item.metadata?.dedupeKey,
    domain,
    title: item.title || "Review matchday action",
    detail: item.detail || item.description || "Ground Control has identified an item to review.",
    guidance: item.guidance || item.cta || "Open the relevant area and review the recommendation.",
    metric: item.metric || "",
    severity: normaliseSeverity(item.severity || item.status),
    target: item.target || meta.target,
    areaLabel: meta.label,
    Icon: meta.icon,
  };
}

function mergeActions(intelligence = {}, recommendations = {}) {
  const primary = (intelligence.items || intelligence.insights || []).map((item) => normaliseAction(item, "intelligence"));
  const supplementary = (recommendations.items || recommendations.actions || []).map((item) => normaliseAction(item, "recommendations"));
  return dedupeActions([...primary, ...supplementary]).sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );
}

function severityStyle(severity) {
  if (severity === "critical") return {
    chip: "danger",
    row: "border-red-200 bg-red-50",
    icon: "bg-red-100 text-red-700",
    Icon: AlertTriangle,
  };
  if (severity === "attention") return {
    chip: "warning",
    row: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    Icon: AlertTriangle,
  };
  if (severity === "healthy") return {
    chip: "success",
    row: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    Icon: CheckCircle2,
  };
  return {
    chip: "info",
    row: "border-blue-200 bg-blue-50",
    icon: "bg-blue-100 text-blue-700",
    Icon: Sparkles,
  };
}

export default function MatchdayGuidanceCard({
  intelligence = {},
  recommendations = {},
  onNavigate,
}) {
  const actions = useMemo(
    () => mergeActions(intelligence, recommendations),
    [intelligence, recommendations]
  );

  const critical = actions.filter((item) => item.severity === "critical").length;
  const attention = actions.filter((item) => item.severity === "attention").length;
  const watch = actions.filter((item) => item.severity === "watch").length;
  const review = attention + watch;
  const healthy = actions.filter((item) => item.severity === "healthy").length;
  const next = actions[0] || null;
  const overallStatus = critical ? "danger" : review ? "warning" : "success";
  const overallLabel = critical ? "Action required" : review ? "Needs attention" : "Ready";

  const areas = useMemo(() => {
    const keys = ["fixtures", "pitches", "parking", "officials", "weather", "communications"];
    return keys.map((key) => {
      const matching = actions.filter((item) => {
        if (key === "fixtures") return ["fixtures", "unresolved", "flow", "rules", "competitionRules", "optimiser"].includes(item.domain);
        if (key === "pitches") return ["pitches", "pitchClosures"].includes(item.domain);
        return item.domain === key;
      });
      const worst = matching.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))[0];
      const meta = DOMAIN_META[key] || DOMAIN_META.operations;
      return {
        key,
        label: meta.label,
        Icon: meta.icon,
        target: meta.target,
        count: matching.filter((item) => item.severity !== "healthy").length,
        severity: worst?.severity || "healthy",
      };
    });
  }, [actions]);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-slate-950 p-6 text-white xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,.7fr)] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <Sparkles size={14} /> Matchday guidance
            </div>
            <h3 className="mt-4 text-3xl font-black tracking-tight">
              {next?.title || "No immediate action required"}
            </h3>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-6 text-slate-300">
              {next?.detail || "Ground Control has combined the key schedule, pitch, parking, officials and weather checks into one clear operating view."}
            </p>

            {next ? (
              <button
                type="button"
                onClick={() => onNavigate?.(next.target, next)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-amber-400 px-5 py-3 text-sm font-black text-slate-950 shadow-sm transition hover:bg-amber-300"
              >
                {next.guidance?.length > 70 ? "Open recommended area" : next.guidance}
                <ArrowRight size={17} strokeWidth={2.7} />
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Metric label="Critical" value={critical} tone="red" />
            <Metric label="Review" value={review} tone="amber" />
            <Metric label="Ready" value={healthy} tone="green" />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Overall status</div>
            <div className="mt-1 text-lg font-black text-slate-950">{overallLabel}</div>
          </div>
          <StatusChip variant={overallStatus}>{actions.length} guidance item{actions.length === 1 ? "" : "s"}</StatusChip>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Priority queue</div>
          <h4 className="mt-2 text-xl font-black text-slate-950">What needs doing, in order</h4>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
            Start at the top. Specialist detail remains available below, but it no longer competes with the main action queue.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {actions.length ? actions.slice(0, 7).map((item, index) => (
            <GuidanceRow key={`${item.id}-${index}`} item={item} position={index + 1} onNavigate={onNavigate} />
          )) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5" />
                <div>
                  <div className="text-sm font-black">No immediate actions found</div>
                  <div className="mt-1 text-xs font-bold leading-5 text-emerald-800">Review the specialist areas only when you need more detail.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Specialist areas</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {areas.map((area) => {
            const styles = severityStyle(area.severity);
            return (
              <button
                key={area.key}
                type="button"
                onClick={() => onNavigate?.(area.target, { domain: area.key, title: area.label })}
                className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${styles.row}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${styles.icon}`}>
                    <area.Icon size={18} strokeWidth={2.6} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-950">{area.label}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">
                      {area.count ? `${area.count} item${area.count === 1 ? "" : "s"} to review` : "No urgent issue"}
                    </div>
                  </div>
                </div>
                <ArrowRight size={17} className="shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function GuidanceRow({ item, position, onNavigate }) {
  const styles = severityStyle(item.severity);
  const StatusIcon = styles.Icon;
  const AreaIcon = item.Icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate?.(item.target, item)}
      className={`flex w-full flex-col gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm sm:flex-row sm:items-center ${styles.row}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white font-black text-slate-950 ring-1 ring-slate-200">{position}</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip variant={styles.chip}>{item.severity === "attention" ? "Review" : item.severity}</StatusChip>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              <AreaIcon size={13} /> {item.areaLabel}
            </span>
          </div>
          <div className="mt-2 text-sm font-black text-slate-950">{item.title}</div>
          <div className="mt-1 text-xs font-bold leading-5 text-slate-600">{item.detail}</div>
          <div className="mt-2 text-xs font-black text-slate-800">Recommended: {item.guidance}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
        {item.metric ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">{item.metric}</span> : null}
        <StatusIcon size={18} className={styles.icon.split(" ").find((value) => value.startsWith("text-"))} />
        <ArrowRight size={17} className="text-slate-400" />
      </div>
    </button>
  );
}

function Metric({ label, value, tone }) {
  const styles = {
    red: "border-red-300/20 bg-red-400/10 text-red-200",
    amber: "border-amber-300/20 bg-amber-400/10 text-amber-200",
    green: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  };
  return (
    <div className={`rounded-2xl border p-4 ${styles[tone]}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
    </div>
  );
}
