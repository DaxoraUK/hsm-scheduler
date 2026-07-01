import React from "react";
import {
  Play,
  Save,
  Printer,
  Send,
  Lock,
  Sparkles,
} from "lucide-react";
import PrimaryButton from "../../ui/PrimaryButton.jsx";
import SecondaryButton from "../../ui/SecondaryButton.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { getMatchdayHealth } from "../../../lib/operationsEngine.js";

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

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Operations Centre
          </div>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {day} Operations Centre
          </h1>

          <p className="mt-2 text-base font-medium text-slate-500">
            Ready to build schedule for {fixtureCount} fixture
            {fixtureCount === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[430px]">
          <StatusChip
            variant={hasRun ? (needsReview ? "warning" : "success") : "neutral"}
            className="w-full"
          >
            {hasRun ? (needsReview ? "Review Required" : "Ready") : "Not Run"}
          </StatusChip>

          <StatusChip variant="neutral" className="w-full">
            {fixtureCount} fixture{fixtureCount === 1 ? "" : "s"}
          </StatusChip>

          <StatusChip variant={pitchCapacity.variant} className="w-full">
            {pitchCapacity.available} / {pitchCapacity.total} available
          </StatusChip>

          <StatusChip variant={matchdayHealth.variant} className="w-full">
            Health {matchdayHealth.score}%
          </StatusChip>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <PrimaryButton onClick={buildSchedule}>
            <Play size={17} />
            Build Schedule
          </PrimaryButton>

          {typeof setAllowArtificial === "function" && (
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Scheduling Rules
                </div>
                <div className="text-sm font-black text-slate-900">
                  Allow artificial surfaces
                </div>
              </div>

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

      <div className="mt-4 flex flex-wrap gap-3">
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