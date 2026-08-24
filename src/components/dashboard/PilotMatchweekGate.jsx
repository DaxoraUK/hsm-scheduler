import React from "react";
import { ArrowRight, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react";

export default function PilotMatchweekGate({ model, onAction }) {
  if (!model) return null;
  const next = model.blockers[0] || null;
  return (
    <section aria-labelledby="pilot-matchweek-gate-title" className={`overflow-hidden rounded-[28px] border shadow-sm ${model.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${model.ready ? "bg-emerald-600 text-white" : "bg-amber-500 text-slate-950"}`}>{model.ready ? <ShieldCheck size={24} /> : <CircleAlert size={24} />}</div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Controlled pilot gate</div>
            <h2 id="pilot-matchweek-gate-title" className="mt-1 text-xl font-black text-slate-950">{model.ready ? "Ready for controlled use" : "Hold before operational use"}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{model.ready ? "The current matchweek has passed every operational pilot check. Keep the club's fallback route available." : `${model.blockers.length} launch ${model.blockers.length === 1 ? "check needs" : "checks need"} attention before this plan is relied upon.`}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="rounded-2xl border border-white/70 bg-white px-4 py-2.5 text-center shadow-sm"><div className="text-xl font-black text-slate-950">{model.complete}/{model.total}</div><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">checks passed</div></div>
          {next ? <button type="button" onClick={() => onAction?.(next.action)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Fix next issue <ArrowRight size={17} /></button> : null}
        </div>
      </div>
      <div className="grid border-t border-slate-900/10 sm:grid-cols-2 xl:grid-cols-6">
        {model.checks.map((check) => (
          <button key={check.id} type="button" onClick={() => onAction?.(check.action)} className="flex min-h-24 items-start gap-3 border-b border-slate-900/10 bg-white/55 p-4 text-left transition hover:bg-white sm:border-r xl:border-b-0">
            <CheckCircle2 size={18} className={check.passed ? "mt-0.5 shrink-0 text-emerald-600" : "mt-0.5 shrink-0 text-slate-300"} />
            <span className="min-w-0"><span className="block text-xs font-black text-slate-950">{check.label}</span><span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-500">{check.detail}</span></span>
          </button>
        ))}
      </div>
    </section>
  );
}

