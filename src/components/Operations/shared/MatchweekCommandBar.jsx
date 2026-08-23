import React from "react";
import { AlertTriangle, Check, Lock, LockOpen, MapPinned, Play, Printer, Save, Send, Sparkles } from "lucide-react";
import PrimaryButton from "@/ui/PrimaryButton.jsx";
import SecondaryButton from "@/ui/SecondaryButton.jsx";
import StatusChip from "@/ui/StatusChip.jsx";
import { getMatchdayHealth } from "../../../lib/operationsEngine.js";

function workflowState({ hasRun, unresolvedCount, refWarnings, closedPitches, isLocked }) {
  if (isLocked) return "locked";
  if (!hasRun) return "import";
  if (unresolvedCount > 0) return "review";
  if (refWarnings > 0 || closedPitches.length > 0) return "resolve";
  return "notify";
}

function WorkflowStep({ number, title, state }) {
  const complete = state === "complete";
  const active = state === "active";
  return (
    <div className={`rounded-2xl border px-3 py-3 ${active ? "border-emerald-300 bg-emerald-50" : complete ? "border-emerald-100 bg-white" : "border-slate-200 bg-slate-50"}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${active ? "bg-emerald-600 text-white" : complete ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"}`}>
          {complete ? <Check size={14} strokeWidth={3} /> : number}
        </span>
        <span className={`text-xs font-black ${active ? "text-emerald-950" : complete ? "text-slate-800" : "text-slate-500"}`}>{title}</span>
      </div>
    </div>
  );
}

export default function MatchweekCommandBar({
  day = "Matchday", mode = "test", hasRun, fixtureCount = 0, unresolvedCount = 0, refWarnings = 0,
  runTest, runLive, saveWeek, pitchCfg = {}, closedPitches = [], allowArtificial, setAllowArtificial,
  isLocked = false, onToggleLock, onPrint, onPublish, onReview, onResolve, onOptimise, optimisationCount = 0,
}) {
  const state = workflowState({ hasRun, unresolvedCount, refWarnings, closedPitches, isLocked });
  const buildSchedule = mode === "test" ? runTest : runLive;
  const matchdayHealth = getMatchdayHealth({ hasRun, unresolvedCount, refWarnings, pitchCfg, closedPitches });
  const needsAttention = unresolvedCount + refWarnings;
  const action = state === "locked"
    ? { title: "Matchweek approved and locked", detail: "The approved plan is protected from changes.", label: "Unlock schedule", icon: LockOpen, onClick: onToggleLock }
    : state === "import"
      ? { title: "Import and build the fixture plan", detail: "Load official fixture feeds or demonstration data, then let Ground Control create the first draft.", label: mode === "test" ? `Build ${day} schedule` : `Import ${day} fixtures`, icon: Play, onClick: buildSchedule }
      : state === "review"
        ? { title: "Review unresolved fixtures", detail: `${unresolvedCount} fixture${unresolvedCount === 1 ? "" : "s"} need a team, format, pitch or time decision.`, label: "Open unresolved fixtures", icon: AlertTriangle, onClick: onReview }
        : state === "resolve"
          ? { title: "Resolve remaining operational checks", detail: refWarnings ? `${refWarnings} league referee appointment${refWarnings === 1 ? "" : "s"} remain unconfirmed.` : `${closedPitches.length} pitch closure${closedPitches.length === 1 ? "" : "s"} need review.`, label: "Open priority checks", icon: AlertTriangle, onClick: onResolve }
          : { title: "Notify teams and complete the matchweek", detail: "The schedule is ready for communications, final review and locking.", label: "Open communications", icon: Send, onClick: onPublish };
  const ActionIcon = action.icon;
  const steps = [
    { title: "Import", complete: hasRun, active: state === "import" },
    { title: "Review", complete: hasRun && unresolvedCount === 0, active: state === "review" },
    { title: "Allocate", complete: hasRun && unresolvedCount === 0, active: false },
    { title: "Resolve", complete: hasRun && needsAttention === 0, active: state === "resolve" },
    { title: "Notify", complete: isLocked, active: state === "notify" },
    { title: "Lock", complete: isLocked, active: hasRun && needsAttention === 0 && !isLocked },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-6 py-6 text-white sm:px-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Matchweek command</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{day} operations</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-slate-300">One guided route from fixture import through review, allocation, communication and approval.</p>
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-lg xl:justify-end">
            <StatusChip variant={isLocked ? "success" : needsAttention ? "warning" : hasRun ? "success" : "neutral"}>{isLocked ? "Locked" : needsAttention ? `${needsAttention} to resolve` : hasRun ? "Ready" : "Not built"}</StatusChip>
            <StatusChip variant="neutral">{fixtureCount} fixture{fixtureCount === 1 ? "" : "s"}</StatusChip>
            <StatusChip variant={matchdayHealth.pitchCapacity.variant}>{matchdayHealth.pitchCapacity.available}/{matchdayHealth.pitchCapacity.total} pitches</StatusChip>
          </div>
        </div>
      </div>
      <div className="p-6 sm:p-7">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {steps.map((step, index) => <WorkflowStep key={step.title} number={index + 1} title={step.title} state={step.active ? "active" : step.complete ? "complete" : "pending"} />)}
        </div>
        <div className="mt-5 flex flex-col gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-800 ring-1 ring-slate-200"><ActionIcon size={22} strokeWidth={2.5} /></div>
            <div><div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Next action</div><h2 className="mt-1 text-xl font-black text-slate-950">{action.title}</h2><p className="mt-1 text-sm font-bold leading-6 text-slate-500">{action.detail}</p></div>
          </div>
          <PrimaryButton onClick={action.onClick} className="w-full lg:w-auto"><ActionIcon size={17} />{action.label}</PrimaryButton>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {typeof setAllowArtificial === "function" ? <label className={`flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 ${isLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}><input type="checkbox" checked={Boolean(allowArtificial)} onChange={(event) => setAllowArtificial(event.target.checked)} disabled={isLocked} className="h-5 w-5 accent-emerald-600" />Allow artificial surfaces</label> : null}
          <SecondaryButton onClick={saveWeek} disabled={!hasRun}><Save size={17} />Save</SecondaryButton>
          <SecondaryButton onClick={onPrint} disabled={!hasRun || fixtureCount === 0}><Printer size={17} />Print</SecondaryButton>
          <SecondaryButton onClick={onPublish} disabled={!hasRun}><Send size={17} />Communications</SecondaryButton>
          <SecondaryButton onClick={onToggleLock} disabled={!hasRun || fixtureCount === 0}>{isLocked ? <LockOpen size={17} /> : <Lock size={17} />}{isLocked ? "Unlock" : "Lock"}</SecondaryButton>
          <SecondaryButton onClick={onOptimise} disabled={isLocked || optimisationCount === 0}><Sparkles size={17} />{optimisationCount ? `${optimisationCount} improvement${optimisationCount === 1 ? "" : "s"}` : "Optimised"}</SecondaryButton>
          {closedPitches.length > 0 ? <StatusChip variant="warning"><MapPinned size={14} />{closedPitches.length} closed</StatusChip> : null}
        </div>
      </div>
    </section>
  );
}
