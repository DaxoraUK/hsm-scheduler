import React from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Info, Sparkles } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

function statusStyles(status) {
  if (status === "danger") {
    return {
      chip: "danger",
      icon: "bg-rose-50 text-rose-700 ring-rose-200",
      row: "border-rose-200 bg-rose-50/60",
      Icon: AlertTriangle,
    };
  }

  if (status === "warning") {
    return {
      chip: "warning",
      icon: "bg-amber-50 text-amber-700 ring-amber-200",
      row: "border-amber-200 bg-amber-50/60",
      Icon: AlertTriangle,
    };
  }

  if (status === "success") {
    return {
      chip: "success",
      icon: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      row: "border-emerald-200 bg-emerald-50/60",
      Icon: CheckCircle2,
    };
  }

  return {
    chip: "info",
    icon: "bg-sky-50 text-sky-700 ring-sky-200",
    row: "border-sky-200 bg-sky-50/60",
    Icon: Info,
  };
}

function ActionRow({ action }) {
  const styles = statusStyles(action.status);
  const Icon = styles.Icon;

  return (
    <div className={`rounded-2xl border p-4 ${styles.row}`}>
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${styles.icon}`}>
          <Icon size={18} strokeWidth={2.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-950">{action.title}</h4>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-600">{action.detail}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200">
              {action.cta || "Review"}
              <ChevronRight size={13} strokeWidth={3} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OperationsAssistantCard({ assistant }) {
  const styles = statusStyles(assistant?.status);
  const next = assistant?.nextAction;
  const actions = assistant?.actions || [];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 ring-1 ring-emerald-100">
            <Sparkles size={14} strokeWidth={2.8} />
            Operations Assistant
          </div>
          <h3 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
            {assistant?.label || "Ready to assist"}
          </h3>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
            {assistant?.summary || "Ground Control will surface the next best operational actions as the matchday is built."}
          </p>
        </div>
        <StatusChip variant={styles.chip}>{assistant?.metrics?.actionCount || 0} actions</StatusChip>
      </div>

      {next ? (
        <div className="mt-6 rounded-3xl border border-slate-900 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-300">Next best action</div>
              <h4 className="mt-2 text-xl font-black">{next.title}</h4>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-300">{next.detail}</p>
            </div>
            <div className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-sm">
              {next.cta || "Review"}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Active fixtures</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{assistant?.metrics?.activeCount || 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Urgent</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{assistant?.metrics?.dangerCount || 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Review</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{assistant?.metrics?.warningCount || 0}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Status</div>
          <div className="mt-2 text-lg font-black text-slate-950">{assistant?.label || "—"}</div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {actions.length ? (
          actions.map((action) => <ActionRow key={action.id} action={action} />)
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 shrink-0" size={20} strokeWidth={2.7} />
              <div>
                <h4 className="text-sm font-black">No urgent actions found</h4>
                <p className="mt-1 text-xs font-bold leading-5 text-emerald-800">
                  The assistant will surface actions here when fixtures, resources, weather or rules need attention.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
