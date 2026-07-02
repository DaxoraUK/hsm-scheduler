import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardCheck,
} from "lucide-react";

export default function DashboardWorkflowCard({
  steps = [],
  nextAction,
  completedSteps = 0,
  totalSteps = 0,
}) {
  const pct = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
              Guided Workflow
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              {nextAction?.title || "Weekend ready"}
            </h2>
            <p className="mt-2 text-base font-semibold text-slate-500">
              {nextAction?.detail || "All checklist items are complete."}
            </p>
          </div>

          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <ClipboardCheck size={28} strokeWidth={2.4} />
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm font-black text-slate-500">
            <span>Progress</span>
            <span>{completedSteps}/{totalSteps}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-6">
        {steps.map((step, index) => (
          <WorkflowStep key={step.key} step={step} index={index + 1} />
        ))}
      </div>
    </section>
  );
}

function WorkflowStep({ step, index }) {
  const state = getState(step.status);
  const Icon = state.icon;

  return (
    <button
      type="button"
      onClick={step.onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${state.wrap}`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${state.iconWrap}`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {String(index).padStart(2, "0")}
          </span>
          {step.required && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
              Required
            </span>
          )}
        </div>

        <div className="mt-1 font-black text-slate-950">
          {step.title}
        </div>
        <div className="mt-0.5 text-sm font-semibold text-slate-500">
          {step.detail}
        </div>
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700"
      />
    </button>
  );
}

function getState(status) {
  if (status === "complete") {
    return {
      icon: CheckCircle2,
      wrap: "border-emerald-200 bg-emerald-50",
      iconWrap: "bg-emerald-100 text-emerald-700",
    };
  }

  if (status === "warning" || status === "current") {
    return {
      icon: AlertTriangle,
      wrap: "border-amber-200 bg-amber-50",
      iconWrap: "bg-amber-100 text-amber-700",
    };
  }

  return {
    icon: Circle,
    wrap: "border-slate-200 bg-slate-50",
    iconWrap: "bg-white text-slate-500 ring-1 ring-slate-200",
  };
}
