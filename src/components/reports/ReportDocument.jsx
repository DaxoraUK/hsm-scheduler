import React from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Car,
  Clock3,
  Database,
  FileCheck2,
  Info,
  MapPinned,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";
import ReportWeatherSummary from "./ReportWeatherSummary.jsx";

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:break-inside-avoid print:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
          {detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 print:hidden">
          <Icon size={19} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function Table({ columns, rows, empty = "No records for this selection." }) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 print:overflow-visible print:rounded-none">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-950 text-white print:bg-slate-100 print:text-slate-950">
            {columns.map((column) => (
              <th key={column.key} className="whitespace-nowrap px-3 py-3 text-[9px] font-black uppercase tracking-[0.14em]">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || `${index}`} className="border-t border-slate-200 even:bg-slate-50 print:break-inside-avoid">
              {columns.map((column) => (
                <td key={column.key} className={`px-3 py-3 align-top font-semibold text-slate-700 ${column.className || ""}`}>
                  {typeof column.render === "function" ? column.render(row) : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fixtureColumns = [
  { key: "koTime", label: "KO", className: "font-black text-slate-950" },
  { key: "homeTeam", label: "Home team", className: "font-black text-slate-950" },
  { key: "awayTeam", label: "Opposition" },
  { key: "pitchLabel", label: "Pitch" },
  { key: "format", label: "Format" },
  { key: "statusLabel", label: "Status" },
  { key: "referee", label: "Official", render: (row) => row.referee || "TBC" },
];

function DaySection({ day, club, current, parking }) {
  const fixtures = day.rows || [];
  const active = fixtures.filter((row) => row.status === "delivered");
  const exceptions = fixtures.filter((row) => row.status !== "delivered");
  const assessed = Boolean(day.hasRun);
  return (
    <section className="report-section break-inside-avoid-page rounded-[24px] border border-slate-200 bg-white p-5 print:rounded-none print:border-slate-300 print:p-0 print:pt-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">{day.label}</div>
          <h3 className="mt-1 text-xl font-black text-slate-950">{day.dateLabel}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={day.hasRun ? "success" : "warning"}>{day.hasRun ? "Schedule built" : "Not built"}</StatusChip>
          <StatusChip status={!assessed ? "neutral" : exceptions.length ? "warning" : "success"}>{!assessed ? "Not assessed" : exceptions.length ? `${exceptions.length} exceptions` : "No exceptions"}</StatusChip>
        </div>
      </div>

      <Table columns={fixtureColumns} rows={active} empty={day.hasRun ? "No active fixtures recorded for this day." : "The schedule has not been built for this day."} />

      {exceptions.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 print:break-inside-avoid">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Exceptions</div>
          <div className="mt-2 space-y-1 text-xs font-bold text-amber-950">
            {exceptions.map((row) => <div key={`${row.id}:${row.status}`}>{row.statusLabel}: {row.fixtureLabel}</div>)}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.55fr] print:grid-cols-2">
        <ReportWeatherSummary club={club} day={day} current={current} />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:bg-white">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Parking forecast</div>
          <div className="mt-3 text-2xl font-black text-slate-950">
            {!assessed ? "—" : parking?.enabled === false ? "Off" : parking?.configured ? `${parking.peakCars}/${parking.capacity}` : "Configure"}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {!assessed
              ? "Build the schedule before parking demand is assessed."
              : parking?.enabled === false
              ? "Parking excluded from operational readiness."
              : parking?.configured
                ? `${parking.utilisation}% peak at ${parking.peakTime}`
                : "Set venue capacity before relying on parking readiness."}
          </div>
          <div className="mt-3"><StatusChip status={!assessed ? "neutral" : parking?.status?.variant || "neutral"}>{!assessed ? "Not assessed" : parking?.status?.label || "No data"}</StatusChip></div>
        </div>
      </div>
    </section>
  );
}

function OperationsPack({ model, club }) {
  const parkingByDay = new Map(model.parkingRows.map((row) => [row.day, row]));
  const days = model.selectedDays.map((day) => {
    const evidenceDay = model.evidence.weekly[0]?.days.find((item) => item.key === day.key);
    return evidenceDay || { ...day, rows: [] };
  });
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <SummaryCard icon={CalendarDays} label="Recorded fixtures" value={model.evidence.summary.total} detail={`${model.evidence.summary.delivered} scheduled to proceed`} />
        <SummaryCard icon={MapPinned} label="Unresolved" value={model.evidence.summary.unresolved} detail="Without validated allocation" />
        <SummaryCard icon={ShieldCheck} label="Officials coverage" value={`${model.evidence.summary.officialCoverage}%`} detail={`${model.evidence.summary.officialOutstanding} outstanding`} />
        <SummaryCard icon={Car} label="Peak parking" value={model.evidence.summary.peakParking} detail={`${model.evidence.summary.parkingOverCapacity} pressure matchdays`} />
      </div>
      {days.map((day) => <DaySection key={day.key} day={day} club={club} current={model.sourceKind === "current"} parking={parkingByDay.get(day.key)} />)}
      {model.exceptions.length ? (
        <section className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 print:break-before-page print:bg-white">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-700" />
            <h3 className="text-lg font-black text-amber-950">Operational action list</h3>
          </div>
          <div className="mt-4"><ExceptionsTable rows={model.exceptions} /></div>
        </section>
      ) : null}
    </div>
  );
}

function FixtureReport({ model }) {
  return <Table columns={[{ key: "dayLabel", label: "Day" }, { key: "dateLabel", label: "Date" }, ...fixtureColumns]} rows={model.fixtures} />;
}

function PitchReport({ model }) {
  return <Table columns={[
    { key: "label", label: "Pitch", className: "font-black text-slate-950" },
    { key: "total", label: "Fixtures" },
    { key: "delivered", label: "Scheduled" },
    { key: "postponed", label: "Postponed" },
    { key: "cancelled", label: "Cancelled" },
    { key: "unresolved", label: "Unresolved" },
    { key: "facilityHours", label: "Hours" },
    { key: "share", label: "Share", render: (row) => `${row.share}%` },
    { key: "postponementRate", label: "Postponed", render: (row) => `${row.postponementRate}%` },
  ]} rows={model.pitchRows} />;
}

function ParkingReport({ model }) {
  return <Table columns={[
    { key: "dayLabel", label: "Day", className: "font-black text-slate-950" },
    { key: "dateLabel", label: "Date" },
    { key: "capacity", label: "Capacity", render: (row) => row.enabled === false ? "Off" : row.configured ? row.capacity : "Not configured" },
    { key: "peakCars", label: "Peak demand", render: (row) => row.assessed ? row.peakCars : "—" },
    { key: "utilisation", label: "Peak use", render: (row) => row.assessed && row.configured ? `${row.utilisation}%` : "—" },
    { key: "peakTime", label: "Peak time", render: (row) => row.assessed ? row.peakTime : "—" },
    { key: "fixtureCount", label: "Impact fixtures", render: (row) => row.assessed ? row.fixtureCount : "—" },
    { key: "status", label: "Status", render: (row) => <StatusChip status={row.status?.variant || "neutral"}>{row.status?.label || "No data"}</StatusChip> },
  ]} rows={model.parkingRows} />;
}

function OfficialsReport({ model }) {
  return <Table columns={[
    { key: "dayLabel", label: "Day" },
    { key: "dateLabel", label: "Date" },
    { key: "koTime", label: "KO" },
    { key: "fixtureLabel", label: "Fixture", className: "font-black text-slate-950" },
    { key: "pitchLabel", label: "Pitch" },
    { key: "referee", label: "Official", render: (row) => row.referee || "TBC" },
    { key: "contact", label: "Contact", render: (row) => row.contact || "—" },
    { key: "officialStatus", label: "Status", render: (row) => <StatusChip status={row.officialConfirmed ? "success" : "warning"}>{row.officialConfirmed ? "Confirmed" : "Outstanding"}</StatusChip> },
  ]} rows={model.officialRows} />;
}

function ExceptionsTable({ rows }) {
  return <Table columns={[
    { key: "typeLabel", label: "Issue", render: (row) => <StatusChip status={row.severity}>{row.typeLabel}</StatusChip> },
    { key: "dayLabel", label: "Day" },
    { key: "dateLabel", label: "Date" },
    { key: "koTime", label: "KO" },
    { key: "fixture", label: "Fixture", className: "font-black text-slate-950" },
    { key: "pitch", label: "Pitch" },
    { key: "detail", label: "Action detail" },
  ]} rows={rows} empty="No operational exceptions are recorded for this selection." />;
}


function frameworkStatus(item) {
  if (item.status === "available") return { tone: "success", label: "Available" };
  if (item.status === "partial") return { tone: "warning", label: "Partial" };
  if (item.status === "manual") return { tone: "info", label: "Manual" };
  return { tone: "danger", label: "Missing" };
}

function FundingEvidenceReport({ model }) {
  const quality = model.quality;
  const framework = model.grantFramework;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <SummaryCard icon={FileCheck2} label="Evidence confidence" value={`${quality.score}%`} detail={quality.label} />
        <SummaryCard icon={CalendarDays} label="Selected matchdays" value={quality.matchdays} detail={quality.period.label} />
        <SummaryCard icon={Database} label="Source records" value={quality.fixtures} detail="Fixture-level appendix included" />
        <SummaryCard icon={Trophy} label="Framework coverage" value={`${framework.counts.available} available`} detail={`${framework.counts.partial} partial · ${framework.counts.manual} manual`} />
      </div>

      <section className="rounded-2xl border border-slate-200 p-5 print:break-inside-avoid">
        <div className="flex items-center gap-3"><Info size={19} className="text-sky-700" /><h3 className="font-black text-slate-950">Methodology and limitations</h3></div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{quality.methodology}</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{framework.disclaimer}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
          {quality.provenance.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4 print:bg-white print:ring-1 print:ring-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-slate-900">{item.label}</div>
                <StatusChip status={item.status === "available" ? "success" : item.status === "partial" ? "warning" : item.status === "required" ? "info" : "danger"}>{item.status}</StatusChip>
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="print:break-before-page">
        <div className="mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Evidence framework</div>
          <h3 className="mt-1 text-xl font-black text-slate-950">Requirement coverage and next actions</h3>
        </div>
        <Table
          columns={[
            { key: "category", label: "Category" },
            { key: "title", label: "Requirement", className: "font-black text-slate-950" },
            { key: "status", label: "Status", render: (row) => { const status = frameworkStatus(row); return <StatusChip status={status.tone}>{status.label}</StatusChip>; } },
            { key: "source", label: "Source" },
            { key: "evidence", label: "Current evidence" },
            { key: "nextAction", label: "Next action" },
          ]}
          rows={framework.requirements}
        />
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 print:break-inside-avoid print:bg-white">
        <div className="flex items-center gap-3"><AlertTriangle size={19} className="text-amber-700" /><h3 className="font-black text-amber-950">Priority evidence gaps</h3></div>
        <div className="mt-4 space-y-3">
          {quality.gaps.slice(0, 6).map((gap) => (
            <div key={gap.id} className="rounded-xl bg-white p-3 ring-1 ring-amber-200">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-slate-900">{gap.label}</span><span className="text-sm font-black text-amber-800">{gap.value}%</span></div>
              <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{gap.action}</div>
            </div>
          ))}
          {!quality.gaps.length ? <div className="text-sm font-semibold text-emerald-800">No material operational evidence gaps are recorded for this selection.</div> : null}
        </div>
      </section>

      <section className="print:break-before-page">
        <div className="mb-4">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Source appendix</div>
          <h3 className="mt-1 text-xl font-black text-slate-950">Fixture records supporting this draft</h3>
        </div>
        <FixtureReport model={model} />
      </section>
    </div>
  );
}

function AnalyticsSnapshot({ model }) {
  const summary = model.evidence.summary;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
        <SummaryCard icon={Trophy} label="Schedule completion" value={`${summary.scheduleCompletionRate ?? summary.deliveryRate}%`} detail={`${summary.scheduled ?? summary.delivered}/${summary.total} remained scheduled`} />
        <SummaryCard icon={Clock3} label="Fixture hours" value={summary.facilityHours} detail="Scheduled playing time" />
        <SummaryCard icon={ShieldCheck} label="Officials coverage" value={`${summary.officialCoverage}%`} detail={`${summary.officialConfirmed} confirmed`} />
        <SummaryCard icon={Car} label="Peak parking" value={summary.peakParking} detail={summary.peakParkingLabel} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 p-5 print:break-inside-avoid">
          <div className="flex items-center gap-3"><MapPinned size={19} className="text-emerald-700" /><h3 className="font-black text-slate-950">Pitch load</h3></div>
          <div className="mt-4"><PitchReport model={model} /></div>
        </section>
        <section className="rounded-2xl border border-slate-200 p-5 print:break-inside-avoid">
          <div className="flex items-center gap-3"><BarChart3 size={19} className="text-emerald-700" /><h3 className="font-black text-slate-950">Team scheduling</h3></div>
          <div className="mt-4"><Table columns={[
            { key: "label", label: "Team", className: "font-black text-slate-950" },
            { key: "total", label: "Fixtures" },
            { key: "scheduleCompletionRate", label: "Remained scheduled", render: (row) => `${row.scheduleCompletionRate ?? row.deliveryRate}%` },
            { key: "postponed", label: "Postponed" },
            { key: "officialCoverage", label: "Officials", render: (row) => `${row.officialCoverage}%` },
          ]} rows={model.teamRows} /></div>
        </section>
      </div>
    </div>
  );
}

export default function ReportDocument({ model, club }) {
  const venue = club?.venue || club?.sites?.find((site) => site.isPrimary)?.venue || club?.sites?.[0]?.name || "Primary venue";
  const content =
    model.reportType === "operations" ? <OperationsPack model={model} club={club} /> :
    model.reportType === "fixtures" ? <FixtureReport model={model} /> :
    model.reportType === "pitches" ? <PitchReport model={model} /> :
    model.reportType === "parking" ? <ParkingReport model={model} /> :
    model.reportType === "officials" ? <OfficialsReport model={model} /> :
    model.reportType === "exceptions" ? <ExceptionsTable rows={model.exceptions} /> :
    model.reportType === "funding" ? <FundingEvidenceReport model={model} /> :
    <AnalyticsSnapshot model={model} />;

  return (
    <article id="ground-control-report-print" className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="mb-6 border-b-4 border-emerald-800 pb-5 print:break-inside-avoid">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.26em] text-emerald-700">Daxora Ground Control</div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{model.reportTitle}</h2>
            <div className="mt-2 text-sm font-bold text-slate-500">{model.sourceLabel} · {model.scope === "matchweek" ? "Matchweek" : model.scope.charAt(0).toUpperCase() + model.scope.slice(1)}</div>
          </div>
          <div className="text-left text-xs font-semibold leading-5 text-slate-500 sm:text-right">
            <div className="text-base font-black text-slate-950">{club?.name || "Ground Control Club"}</div>
            <div>{venue}</div>
            <div>Generated {model.generatedAt.toLocaleString("en-GB")}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StatusChip status={model.readiness.status}>{model.readiness.label}</StatusChip>
          <span className="text-xs font-bold text-slate-500">Readiness {model.readiness.score}% · {model.readiness.detail}</span>
          <StatusChip status={model.quality.tone}>{model.quality.label}</StatusChip>
          <span className="text-xs font-bold text-slate-500">Evidence confidence {model.quality.score}% · {model.quality.period.label}</span>
        </div>
      </header>

      {content}

      <footer className="mt-8 border-t border-slate-200 pt-4 text-[10px] font-semibold text-slate-400 print:break-inside-avoid">
        Generated from club-scoped Ground Control operational data. Calculated and inferred measures are labelled in the funding evidence draft. Historical weather is shown only where it was captured; current forecasts are not substituted for past conditions. This report does not confirm funding eligibility.
      </footer>
    </article>
  );
}
