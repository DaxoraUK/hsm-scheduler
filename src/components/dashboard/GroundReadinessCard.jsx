import React from "react";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

export default function GroundReadinessCard({
  readiness,
  alerts = [],
  totalFixtures = 0,
  peakCars = 0,
  carCap = 57,
  refWarnings = 0,
}) {
  const pct = readiness?.pct ?? 0;
  const checks = readiness?.checks ?? [];

  const variant = pct >= 90 ? "success" : pct >= 70 ? "warning" : "danger";
  const label = pct >= 90 ? "Ready" : pct >= 70 ? "Nearly ready" : "Needs work";

  const parkingPct = carCap ? Math.round((peakCars / carCap) * 100) : 0;
  const confirmedRefs = Math.max(totalFixtures - refWarnings, 0);

  const assessment =
    pct >= 95
      ? "Ready for publication"
      : pct >= 70
      ? "Ready with minor issues"
      : "Requires attention";

  const assessmentMessage =
    refWarnings > 0
      ? `Assign ${refWarnings} referee${refWarnings > 1 ? "s" : ""} to improve readiness.`
      : alerts.length > 0
      ? "Review outstanding alerts before publishing."
      : "Everything looks ready to publish.";

  return (
    <Card
      eyebrow="Readiness"
      title="Ground Ready"
      subtitle="Operational readiness for the weekend."
      action={<StatusChip variant={variant}>{label}</StatusChip>}
    >
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-5xl font-black tracking-tight text-slate-950">
            {pct}%
          </div>

          <div className="mt-1 text-sm font-bold text-slate-500">
            {alerts.length
              ? `${alerts.length} ${
                  alerts.length === 1 ? "item needs" : "items need"
                } attention`
              : "No major issues detected"}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            Status
          </div>
          <div className="mt-1 text-base font-black text-slate-900">
            {label}
          </div>
        </div>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${
            pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.key}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
              check.key === "officials"
                ? refWarnings === 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
                : check.ok
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
              }`}
            >
              {check.key === "officials" ? (refWarnings === 0 ? "✓" : "!") : check.ok ? "✓" : "!"}
            </span>

            <div className="min-w-0 text-sm font-bold text-slate-700">
              {check.key === "officials"
                ? refWarnings === 0
                  ? "Officials allocated"
                  : `${refWarnings} referee${refWarnings > 1 ? "s" : ""} unconfirmed`
                : check.ok
                ? check.okText
                : check.badText}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <div className="mb-4 text-xs font-black uppercase tracking-[0.25em] text-slate-400">
          Weekend Snapshot
        </div>

        <div className="grid grid-cols-3 gap-4">
          <SnapshotCard title="Fixtures" value={totalFixtures} subtitle="This weekend" />
          <SnapshotCard title="Parking" value={`${peakCars}/${carCap}`} subtitle={`${parkingPct}% capacity`} />
          <SnapshotCard title="Officials" value={`${confirmedRefs}/${totalFixtures}`} subtitle="Confirmed" />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
          Ground Control Assessment
        </div>

        <div className="mt-2 text-xl font-black text-slate-900">
          {assessment}
        </div>

        <div className="mt-2 text-sm font-medium text-slate-600">
          {assessmentMessage}
        </div>
      </div>
    </Card>
  );
}

function SnapshotCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-black uppercase tracking-wide text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>

      <div className="mt-1 text-xs font-semibold text-slate-500">
        {subtitle}
      </div>
    </div>
  );
}