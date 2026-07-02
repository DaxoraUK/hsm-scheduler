import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  MapPinned,
  Play,
  Printer,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import PrimaryButton from "../../ui/PrimaryButton.jsx";
import SecondaryButton from "../../ui/SecondaryButton.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { getMatchdayHealth } from "../../../lib/operationsEngine.js";

function getNextAction({ hasRun, unresolvedCount, refWarnings, closedPitches }) {
  if (!hasRun) {
    return {
      label: "Build the schedule",
      detail: "Start by creating the fixture plan for this matchday.",
      variant: "info",
      icon: Play,
    };
  }

  if (unresolvedCount > 0) {
    return {
      label: "Resolve fixture gaps",
      detail: `${unresolvedCount} fixture${unresolvedCount === 1 ? "" : "s"} need manual attention before publishing.`,
      variant: "danger",
      icon: AlertTriangle,
    };
  }

  if (refWarnings > 0) {
    return {
      label: "Confirm officials",
      detail: `${refWarnings} referee assignment${refWarnings === 1 ? "" : "s"} need chasing.`,
      variant: "warning",
      icon: AlertTriangle,
    };
  }

  if ((closedPitches || []).length > 0) {
    return {
      label: "Check closed pitches",
      detail: `${closedPitches.length} pitch${closedPitches.length === 1 ? " is" : "es are"} currently unavailable.`,
      variant: "warning",
      icon: MapPinned,
    };
  }

  return {
    label: "Ready to publish",
    detail: "The plan looks ready for coach messages, printing and final checks.",
    variant: "success",
    icon: CheckCircle2,
  };
}

function WorkflowStep({ number, title, detail, active }) {
  return (
    <div className={`rounded-2xl border p-4 ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
          {number}
        </div>
        <div>
          <div className="text-sm font-black text-slate-950">{title}</div>
          <div className="mt-1 text-xs font-bold leading-5 text-slate-500">{detail}</div>
        </div>
      </div>
    </div>
  );
}

export default function MatchdayActionBar({
  day = "Matchday",
  mode = "test",
  hasRun,
  fixtureCount = 0,
  unresolvedCount = 0,
  refWarnings = 0,
  runTest,
  runLive,
  saveWeek,
  pitchCfg = {},
  closedPitches = [],
  allowArtificial,
  setAllowArtificial,
}) {
  const needsReview = unresolvedCount > 0 || refWarnings > 0;

  const matchdayHealth = getMatchdayHealth({
    hasRun,
    unresolvedCount,
    refWarnings,
    pitchCfg,
    closedPitches,
  });

  const pitchCapacity = matchdayHealth.pitchCapacity;
  const buildSchedule = mode === "test" ? runTest : runLive;
  const nextAction = getNextAction({ hasRun, unresolvedCount, refWarnings, closedPitches });
  const NextIcon = nextAction.icon;
  const buildLabel = mode === "test" ? `Run ${day} Test` : `Fetch ${day} Fixtures`;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-6 py-6 text-white sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">
              Operations Command
            </div>

            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              {day} matchday control
            </h1>

            <p className="mt-3 text-sm font-bold leading-6 text-slate-300 sm:text-base">
              Build the schedule, review risks, manage resources and prepare the matchday for publication from one guided workspace.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[470px]">
            <StatusChip
              variant={hasRun ? (needsReview ? "warning" : "success") : "neutral"}
              className="w-full border-white/10 shadow-none"
            >
              {hasRun ? (needsReview ? "Review Required" : "Ready") : "Not Run"}
            </StatusChip>

            <StatusChip variant="neutral" className="w-full border-white/10 shadow-none">
              {fixtureCount} fixture{fixtureCount === 1 ? "" : "s"}
            </StatusChip>

            <StatusChip variant={pitchCapacity.variant} className="w-full border-white/10 shadow-none">
              {pitchCapacity.available} / {pitchCapacity.total} pitches available
            </StatusChip>

            <StatusChip variant={matchdayHealth.variant} className="w-full border-white/10 shadow-none">
              Health {matchdayHealth.score}%
            </StatusChip>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-[1.1fr_0.9fr] sm:p-7">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-800 ring-1 ring-slate-200">
                <NextIcon size={22} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
                  Next best action
                </div>
                <h2 className="mt-1 text-xl font-black text-slate-950">{nextAction.label}</h2>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-500">{nextAction.detail}</p>
              </div>
            </div>

            <StatusChip variant={nextAction.variant} size="lg">
              Guided
            </StatusChip>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
            <PrimaryButton onClick={buildSchedule} className="w-full lg:w-auto">
              <Play size={17} />
              {buildLabel}
            </PrimaryButton>

            {typeof setAllowArtificial === "function" && (
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm">
                <span>Allow artificial surfaces</span>
                <input
                  type="checkbox"
                  checked={Boolean(allowArtificial)}
                  onChange={(event) => setAllowArtificial(event.target.checked)}
                  className="h-5 w-5 accent-emerald-600"
                />
              </label>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          <WorkflowStep
            number="1"
            title="Build"
            detail="Fetch or run test fixtures and let the engine create the plan."
            active={!hasRun}
          />
          <WorkflowStep
            number="2"
            title="Review"
            detail="Check unresolved fixtures, pitch pressure, officials and recommendations."
            active={hasRun && needsReview}
          />
          <WorkflowStep
            number="3"
            title="Publish"
            detail="Save the week, print schedules and prepare coach communications."
            active={hasRun && !needsReview}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 border-t border-slate-200 bg-white px-6 py-5 sm:px-7">
        <SecondaryButton onClick={saveWeek}>
          <Save size={17} />
          Save Week
        </SecondaryButton>

        <SecondaryButton onClick={() => window.print()}>
          <Printer size={17} />
          Print
        </SecondaryButton>

        <SecondaryButton>
          <Send size={17} />
          Publish
        </SecondaryButton>

        <SecondaryButton>
          <Lock size={17} />
          Lock
        </SecondaryButton>

        <SecondaryButton>
          <Sparkles size={17} />
          Optimise
        </SecondaryButton>
      </div>
    </section>
  );
}
