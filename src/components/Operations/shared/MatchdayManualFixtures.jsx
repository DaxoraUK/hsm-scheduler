import React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import ManualForm from "../../ManualForm.jsx";
import Card from "../../ui/Card.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import SecondaryButton from "../../ui/SecondaryButton.jsx";

export default function MatchdayManualFixtures({
  club,
  showManual,
  setShowManual,
  manualFixtures = [],
  setManualFixtures,
  teamCfg,
  cleanName,
}) {
  return (
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
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:bg-white"
      >
        <div>
          <div className="text-sm font-black text-slate-900">
            {showManual ? "Hide manual fixture form" : "Add manual fixture"}
          </div>
          <div className="mt-1 text-sm font-medium text-slate-500">
            Use this for friendlies, cup games, rearranged fixtures or late additions.
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

      {showManual && (
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
          {manualFixtures.map((fixture, index) => (
            <div
              key={`${fixture.homeTeam}-${index}`}
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
                onClick={() =>
                  setManualFixtures((previous) =>
                    previous.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
              >
                <Trash2 size={16} />
                Remove
              </SecondaryButton>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
