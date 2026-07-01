import React from "react";
import {
  Clock,
  MapPin,
  UserCheck,
  Flag,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cleanName } from "../../../lib/scheduler.js";
import {
  getFixtureHealth,
  getOfficialStatus,
} from "../../../lib/operationsEngine.js";
import StatusChip from "../../ui/StatusChip.jsx";

export default function MatchFixtureCard({
  fixture,
  index,
  club,
  officialConflict = false,
  onFixtureClick,
}) {
  const teamName = cleanName(fixture.homeTeam, club?.name);
  const opposition = fixture.awayTeam || "TBC";
  const format =
    fixture.cfg?.format || fixture.manualFormat || fixture.format || "Fixture";

  const pitchLabel = fixture.pitchLabel || fixture.pitchId || "TBC";
  const official = fixture.referee || "TBC";
  const officialStatus = getOfficialStatus(fixture);
  const fixtureHealth = getFixtureHealth(fixture);

  const isPostponed = fixture.status === "postponed";
  const isCancelled = fixture.status === "cancelled";
  const isInactive = isPostponed || isCancelled;

  const cardTone = isInactive
    ? "border-slate-200 bg-slate-50 opacity-75"
    : fixtureHealth.score >= 85
    ? "border-emerald-100 bg-white"
    : fixtureHealth.score >= 60
    ? "border-amber-100 bg-white"
    : "border-red-100 bg-white";

  return (
    <article
      className={`rounded-3xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${cardTone}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusChip
              variant={
                isPostponed || isCancelled
                  ? "neutral"
                  : fixtureHealth.score >= 75
                  ? "success"
                  : "warning"
              }
            >
              {isPostponed
                ? "Postponed"
                : isCancelled
                ? "Cancelled"
                : "Scheduled"}
            </StatusChip>

            <StatusChip variant="neutral">{format}</StatusChip>

            <StatusChip variant={officialStatus.variant}>
              {officialStatus.label}
            </StatusChip>

            {fixture.isCup && <StatusChip variant="warning">Cup</StatusChip>}
            {fixture.manual && <StatusChip variant="info">Manual</StatusChip>}
          </div>

          <h3 className="truncate text-2xl font-black tracking-tight text-slate-950">
            {teamName}
          </h3>

          <div className="mt-1 text-sm font-black uppercase tracking-wide text-slate-400">
            vs
          </div>

          <div className="mt-1 truncate text-lg font-black text-slate-700">
            {opposition}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onFixtureClick?.(fixture, index)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
        >
          <SlidersHorizontal size={16} strokeWidth={2.5} />
          Open Control Centre
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={Clock}
          label="Kick-off"
          value={fixture.koTime || "TBC"}
        />

        <InfoTile icon={MapPin} label="Pitch" value={pitchLabel} />

        <InfoTile
          icon={UserCheck}
          label="Official"
          value={official}
          tone={officialConflict ? "danger" : "neutral"}
        />

        <InfoTile
          icon={Flag}
          label="Official Status"
          value={officialConflict ? "Clash" : fixture.refStatus || "TBC"}
          tone={officialConflict ? "danger" : officialStatus.variant}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          {fixtureHealth.score >= 75 ? (
            <CheckCircle2
              size={18}
              strokeWidth={2.5}
              className="text-emerald-600"
            />
          ) : (
            <AlertTriangle
              size={18}
              strokeWidth={2.5}
              className="text-amber-600"
            />
          )}

          <span className="text-sm font-black text-slate-600">
            Health {fixtureHealth.score}% · {fixtureHealth.label}
          </span>
        </div>

        <span className="text-xs font-black uppercase tracking-wide text-slate-400">
          Fixture #{index + 1}
        </span>
      </div>
    </article>
  );
}

function InfoTile({ icon: Icon, label, value, tone = "neutral" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-60">
        <Icon size={15} strokeWidth={2.5} />
        {label}
      </div>

      <div className="mt-2 truncate text-base font-black">{value}</div>
    </div>
  );
}