import React from "react";
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

const STATUS_STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

function CheckIcon({ status }) {
  if (status === "danger" || status === "warning") {
    return <AlertTriangle size={18} strokeWidth={2.5} />;
  }

  return <CheckCircle2 size={18} strokeWidth={2.5} />;
}

export default function CompetitionRulesCard({ rules }) {
  const safeRules = rules || {};
  const metrics = safeRules.metrics || {};
  const issues = safeRules.issues || [];
  const checks = safeRules.checks || [];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-700">
              Competition Rules
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {safeRules.score ?? 0}% rules compliance
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              Uses the existing Timing Settings as the source of truth. This keeps scheduling, validation and recommendations aligned instead of creating a second set of hidden rules.
            </p>
          </div>
          <StatusChip variant={safeRules.status || "neutral"}>{safeRules.label || "Pending"}</StatusChip>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Active fixtures</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{metrics.fixtures || 0}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Earliest KO</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{metrics.earliestKickOff || "—"}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Youth cut-off</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{metrics.latestYouthKickOff || "—"}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Adult latest</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{metrics.adultLatestKickOff || "—"}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.id}
            className={`rounded-3xl border p-5 shadow-sm ${STATUS_STYLES[check.status] || STATUS_STYLES.neutral}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5"><CheckIcon status={check.status} /></div>
              <div>
                <h4 className="text-base font-black">{check.label}</h4>
                <p className="mt-1 text-sm font-bold leading-6 opacity-80">{check.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Rule Issues</div>
            <h3 className="mt-2 text-xl font-black text-slate-950">
              {issues.length ? `${issues.length} item${issues.length === 1 ? "" : "s"} need review` : "No competition rule issues"}
            </h3>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 ring-1 ring-slate-200">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
        </div>

        {issues.length ? (
          <div className="mt-5 space-y-3">
            {issues.slice(0, 8).map((issue, index) => (
              <div
                key={`${issue.type}-${issue.fixture}-${index}`}
                className={`rounded-2xl border p-4 ${STATUS_STYLES[issue.severity] || STATUS_STYLES.neutral}`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-black">{issue.title}</div>
                    <p className="mt-1 text-sm font-bold leading-6 opacity-85">{issue.detail}</p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] opacity-70">{issue.action}</p>
                  </div>
                  <StatusChip variant={issue.severity}>{issue.severity === "danger" ? "Action" : "Review"}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <Clock3 size={20} strokeWidth={2.5} />
            <p className="text-sm font-bold leading-6">
              Current fixtures comply with timing windows, pitch closures, pitch format checks and artificial-surface rules.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
