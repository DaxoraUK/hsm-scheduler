import React from "react";
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, UsersRound } from "lucide-react";
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

function RuleMetric({ label, value, helper }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
      {helper ? <div className="mt-1 text-xs font-bold text-slate-400">{helper}</div> : null}
    </div>
  );
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
              Uses Timing Settings, team type, pitch configuration and venue settings from the shared configuration layer. Adult fixtures no longer inherit youth cut-off rules.
            </p>
          </div>
          <StatusChip variant={safeRules.status || "neutral"}>{safeRules.label || "Pending"}</StatusChip>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RuleMetric label="Active fixtures" value={metrics.fixtures || 0} helper={`${metrics.youthFixtures || 0} youth · ${metrics.adultFixtures || 0} adult`} />
          <RuleMetric label="Earliest KO" value={metrics.earliestKickOff || "—"} helper="From Timing Settings" />
          <RuleMetric label="Youth cut-off" value={metrics.latestYouthKickOff || "—"} helper="Youth fixtures only" />
          <RuleMetric label="Adult latest" value={metrics.adultLatestKickOff || "—"} helper="Adult/open age fixtures" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <div
            key={check.id}
            className={`rounded-3xl border p-5 shadow-sm ${STATUS_STYLES[check.status] || STATUS_STYLES.neutral}`}
          >
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <CheckIcon status={check.status} />
                <StatusChip variant={check.status}>{check.status === "success" ? "OK" : check.status === "danger" ? "Action" : "Review"}</StatusChip>
              </div>
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
            {issues.length ? <AlertTriangle size={22} strokeWidth={2.5} /> : <ShieldCheck size={22} strokeWidth={2.5} />}
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
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <Clock3 size={20} strokeWidth={2.5} />
              <p className="text-sm font-bold leading-6">
                Current fixtures comply with timing windows, pitch closures, pitch format checks and artificial-surface rules.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
              <UsersRound size={20} strokeWidth={2.5} />
              <p className="text-sm font-bold leading-6">
                Team profiles are read from Settings, so youth and adult fixtures can follow different rule windows.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
