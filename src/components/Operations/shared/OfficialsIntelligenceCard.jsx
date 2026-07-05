import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  ShieldCheck,
  TimerReset,
  UserCheck,
  UsersRound,
} from "lucide-react";
import StatusChip from "@/ui/StatusChip.jsx";

const severityStyles = {
  critical: {
    chip: "danger",
    panel: "border-red-200 bg-red-50/70",
    icon: "bg-white text-red-700 ring-red-200",
    Icon: AlertTriangle,
  },
  attention: {
    chip: "warning",
    panel: "border-amber-200 bg-amber-50/70",
    icon: "bg-white text-amber-700 ring-amber-200",
    Icon: AlertTriangle,
  },
  watch: {
    chip: "warning",
    panel: "border-slate-200 bg-white",
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    Icon: Clock3,
  },
  healthy: {
    chip: "success",
    panel: "border-emerald-200 bg-emerald-50/60",
    icon: "bg-white text-emerald-700 ring-emerald-200",
    Icon: CheckCircle2,
  },
};

function metricTone(value, warning = false, danger = false) {
  if (danger) return "border-red-200 bg-red-50 text-red-900";
  if (warning) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-white text-slate-950";
}

function MetricTile({ icon: Icon, label, value, detail, warning = false, danger = false }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${metricTone(value, warning, danger)}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] opacity-60">
        <Icon size={14} strokeWidth={2.6} /> {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {detail ? <div className="mt-1 text-xs font-bold opacity-70">{detail}</div> : null}
    </div>
  );
}

function RecommendationRow({ recommendation, onFixtureClick }) {
  const style = severityStyles[recommendation.severity] || severityStyles.watch;
  const Icon = style.Icon;
  const fixtures = Array.isArray(recommendation.fixtures) ? recommendation.fixtures : [];

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${style.panel}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${style.icon}`}>
          <Icon size={20} strokeWidth={2.6} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-base font-black tracking-tight text-slate-950">{recommendation.title}</h4>
              <p className="mt-1 text-sm font-bold leading-6 text-slate-600">{recommendation.detail}</p>
            </div>
            <StatusChip variant={style.chip}>{recommendation.metric || recommendation.severity}</StatusChip>
          </div>

          {recommendation.guidance ? (
            <div className="mt-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold leading-6 text-white">
              {recommendation.guidance}
            </div>
          ) : null}

          {fixtures.length && typeof onFixtureClick === "function" ? (
            <button
              type="button"
              onClick={() => onFixtureClick(fixtures[0])}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
            >
              Open first affected fixture <ArrowRight size={14} strokeWidth={2.7} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkloadRow({ workload, onFixtureClick }) {
  const risky = workload.overlaps > 0 || workload.tightTurnarounds > 0;
  const firstFixture = workload.assignments?.[0]?.fixture;

  return (
    <button
      type="button"
      onClick={() => firstFixture && typeof onFixtureClick === "function" && onFixtureClick(firstFixture)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-white hover:shadow-sm disabled:cursor-default"
      disabled={!firstFixture || typeof onFixtureClick !== "function"}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-slate-950">{workload.name}</div>
        <div className="mt-1 text-xs font-bold text-slate-500">
          {workload.firstTime}–{workload.lastTime} · {workload.role?.replace(/_/g, " ") || "Official"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {risky ? <StatusChip variant={workload.overlaps ? "danger" : "warning"}>{workload.overlaps ? "Clash" : "Tight"}</StatusChip> : null}
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {workload.fixtureCount} game{workload.fixtureCount === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

function FixtureRow({ item, onFixtureClick }) {
  const stateLabels = {
    unassigned: "Unassigned",
    declined: "Declined",
    awaiting: "Awaiting",
    assigned: "Assigned",
  };
  const variant = item.state === "declined" ? "danger" : item.state === "unassigned" ? "warning" : "info";

  return (
    <button
      type="button"
      onClick={() => typeof onFixtureClick === "function" && onFixtureClick(item.fixture)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-white hover:shadow-sm"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-black text-slate-950">{item.label}</div>
        <div className="mt-1 text-xs font-bold text-slate-500">{item.window} · {item.official || "TBC"}</div>
      </div>
      <StatusChip variant={variant}>{stateLabels[item.state] || item.state}</StatusChip>
    </button>
  );
}

export default function OfficialsIntelligenceCard({ intelligence = {}, onFixtureClick }) {
  const metrics = intelligence.metrics || {};
  const pool = intelligence.pool || {};
  const peak = intelligence.peak || {};
  const recommendations = intelligence.recommendations || [];
  const workloads = intelligence.workloads || [];
  const attentionFixtures = [
    ...(intelligence.missingFixtures || []),
    ...(intelligence.awaitingFixtures || []),
  ];
  const next = intelligence.nextAction || recommendations[0] || null;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid xl:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-100">
              <UserCheck size={15} strokeWidth={2.8} /> Officials Intelligence v2
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <h3 className="text-3xl font-black tracking-tight text-slate-950">{intelligence.score ?? 0}%</h3>
              <StatusChip variant={intelligence.status || "neutral"}>{intelligence.label || "Officials"}</StatusChip>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              {intelligence.summary || "Ground Control is checking coverage, confirmation status, peak demand and official workload."}
            </p>

            {next ? (
              <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">Next best move</div>
                <div className="mt-2 text-lg font-black">{next.title}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-300">{next.guidance || next.detail}</p>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-6 xl:border-l xl:border-t-0">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile
                icon={ShieldCheck}
                label="Coverage"
                value={`${metrics.coverage ?? 0}%`}
                detail={`${metrics.assigned || 0}/${metrics.fixtures || 0} assigned`}
                warning={(metrics.coverage || 0) < 100}
                danger={(metrics.coverage || 0) < 75}
              />
              <MetricTile
                icon={UsersRound}
                label="Available pool"
                value={pool.configured ? `${pool.available}/${pool.configured}` : "Not set"}
                detail={pool.configured ? `${pool.unavailable || 0} unavailable` : "Configure in Settings"}
                warning={!pool.configured || pool.shortage > 0}
                danger={pool.shortage > 0}
              />
              <MetricTile
                icon={Gauge}
                label="Peak demand"
                value={metrics.peakDemand || 0}
                detail={metrics.peakWindow || "No timed fixtures"}
                warning={pool.configured && (metrics.peakDemand || 0) >= pool.available}
                danger={(metrics.shortage || 0) > 0}
              />
              <MetricTile
                icon={TimerReset}
                label="Workload risk"
                value={(metrics.conflicts || 0) + (metrics.tightTurnarounds || 0)}
                detail={`${metrics.conflicts || 0} clashes · ${metrics.tightTurnarounds || 0} tight`}
                warning={(metrics.tightTurnarounds || 0) > 0}
                danger={(metrics.conflicts || 0) > 0}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Action plan</div>
              <h4 className="mt-1 text-xl font-black text-slate-950">What needs doing next</h4>
            </div>
            <StatusChip variant={intelligence.status || "neutral"}>{recommendations.length} actions</StatusChip>
          </div>
          <div className="mt-5 space-y-3">
            {recommendations.slice(0, 6).map((recommendation) => (
              <RecommendationRow
                key={recommendation.id}
                recommendation={recommendation}
                onFixtureClick={onFixtureClick}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Peak pressure</div>
                <h4 className="mt-1 text-xl font-black text-slate-950">{peak.label || "No timed fixtures"}</h4>
              </div>
              <StatusChip variant={(metrics.shortage || 0) > 0 ? "danger" : "success"}>
                {(metrics.shortage || 0) > 0 ? `${metrics.shortage} short` : `${metrics.peakDemand || 0} required`}
              </StatusChip>
            </div>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
              {peak.fixtures?.length
                ? `${peak.fixtures.length} fixture${peak.fixtures.length === 1 ? "" : "s"} overlap in the busiest officials window.`
                : "Timed fixtures will appear here after the schedule is built."}
            </p>
            <div className="mt-4 space-y-2">
              {(peak.fixtures || []).slice(0, 5).map((item) => (
                <FixtureRow key={item.id} item={item} onFixtureClick={onFixtureClick} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Official workload</div>
            <h4 className="mt-1 text-xl font-black text-slate-950">Appointments by official</h4>
            <div className="mt-4 space-y-2">
              {workloads.length ? workloads.slice(0, 6).map((workload) => (
                <WorkloadRow key={workload.id} workload={workload} onFixtureClick={onFixtureClick} />
              )) : (
                <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                  Assign officials to fixtures to build the workload view.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {attentionFixtures.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Coverage queue</div>
              <h4 className="mt-1 text-xl font-black text-slate-950">Fixtures needing official action</h4>
            </div>
            <div className="text-sm font-black text-slate-500">{attentionFixtures.length} to resolve</div>
          </div>
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {attentionFixtures.slice(0, 8).map((item) => (
              <FixtureRow key={`${item.id}-${item.state}`} item={item} onFixtureClick={onFixtureClick} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
