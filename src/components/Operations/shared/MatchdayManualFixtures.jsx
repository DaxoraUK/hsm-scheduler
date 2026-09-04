import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus, RotateCcw, Trash2 } from "lucide-react";
import ManualForm from "../../ManualForm.jsx";
import Card from "@/ui/Card.jsx";
import StatusChip from "@/ui/StatusChip.jsx";
import SecondaryButton from "@/ui/SecondaryButton.jsx";
import ConfirmDialog from "@/ui/ConfirmDialog.jsx";
import { getFixtureFlowIdentity } from "../../../lib/domain/fixtureVenueFlow.js";

export default function MatchdayManualFixtures({
  club,
  showManual,
  setShowManual,
  manualFixtures = [],
  setManualFixtures,
  onRemoveManualFixture,
  excludedFixtures = [],
  onRestoreExcludedFixture,
  readOnly = false,
  teamCfg,
  cleanName,
}) {
  const [pendingDeleteFixture, setPendingDeleteFixture] = useState(null);

  const deleteManualFixture = () => {
    if (!pendingDeleteFixture) return;
    if (typeof onRemoveManualFixture === "function") {
      onRemoveManualFixture(pendingDeleteFixture);
    } else {
      const fixtureIdentity = getFixtureFlowIdentity(pendingDeleteFixture);
      setManualFixtures((previous) =>
        previous.filter((candidate) => getFixtureFlowIdentity(candidate) !== fixtureIdentity),
      );
    }
    setPendingDeleteFixture(null);
  };

  return (
    <>
      <Card
      eyebrow="Manual Fixtures"
      title="Friendlies, Cups & Rearrangements"
      subtitle="Add fixtures that are not coming from FA Full-Time."
      action={
        <StatusChip variant={manualFixtures.length ? "info" : "neutral"}>
          {manualFixtures.length ? `${manualFixtures.length} added` : "Optional"}
        </StatusChip>
      }
    >
      <button
        type="button"
        onClick={() => setShowManual((previous) => !previous)}
        disabled={readOnly}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div>
          <div className="text-sm font-black text-slate-900">
            {readOnly ? "Schedule locked" : showManual ? "Hide manual fixture form" : "Add manual fixture"}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-500">
            {readOnly ? "Unlock the matchday before adding or removing fixtures." : "Use this for friendlies, cup games, rearranged fixtures or late additions."}
          </div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          {showManual ? (
            <ChevronUp size={20} strokeWidth={2.5} />
          ) : (
            <ChevronDown size={20} strokeWidth={2.5} />
          )}
        </div>
      </button>

      {showManual && !readOnly && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Plus size={19} strokeWidth={2.5} />
            </div>

            <div>
              <div className="font-black text-slate-950">New manual fixture</div>
              <div className="text-sm font-medium text-slate-500">
                Add it here, then re-run the schedule.
              </div>
            </div>
          </div>

          <ManualForm
            onAdd={(fixture) => {
              setManualFixtures((previous) => [...previous, fixture]);
            }}
            cfgList={teamCfg}
            club={club}
          />
        </div>
      )}

      {manualFixtures.length > 0 && (
        <div className="mt-5 space-y-3">
          {manualFixtures.map((fixture) => (
            <div
              key={getFixtureFlowIdentity(fixture)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <StatusChip variant="info">Manual</StatusChip>
                  {fixture.isCup && <StatusChip variant="warning">Cup</StatusChip>}
                </div>

                <div className="mt-2 truncate text-sm font-black text-slate-900">
                  {cleanName(fixture.homeTeam, club.name)} vs {fixture.awayTeam}
                </div>
              </div>

              <SecondaryButton
                disabled={readOnly}
                onClick={() => setPendingDeleteFixture(fixture)}
              >
                <Trash2 size={16} />
                Remove
              </SecondaryButton>
            </div>
          ))}
        </div>
      )}

      {excludedFixtures.length > 0 && (
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">Excluded provider fixtures</div>
          <p className="mt-1 text-sm font-semibold text-amber-900">These fixtures remain in the provider source and are excluded only from Ground Control. Restore them when they should be scheduled again.</p>
          <div className="mt-3 space-y-2">
            {excludedFixtures.map((fixture) => (
              <div key={getFixtureFlowIdentity(fixture)} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-900">{cleanName(fixture.homeTeam, club.name)} vs {fixture.awayTeam}</div>
                  <div className="mt-1 text-xs font-bold text-amber-800">Reason: {fixture.exclusion?.reason || "Other"}</div>
                </div>
                <SecondaryButton
                  disabled={readOnly || typeof onRestoreExcludedFixture !== "function"}
                  onClick={() => onRestoreExcludedFixture(fixture)}
                >
                  <RotateCcw size={16} /> Restore
                </SecondaryButton>
              </div>
            ))}
          </div>
        </div>
      )}
      </Card>
      <ConfirmDialog
        open={Boolean(pendingDeleteFixture)}
        eyebrow="Manual fixture"
        title="Delete this manual fixture?"
        description="Its manually recorded allocation, officials and related Ground Control state will be removed."
        confirmLabel="Delete fixture"
        cancelLabel="Keep fixture"
        tone="danger"
        initialFocus="cancel"
        onCancel={() => setPendingDeleteFixture(null)}
        onConfirm={deleteManualFixture}
      />
    </>
  );
}
