import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { ONBOARDING_STEPS } from "../../lib/onboarding/onboardingEngine.js";

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function OnboardingSettingsPanel({
  onboarding = {},
  onboardingStatus = "idle",
  onboardingError = "",
  onOpenOnboarding,
  onRefreshOnboarding,
  workspaceAccess,
}) {
  const complete = onboarding.status === "complete";
  const busy = ["loading", "saving"].includes(onboardingStatus);
  const completedSteps = Array.isArray(onboarding.completedSteps) ? onboarding.completedSteps : [];
  const canManage = Boolean(workspaceAccess?.canManageSettings);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-7">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <Rocket size={14} /> Customer onboarding
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              {complete ? "The operating baseline is configured." : "Finish the club setup in one guided flow."}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
              The wizard saves progress securely, validates the launch-critical configuration and can be re-run without weakening the club’s RLS boundary.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenOnboarding}
            disabled={!canManage || busy}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Rocket size={18} />}
            {complete ? "Run setup wizard again" : "Continue setup"}
          </button>
        </div>
      </section>

      {onboardingError ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <CircleAlert size={21} className="mt-0.5 shrink-0 text-rose-700" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-rose-900">Onboarding status unavailable</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-rose-800">{onboardingError}</p>
            </div>
            <button type="button" onClick={onRefreshOnboarding} className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-black text-rose-700"><RefreshCw size={15} /> Retry</button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {complete ? <CheckCircle2 size={23} /> : <CircleAlert size={23} />}
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Setup status</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">{complete ? "Complete" : onboarding.status === "in_progress" ? "In progress" : "Not started"}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {complete ? `Completed ${formatDate(onboarding.completedAt)}` : `${completedSteps.length} of ${ONBOARDING_STEPS.length} steps recorded`}
              </p>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${onboarding.required ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            {onboarding.required ? "Required" : "Re-runnable"}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ONBOARDING_STEPS.map((step, index) => {
            const done = complete || completedSteps.includes(step.id);
            const current = !complete && index === onboarding.currentStep;
            return (
              <div key={step.id} className={`rounded-[20px] border p-4 ${done ? "border-emerald-200 bg-emerald-50/60" : current ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${done ? "bg-emerald-500 text-white" : current ? "bg-amber-400 text-slate-950" : "bg-slate-200 text-slate-500"}`}>{done ? <CheckCircle2 size={16} /> : index + 1}</span>
                  {current ? <span className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">Current</span> : null}
                </div>
                <div className="mt-3 text-sm font-black text-slate-950">{step.label}</div>
                <div className="mt-1 text-xs font-semibold text-slate-500">{step.title}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ShieldCheck size={21} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-black text-slate-950">What happens when setup completes</h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Club configuration, teams and pitches are saved together in one database transaction. Ground Control then marks onboarding complete and writes a trusted audit event using the signed-in administrator’s identity.
            </p>
          </div>
          <ArrowRight size={20} className="mt-1 shrink-0 text-slate-300" />
        </div>
      </section>
    </div>
  );
}
