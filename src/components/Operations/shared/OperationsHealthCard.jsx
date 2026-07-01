import React from "react";
import { AlertTriangle, CheckCircle2, CircleGauge, ClipboardCheck, ShieldAlert } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

const toneClasses = {
  success: {
    panel: "border-emerald-200 bg-emerald-50 text-emerald-900",
    ring: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  warning: {
    panel: "border-amber-200 bg-amber-50 text-amber-900",
    ring: "bg-amber-100 text-amber-700 ring-amber-200",
    bar: "bg-amber-500",
  },
  danger: {
    panel: "border-red-200 bg-red-50 text-red-900",
    ring: "bg-red-100 text-red-700 ring-red-200",
    bar: "bg-red-500",
  },
  neutral: {
    panel: "border-slate-200 bg-slate-50 text-slate-900",
    ring: "bg-slate-100 text-slate-700 ring-slate-200",
    bar: "bg-slate-500",
  },
};

function getTone(status) {
  return toneClasses[status] || toneClasses.neutral;
}

function DomainTile({ domain }) {
  const tone = getTone(domain.status);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            {domain.label}
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">{domain.score}%</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${tone.ring}`}>
          {domain.status === "success" ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <AlertTriangle size={20} strokeWidth={2.5} />}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${domain.score}%` }} />
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">{domain.summary}</p>
    </div>
  );
}

export default function OperationsHealthCard({ health }) {
  const tone = getTone(health?.status);
  const actions = health?.actions || [];
  const issues = health?.issues || [];

  return (
    <div className="space-y-5">
      <div className={`rounded-3xl border p-6 shadow-sm ${tone.panel}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 ring-1 ${tone.ring}`}>
              <CircleGauge size={28} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] opacity-70">Operations Health</div>
              <h3 className="mt-2 text-4xl font-black tracking-tight">{health?.score ?? 0}%</h3>
              <p className="mt-2 max-w-3xl text-sm font-black leading-6 opacity-80">{health?.summary || "Matchday health calculated."}</p>
            </div>
          </div>
          <StatusChip variant={health?.status || "neutral"}>{health?.label || "Pending"}</StatusChip>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {(health?.domains || []).map((domain) => (
          <DomainTile key={domain.id} domain={domain} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
              <ShieldAlert size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Review Items</div>
              <h4 className="text-lg font-black text-slate-950">{issues.length ? `${issues.length} to review` : "Nothing urgent"}</h4>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {issues.length ? issues.slice(0, 6).map((item, index) => (
              <div key={`${item.domain}-${index}`} className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
                <span className="font-black text-slate-950">{item.domain}:</span> {item.issue}
              </div>
            )) : (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                No critical issues detected for this matchday.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <ClipboardCheck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Next Actions</div>
              <h4 className="text-lg font-black text-slate-950">{actions.length ? "Recommended order" : "Ready to publish"}</h4>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {actions.length ? actions.slice(0, 6).map((item, index) => (
              <div key={`${item.domain}-${index}`} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">{index + 1}</span>
                <span><span className="font-black text-slate-950">{item.domain}:</span> {item.action}</span>
              </div>
            )) : (
              <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-800 ring-1 ring-emerald-100">
                No immediate actions. Continue with publishing and communications.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
