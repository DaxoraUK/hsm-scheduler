import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  MessageSquareText,
  ParkingCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import Card from "../ui/Card.jsx";
import StatusChip from "../ui/StatusChip.jsx";

export default function GroundReadinessCard({
  readiness,
  alerts = [],
  totalFixtures = 0,
  peakCars = 0,
  carCap = 57,
  refWarnings = 0,
  setMainPage,
  setDayTab,
}) {
  const pct = readiness?.pct ?? 0;
  const parkingPct = carCap ? Math.round((peakCars / Math.max(carCap, 1)) * 100) : 0;
  const status = getStatus({ pct, alerts, refWarnings, totalFixtures });
  const canPublish = status.key === "ready";

  const domains = [
    {
      key: "fixtures",
      title: "Fixtures",
      value: totalFixtures > 0 ? `${totalFixtures} planned` : "Build schedule",
      state: totalFixtures > 0 ? "done" : "issue",
      icon: CircleDot,
      action: () => {
        setMainPage?.("operations");
        setDayTab?.("saturday");
      },
    },
    {
      key: "officials",
      title: "Officials",
      value: refWarnings === 0 ? "Clear" : `${refWarnings} to confirm`,
      state: refWarnings === 0 ? "done" : "issue",
      icon: ShieldCheck,
      action: () => {
        setMainPage?.("operations");
        setDayTab?.("saturday");
      },
    },
    {
      key: "parking",
      title: "Parking",
      value: parkingPct > 100 ? "Over capacity" : `${parkingPct}% peak`,
      state: parkingPct > 100 ? "issue" : parkingPct >= 85 ? "warning" : "done",
      icon: ParkingCircle,
      action: () => setMainPage?.("analytics"),
    },
    {
      key: "communications",
      title: "Messages",
      value: totalFixtures > 0 ? "Prepare" : "Waiting",
      state: totalFixtures > 0 ? "warning" : "todo",
      icon: MessageSquareText,
      action: () => setMainPage?.("communications"),
    },
  ];

  return (
    <Card
      eyebrow="Readiness"
      title="Publish control"
      subtitle="One clear decision point for the weekend."
      action={<StatusChip variant={status.variant}>{status.badge}</StatusChip>}
    >
      <div className={`rounded-3xl border p-5 ${status.panelClass}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${status.iconClass}`}>
              {canPublish ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Weekend status
              </div>
              <div className="mt-1 text-2xl font-black text-slate-950">{status.title}</div>
              <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-slate-600">
                {status.subtitle}
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-3xl bg-white/75 p-4 text-center ring-1 ring-slate-200">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Health
            </div>
            <div className="mt-1 text-4xl font-black text-slate-950">{pct}%</div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={!canPublish}
            onClick={() => setMainPage?.("communications")}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black shadow-sm transition ${
              canPublish
                ? "bg-slate-950 text-white hover:-translate-y-0.5 hover:bg-emerald-700"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            <Send size={18} />
            {canPublish ? "Ready to publish" : status.buttonLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              setMainPage?.("operations");
              setDayTab?.("saturday");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50"
          >
            Open review
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {domains.map((domain) => (
          <DomainRow key={domain.key} domain={domain} />
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Review queue
              </div>
              <div className="mt-1 text-lg font-black text-slate-950">
                {alerts.length} {alerts.length === 1 ? "item" : "items"} need attention
              </div>
            </div>
            <AlertTriangle className="text-amber-600" size={24} />
          </div>

          <div className="mt-3 space-y-2">
            {alerts.slice(0, 3).map((alert, index) => (
              <div
                key={`${alert.title}-${index}`}
                className="rounded-2xl border border-white bg-white px-4 py-3 text-sm font-bold text-slate-700"
              >
                {alert.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function DomainRow({ domain }) {
  const Icon = domain.icon;
  const styles = {
    done: "border-emerald-100 bg-emerald-50 text-emerald-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    issue: "border-red-100 bg-red-50 text-red-700",
    todo: "border-slate-200 bg-slate-50 text-slate-500",
  };

  return (
    <button
      type="button"
      onClick={domain.action}
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${styles[domain.state]}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80">
          <Icon size={20} strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.16em] opacity-80">
            {domain.title}
          </div>
          <div className="mt-0.5 truncate text-sm font-black text-slate-950">{domain.value}</div>
        </div>
      </div>
      <ChevronRight className="shrink-0 text-slate-400" size={18} />
    </button>
  );
}

function getStatus({ pct, alerts, refWarnings, totalFixtures }) {
  if (pct >= 95 && alerts.length === 0 && refWarnings === 0 && totalFixtures > 0) {
    return {
      key: "ready",
      title: "Ready to publish",
      subtitle: "Fixtures, resources, parking, officials and communications are clear enough for final publication.",
      badge: "Ready",
      variant: "success",
      buttonLabel: "Ready to publish",
      panelClass: "border-emerald-200 bg-emerald-50",
      iconClass: "bg-emerald-100 text-emerald-700",
    };
  }

  if (pct >= 70) {
    return {
      key: "review",
      title: "Review required",
      subtitle: "The weekend is close, but Ground Control has found a few items to check before publishing.",
      badge: "Review",
      variant: "warning",
      buttonLabel: "Not ready to publish",
      panelClass: "border-amber-200 bg-amber-50",
      iconClass: "bg-amber-100 text-amber-700",
    };
  }

  return {
    key: "action",
    title: "Action required",
    subtitle: "Build the schedule and complete the core checks before Ground Control can recommend publication.",
    badge: "Action",
    variant: "danger",
    buttonLabel: "Complete checks first",
    panelClass: "border-red-200 bg-red-50",
    iconClass: "bg-red-100 text-red-700",
  };
}
