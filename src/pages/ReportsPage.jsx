import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Car,
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  MapPinned,
  Printer,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import PageContainer from "../components/ui/PageContainer.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import StatusChip from "../ui/StatusChip.jsx";
import ReportDocument from "../components/reports/ReportDocument.jsx";
import { buildReportsModel, reportFilename, REPORT_SCOPES, REPORT_TYPES } from "../lib/reports/reportingEngine.js";
import { buildReportCsv, downloadCsv } from "../lib/reports/csvExport.js";

const REPORT_ICONS = {
  operations: ClipboardList,
  fixtures: FileText,
  pitches: MapPinned,
  parking: Car,
  officials: ShieldCheck,
  exceptions: TriangleAlert,
  analytics: BarChart3,
};

function SelectControl({ label, value, onChange, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-black text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          {children}
        </select>
        <ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

function SummaryMetric({ label, value, detail, tone = "neutral" }) {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    neutral: "border-slate-200 bg-white text-slate-900",
  };
  return (
    <div className={`rounded-2xl border p-4 ${classes[tone] || classes.neutral}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="mt-1 text-xs font-semibold opacity-70">{detail}</div>
    </div>
  );
}

export default function ReportsPage({
  club = {},
  history = [],
  pitchCfg = [],
  teamCfg = [],
  refs = [],
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satUnresolved = [],
  sunUnresolved = [],
  midweekUnresolved = [],
  satHasRun = false,
  sunHasRun = false,
  midweekHasRun = false,
  satDate = "",
  sunDate = "",
  midweekDate = "",
  satDateLabel = "Saturday",
  sunDateLabel = "Sunday",
  midweekDateLabel = "Midweek",
  midweekEnabled = true,
}) {
  const [reportType, setReportType] = useState("operations");
  const [selectedSource, setSelectedSource] = useState("current");
  const [scope, setScope] = useState(midweekEnabled ? "matchweek" : "weekend");

  const current = useMemo(() => ({
    satFinal,
    sunFinal,
    midweekFinal,
    satUnresolved,
    sunUnresolved,
    midweekUnresolved,
    satHasRun,
    sunHasRun,
    midweekHasRun,
    satDate,
    sunDate,
    midweekDate,
    satDateLabel,
    sunDateLabel,
    midweekDateLabel,
    midweekEnabled,
  }), [
    satDate,
    satDateLabel,
    satFinal,
    satHasRun,
    satUnresolved,
    sunDate,
    sunDateLabel,
    sunFinal,
    sunHasRun,
    sunUnresolved,
    midweekDate,
    midweekDateLabel,
    midweekEnabled,
    midweekFinal,
    midweekHasRun,
    midweekUnresolved,
  ]);

  const model = useMemo(() => buildReportsModel({
    selectedSource,
    scope,
    reportType,
    history,
    club,
    pitchCfg,
    teamCfg,
    refs,
    current,
  }), [club, current, history, pitchCfg, refs, reportType, scope, selectedSource, teamCfg]);

  useEffect(() => {
    if (!model.sourceOptions.some((option) => option.value === selectedSource)) {
      setSelectedSource("current");
    }
  }, [model.sourceOptions, selectedSource]);

  useEffect(() => {
    if (!midweekEnabled && ["matchweek", "midweek"].includes(scope)) setScope("weekend");
  }, [midweekEnabled, scope]);

  const exportCsv = () => {
    const csv = buildReportCsv(model);
    const filename = reportFilename({
      clubName: club.name,
      reportType,
      sourceLabel: `${model.sourceLabel}-${scope}`,
      extension: "csv",
    });
    downloadCsv(csv, filename);
    toast.success("CSV report downloaded", { description: filename });
  };

  const printReport = () => {
    if (typeof window === "undefined") return;
    const cleanup = () => {
      delete document.body.dataset.printTarget;
      window.removeEventListener("afterprint", cleanup);
    };
    document.body.dataset.printTarget = "reports";
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1500);
  };

  const scopeOptions = midweekEnabled
    ? REPORT_SCOPES
    : REPORT_SCOPES.filter((option) => !["matchweek", "midweek"].includes(option.value));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reports v1"
        title="Operational reports"
        subtitle="Build club-scoped matchday packs, operational evidence and export-ready schedules from live or saved Ground Control data."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={!model.hasData}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} /> Export CSV
            </button>
            <button
              type="button"
              onClick={printReport}
              disabled={!model.hasData}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer size={17} /> Print / save PDF
            </button>
          </div>
        }
      />

      <section className="np rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <SelectControl label="Report data" value={selectedSource} onChange={setSelectedSource}>
            {model.sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
          <SelectControl label="Matchday scope" value={scope} onChange={setScope}>
            {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectControl>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {REPORT_TYPES.map((item) => {
            const Icon = REPORT_ICONS[item.id] || FileCheck2;
            const active = reportType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-emerald-300 bg-emerald-50 shadow-sm ring-2 ring-emerald-100"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon size={19} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-950">{item.label}</div>
                    <div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="np grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric label="Recorded" value={model.evidence.summary.total} detail="Outcome fixtures" />
        <SummaryMetric label="Unresolved" value={model.evidence.summary.unresolved} detail="Need allocation" tone={model.evidence.summary.unresolved ? "danger" : "success"} />
        <SummaryMetric label="Officials" value={`${model.evidence.summary.officialCoverage}%`} detail={`${model.evidence.summary.officialOutstanding} outstanding`} tone={model.evidence.summary.officialCoverage >= 90 ? "success" : "warning"} />
        <SummaryMetric label="Parking peak" value={model.evidence.summary.peakParking} detail={`${model.evidence.summary.parkingOverCapacity} pressure days`} tone={model.evidence.summary.parkingOverCapacity ? "danger" : "success"} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Report readiness</div>
          <div className="mt-3"><StatusChip status={model.readiness.status}>{model.readiness.label}</StatusChip></div>
          <div className="mt-2 text-xs font-semibold text-slate-500">{model.readiness.detail}</div>
        </div>
      </section>

      {!model.hasData ? (
        <EmptyState
          icon={FileText}
          title="No report data for this selection"
          description={model.sourceKind === "current" ? "Build a current schedule or select a saved matchday from Report data." : "This saved matchday does not contain fixtures in the selected scope."}
        />
      ) : (
        <ReportDocument model={model} club={club} />
      )}
    </PageContainer>
  );
}
