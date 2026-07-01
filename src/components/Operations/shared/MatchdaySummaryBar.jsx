import React from "react";
import {
  CalendarDays,
  CircleAlert,
  CircleDot,
  UserCheck,
} from "lucide-react";
import Card from "../../ui/Card.jsx";
import StatusChip from "../../ui/StatusChip.jsx";

export default function MatchdaySummaryBar({
  final = [],
  active = [],
  postponed = [],
  unresolved = [],
  refWarnings = 0,
  hasRun,
}) {
  if (!hasRun) return null;

  const needsReview = unresolved.length > 0 || refWarnings > 0;
  const actionRequired = unresolved.length > 0;

  const statusVariant = actionRequired
    ? "danger"
    : needsReview
    ? "warning"
    : "success";

  const statusText = actionRequired
    ? "Action Required"
    : needsReview
    ? "Needs Review"
    : "Ready";

  return (
    <Card
      eyebrow="Matchday"
      title="Matchday Overview"
      subtitle="Live status for fixtures, officials and matchday actions."
      action={<StatusChip variant={statusVariant}>{statusText}</StatusChip>}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniStat icon={CalendarDays} label="Fixtures" value={final.length} />
        <MiniStat icon={CircleDot} label="Active" value={active.length} />
        <MiniStat icon={CircleAlert} label="Unresolved" value={unresolved.length} />
        <MiniStat icon={UserCheck} label="Refs Outstanding" value={refWarnings} />
      </div>

      {postponed.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          {postponed.length} fixture{postponed.length > 1 ? "s" : ""} postponed.
        </div>
      )}
   </Card>
  );
}

function MiniStat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon size={21} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
