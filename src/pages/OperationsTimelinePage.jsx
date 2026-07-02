import React, { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  RadioTower,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { buildOperationsTimeline } from "../lib/engines/timelineEngine.js";

const toneStyles = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

const dotStyles = {
  positive: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  neutral: "bg-slate-400",
};

const typeIcons = {
  fixture: CalendarDays,
  parking: Car,
  people: UsersRound,
  facility: ShieldCheck,
  site: RadioTower,
};

export default function OperationsTimelinePage({
  club,
  satFinal = [],
  sunFinal = [],
  satHasRun = false,
  sunHasRun = false,
  carCap = 0,
  refs = [],
  refWarnings = [],
  closedPitches = {},
}) {
  const timeline = useMemo(
    () =>
      buildOperationsTimeline({
        saturdayGames: satFinal,
        sundayGames: sunFinal,
        club,
        carCap,
        refs,
        refWarnings,
        closedPitches,
        satHasRun,
        sunHasRun,
      }),
    [satFinal, sunFinal, club, carCap, refs, refWarnings, closedPitches, satHasRun, sunHasRun]
  );

  const primary = club?.primary || "#10b981";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="relative p-6 sm:p-7">
          <div
            className="absolute -right-20 -top-28 h-72 w-72 rounded-full opacity-20 blur-3xl"
            style={{ background: primary }}
          />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                <RadioTower size={14} />
                Operations Timeline
              </div>

              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                Matchday command timeline
              </h2>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                A single operational view for grounds opening, arrival pressure, fixtures, pitch risk, officials and close-down.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <Metric label="Status" value={timeline.status} compact />
              <Metric label="Fixtures" value={timeline.fixtureCount} />
              <Metric label="Warnings" value={timeline.warningCount} />
              <Metric label="Critical" value={timeline.criticalCount} />
            </div>
          </div>
        </div>
      </section>

      {!timeline.hasFixtures && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Build the Saturday or Sunday schedule first. The operational timeline will fill automatically from live fixtures and matchday intelligence.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Live sequence</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                The day in the order the club needs to control it.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
              {timeline.events.length} events
            </div>
          </div>

          <div className="relative space-y-3 before:absolute before:left-[78px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
            {timeline.events.map((event) => {
              const Icon = typeIcons[event.type] || Clock3;

              return (
                <article key={event.id} className="relative grid grid-cols-[64px_28px_1fr] gap-3">
                  <div className="pt-3 text-right text-sm font-black text-slate-500">{event.time}</div>
                  <div className="relative flex justify-center pt-4">
                    <span className={`relative z-10 h-3 w-3 rounded-full ring-4 ring-white ${dotStyles[event.tone] || dotStyles.neutral}`} />
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${toneStyles[event.tone] || toneStyles.neutral}`}>
                            <Icon size={13} />
                            {event.day}
                          </span>
                          {(event.meta || []).map((item) => (
                            <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                              {item}
                            </span>
                          ))}
                        </div>

                        <h4 className="mt-3 text-base font-black text-slate-950">{event.title}</h4>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{event.description}</p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <ControlCard
            icon={CheckCircle2}
            title="Readiness"
            body={timeline.criticalCount ? "Resolve critical pressure before approving the matchday plan." : "No critical timeline events are currently blocking matchday control."}
            tone={timeline.criticalCount ? "critical" : "positive"}
          />
          <ControlCard
            icon={AlertTriangle}
            title="Watchlist"
            body={timeline.warningCount ? `${timeline.warningCount} warning event${timeline.warningCount === 1 ? "" : "s"} need monitoring.` : "No warning events currently need attention."}
            tone={timeline.warningCount ? "warning" : "positive"}
          />
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Workspace totals</h3>
            <div className="mt-4 space-y-3">
              <TotalRow label="Saturday fixtures" value={timeline.summary.saturday} />
              <TotalRow label="Sunday fixtures" value={timeline.summary.sunday} />
              <TotalRow label="Estimated cars" value={timeline.summary.parking} />
              <TotalRow label="Officials listed" value={timeline.summary.officials} />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className={`mt-1 font-black text-white ${compact ? "text-sm leading-5" : "text-2xl"}`}>{value}</div>
    </div>
  );
}

function ControlCard({ icon: Icon, title, body, tone }) {
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneStyles[tone] || toneStyles.neutral}`}>
      <div className="flex items-start gap-3">
        <Icon size={20} />
        <div>
          <h3 className="text-sm font-black">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 opacity-80">{body}</p>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-bold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}
