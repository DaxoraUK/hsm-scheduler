import React from "react";
import {
  BarChart3,
  Database,
  FileBadge2,
  Puzzle,
  Route,
  ShieldCheck,
} from "lucide-react";

export default function DashboardInsightGrid({
  totalFixtures = 0,
  pitchCount = 0,
  closedPitchCount = 0,
  scheduleBuilt = false,
  fixtureIssues = 0,
  refereeOutstanding = 0,
  parkingStats = {},
  communicationsReady = false,
}) {
  const operationalSignals = [
    totalFixtures ? `${totalFixtures} fixtures` : "Fixtures pending",
    pitchCount ? `${pitchCount} pitches` : "Pitch registry pending",
    closedPitchCount ? `${closedPitchCount} closures` : "No closures",
  ];

  const blockerCount = [
    !scheduleBuilt,
    fixtureIssues > 0,
    refereeOutstanding > 0,
    parkingStats?.overCapacity,
    !communicationsReady,
  ].filter(Boolean).length;

  const grantSignals = [
    totalFixtures ? "Participation evidence" : "Awaiting fixture data",
    pitchCount ? "Facility usage" : "Facility profile needed",
    scheduleBuilt ? "Operational output" : "Schedule not built",
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-4">
      <InsightCard
        icon={Database}
        eyebrow="Operational Dataset"
        title={scheduleBuilt ? "Live weekend data captured" : "Build the schedule to unlock data"}
        detail="Ground Control is turning matchday decisions into structured club evidence."
        footer={operationalSignals.join(" · ")}
        tone={scheduleBuilt ? "success" : "warning"}
      />

      <InsightCard
        icon={FileBadge2}
        eyebrow="Grant Intelligence"
        title="Evidence-led club reporting"
        detail="Fixture volume, facility pressure, participation and capacity data will support future funding packs."
        footer={grantSignals.join(" · ")}
        tone="success"
      />

      <InsightCard
        icon={Route}
        eyebrow="Guidance Layer"
        title={blockerCount ? `${blockerCount} actions need attention` : "No blockers detected"}
        detail="The dashboard should always tell the user what to do next, not leave them hunting through pages."
        footer={blockerCount ? "Follow the workflow to clear blockers" : "Ready for final review"}
        tone={blockerCount ? "warning" : "success"}
      />

      <InsightCard
        icon={Puzzle}
        eyebrow="Modular Platform"
        title="Ready for bolt-on products"
        detail="Pre-season planning, competitions and tournaments can plug into the same operating model."
        footer="Platform Core v1.0 foundation"
        tone="neutral"
      />
    </section>
  );
}

function InsightCard({ icon: Icon, eyebrow, title, detail, footer, tone = "neutral" }) {
  const toneClasses = {
    success: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    warning: "border-amber-200 bg-amber-50/80 text-amber-900",
    neutral: "border-slate-200 bg-white text-slate-900",
  };

  const iconClasses = {
    success: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-100 text-amber-700 ring-amber-200",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <article className={`rounded-[26px] border p-5 shadow-sm ${toneClasses[tone] || toneClasses.neutral}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">
            {eyebrow}
          </div>
          <h3 className="mt-2 text-lg font-black leading-tight tracking-tight">
            {title}
          </h3>
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconClasses[tone] || iconClasses.neutral}`}>
          <Icon size={21} strokeWidth={2.4} />
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold leading-6 opacity-75">
        {detail}
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-black opacity-80 ring-1 ring-black/5">
        {tone === "success" ? <ShieldCheck size={15} /> : <BarChart3 size={15} />}
        <span className="truncate">{footer}</span>
      </div>
    </article>
  );
}
