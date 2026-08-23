import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Car,
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck2,
  FileText,
  Gauge,
  MapPinned,
  MessageCircle,
  Printer,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { toast } from "../lib/notifications/daxoraNotifications.js";
import PageContainer from "../ui/PageContainer.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import StatusChip from "../ui/StatusChip.jsx";
import ReportDocument from "../components/reports/ReportDocument.jsx";
import UnifiedFacilityReportDocument from "../components/reports/UnifiedFacilityReportDocument.jsx";
import PlanFeatureNotice from "../components/PlanFeatureNotice.jsx";
import { buildReportsModel, reportFilename, REPORT_SCOPES, REPORT_TYPES } from "../lib/reports/reportingEngine.js";
import { buildReportCsv, downloadCsv } from "../lib/reports/csvExport.js";
import { buildUnifiedFacilityAnalyticsModel, buildUnifiedFacilityCsv } from "../lib/analytics/unifiedFacilityAnalyticsEngine.js";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import { ENTITLEMENTS, hasEntitlement } from "../lib/subscriptions/entitlements.js";
import { buildFundingEvidencePack, downloadFundingApplicationPack, downloadFundingEvidencePack } from "../lib/grants/fundingEvidencePack.js";
import { loadFundingImpactEvidence } from "../lib/grants/fundingImpactEvidenceService.js";
import { loadFundingWorkspace } from "../lib/grants/fundingWorkspaceService.js";
import { buildFundingPackApprovalKey, buildFundingPackSnapshot } from "../lib/elite/eliteApprovalSnapshots.js";
import {
  ELITE_APPROVAL_TYPES,
  authoriseEliteGovernedExport,
  createEliteApprovalRequest,
  loadEliteApprovalState,
} from "../lib/elite/eliteGovernanceService.js";

const ADVANCED_REPORT_IDS = new Set(["analytics", "funding"]);

const REPORT_ICONS = {
  facilities: Gauge,
  operations: ClipboardList,
  fixtures: FileText,
  pitches: MapPinned,
  parking: Car,
  officials: ShieldCheck,
  exceptions: TriangleAlert,
  analytics: BarChart3,
  funding: FileCheck2,
};

export function buildWhatsAppFixtureSchedule(model = {}, club = {}) {
  const fixtures = Array.isArray(model.fixtures) ? model.fixtures : [];
  const heading = `*${club.name || "Club"} fixture allocations*`;
  const scope = [model.sourceLabel, model.scope === "matchweek" ? "Matchweek" : model.scope].filter(Boolean).join(" · ");
  const grouped = fixtures.reduce((map, fixture) => {
    const key = fixture.dateLabel || fixture.dayLabel || "Fixtures";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(fixture);
    return map;
  }, new Map());
  const sections = [...grouped.entries()].map(([label, rows]) => [
    `*${label}*`,
    ...rows.map((fixture) => {
      const status = ["postponed", "cancelled"].includes(fixture.status) ? ` · ${fixture.statusLabel}` : "";
      return `${fixture.koTime || "TBC"} · ${fixture.homeTeam} v ${fixture.awayTeam}\n${fixture.pitchLabel || "Pitch TBC"} · ${fixture.format || "Format TBC"} · Ref: ${fixture.referee || "TBC"}${status}`;
    }),
  ].join("\n\n"));
  return [heading, scope, ...sections, "Please check your allocation and contact the club promptly if anything looks incorrect."].filter(Boolean).join("\n\n");
}

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
  activeClubId,
  subscription,
  advancedReportsEnabled: authoritativeAdvancedReportsEnabled,
  onOpenSubscription,
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
  navigationTarget = null,
  clearNavigationTarget,
}) {
  const year = new Date().getFullYear();
  const [reportType, setReportType] = useState("facilities");
  const [facilityStartDate, setFacilityStartDate] = useState(`${year}-01-01`);
  const [facilityEndDate, setFacilityEndDate] = useState(`${year}-12-31`);
  const [plannerData, setPlannerData] = useState({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [], scheduling_policies: [] });
  const [plannerStatus, setPlannerStatus] = useState("idle");
  const [selectedSource, setSelectedSource] = useState("current");
  const [scope, setScope] = useState(midweekEnabled ? "matchweek" : "weekend");
  const [pendingAutoPrint, setPendingAutoPrint] = useState(false);
  const [impactEvidence, setImpactEvidence] = useState([]);
  const [fundingWorkspace, setFundingWorkspace] = useState({ projects: [], applications: [], applicationTasks: [], monitoringObligations: [] });
  const [fundingProjectId, setFundingProjectId] = useState("");
  const [fundingExporting, setFundingExporting] = useState(false);
  const advancedReportsEnabled = authoritativeAdvancedReportsEnabled
    ?? hasEntitlement(subscription, ENTITLEMENTS.REPORTS_ADVANCED);
  const dataExportEnabled = hasEntitlement(subscription, ENTITLEMENTS.DATA_EXPORT);
  const availableReportTypes = useMemo(
    () => REPORT_TYPES.filter((item) => advancedReportsEnabled || !ADVANCED_REPORT_IDS.has(item.id)),
    [advancedReportsEnabled]
  );

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

  const facilityModel = useMemo(() => buildUnifiedFacilityAnalyticsModel({
    history,
    plannerData,
    club,
    pitchCfg,
    teamCfg,
    filters: { startDate: facilityStartDate, endDate: facilityEndDate },
  }), [club, facilityEndDate, facilityStartDate, history, pitchCfg, plannerData, teamCfg]);

  const activeReportHasData = reportType === "facilities" ? facilityModel.hasData : model.hasData;

  useEffect(() => {
    let active = true;
    const clubId = activeClubId || club.id || club.organisationId;
    if (!clubId || !isSupaConfigured()) {
      setPlannerData({ bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [], scheduling_policies: [] });
      setPlannerStatus("ready");
      return () => { active = false; };
    }
    setPlannerStatus("loading");
    DB.getAnnualPlannerAnalyticsData(clubId, { startDate: facilityStartDate, endDate: facilityEndDate })
      .then((payload) => { if (active) { setPlannerData(payload || {}); setPlannerStatus("ready"); } })
      .catch((error) => { if (active) { setPlannerStatus("error"); toast.error("Facility report data could not be loaded", { description: error?.message }); } });
    return () => { active = false; };
  }, [activeClubId, club.id, club.organisationId, facilityEndDate, facilityStartDate]);

  useEffect(() => {
    let cancelled = false;
    const resolvedClubId = club.id || club.organisationId || String(club.name || "local-club").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    Promise.all([
      loadFundingImpactEvidence(resolvedClubId).catch(() => ({ records: [] })),
      loadFundingWorkspace(resolvedClubId).catch(() => ({ projects: [] })),
    ]).then(([impactResult, workspaceResult]) => {
      if (cancelled) return;
      setImpactEvidence(impactResult.records || []);
      setFundingWorkspace(workspaceResult || { projects: [], applications: [], applicationTasks: [], monitoringObligations: [] });
      setFundingProjectId((current) => current || workspaceResult.projects?.[0]?.id || "");
    });
    return () => { cancelled = true; };
  }, [club.id, club.name, club.organisationId]);

  useEffect(() => {
    if (!model.sourceOptions.some((option) => option.value === selectedSource)) {
      setSelectedSource("current");
    }
  }, [model.sourceOptions, selectedSource]);

  useEffect(() => {
    if (!availableReportTypes.some((item) => item.id === reportType)) {
      setReportType("facilities");
    }
  }, [availableReportTypes, reportType]);

  useEffect(() => {
    if (!midweekEnabled && ["matchweek", "midweek"].includes(scope)) setScope("weekend");
  }, [midweekEnabled, scope]);

  const fundingProjects = fundingWorkspace.projects || [];
  const selectedFundingProject = fundingProjects.find((project) => project.id === fundingProjectId) || null;
  const selectedImpactEvidence = fundingProjectId
    ? impactEvidence.filter((record) => record.projectId === fundingProjectId)
    : [];
  const buildSelectedFundingPack = () => buildFundingEvidencePack({
    club,
    model,
    project: selectedFundingProject,
    impactEvidence: selectedImpactEvidence,
    source: "reports",
  });

  const exportCsv = () => {
    if (!dataExportEnabled) {
      toast.error("CSV export is not included in this plan");
      return;
    }
    const facilitiesReport = reportType === "facilities";
    const csv = facilitiesReport ? buildUnifiedFacilityCsv(facilityModel) : buildReportCsv(model);
    const filename = reportFilename({
      clubName: club.name,
      reportType,
      sourceLabel: facilitiesReport ? `${facilityStartDate}-${facilityEndDate}` : `${model.sourceLabel}-${scope}`,
      extension: "csv",
    });
    downloadCsv(csv, filename);
    toast.success("CSV report downloaded", { description: filename });
  };

  const exportFundingEvidence = () => {
    if (!advancedReportsEnabled || reportType !== "funding") return;
    const pack = buildSelectedFundingPack();
    downloadFundingEvidencePack(pack);
    toast.success("Funding evidence draft downloaded", { description: "Review every claim and re-check official programme guidance before submission." });
  };

  const exportFundingApplication = async () => {
    if (!advancedReportsEnabled || reportType !== "funding" || fundingExporting) return;
    if (!selectedFundingProject) {
      toast.error("Select a funding project", { description: "Application-ready packs must be tied to a saved funding project." });
      return;
    }
    const pack = buildSelectedFundingPack();
    const eliteFundingGovernance = hasEntitlement(subscription, ENTITLEMENTS.FUNDING_PORTFOLIO);
    if (!eliteFundingGovernance) {
      downloadFundingApplicationPack(pack);
      toast.success("Application evidence pack downloaded", { description: "Open the HTML file to review, print or save it as PDF." });
      return;
    }

    setFundingExporting(true);
    try {
      const clubId = club.id || club.organisationId || String(club.name || "local-club").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const snapshot = buildFundingPackSnapshot({
        project: selectedFundingProject,
        applications: fundingWorkspace.applications,
        tasks: fundingWorkspace.applicationTasks,
        obligations: fundingWorkspace.monitoringObligations,
        impactEvidence: selectedImpactEvidence,
        pack,
      });
      const entityKey = buildFundingPackApprovalKey(snapshot);
      const approvalState = await loadEliteApprovalState(clubId, ELITE_APPROVAL_TYPES.FUNDING_PACK, entityKey);
      if (approvalState.policy.fundingPackApprovalRequired && !approvalState.approved) {
        if (!approvalState.pending) {
          await createEliteApprovalRequest(clubId, {
            approvalType: ELITE_APPROVAL_TYPES.FUNDING_PACK,
            entityKey,
            title: `${selectedFundingProject.title || "Funding project"} application pack`,
            summary: "Exact project, application, task, obligation and impact-evidence snapshot prepared for release.",
            snapshot,
          });
        }
        toast.info("Funding pack approval required", {
          description: approvalState.pending
            ? "This exact pack is already waiting for a reviewer in Organisation Command."
            : "A request has been created in Organisation Command. Approve this exact snapshot before downloading it.",
        });
        return;
      }
      await authoriseEliteGovernedExport(clubId, {
        approvalType: ELITE_APPROVAL_TYPES.FUNDING_PACK,
        entityKey,
        format: "html",
        snapshot,
      });
      downloadFundingApplicationPack(pack);
      toast.success("Governed application evidence pack downloaded", { description: "The release was recorded in the Elite audit trail." });
    } catch (error) {
      toast.error("Funding pack export was blocked", { description: error?.message });
    } finally {
      setFundingExporting(false);
    }
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

  const shareFixturesToWhatsApp = () => {
    if (reportType !== "fixtures" || !model.fixtures?.length) return;
    const message = buildWhatsAppFixtureSchedule(model, club);
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!navigationTarget || navigationTarget.target !== "reports") return;

    const nextType = availableReportTypes.some((item) => item.id === navigationTarget.reportType)
      ? navigationTarget.reportType
      : "fixtures";
    const allowedScopes = REPORT_SCOPES.map((item) => item.value);
    const requestedScope = allowedScopes.includes(navigationTarget.scope)
      ? navigationTarget.scope
      : midweekEnabled ? "matchweek" : "weekend";
    const nextScope = !midweekEnabled && ["matchweek", "midweek"].includes(requestedScope)
      ? "weekend"
      : requestedScope;

    setSelectedSource(navigationTarget.source || "current");
    setReportType(nextType);
    setScope(nextScope);
    setPendingAutoPrint(Boolean(navigationTarget.autoPrint));
    clearNavigationTarget?.();
  }, [availableReportTypes, clearNavigationTarget, midweekEnabled, navigationTarget]);

  useEffect(() => {
    if (!pendingAutoPrint || !activeReportHasData) return undefined;
    const timer = window.setTimeout(() => {
      printReport();
      setPendingAutoPrint(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeReportHasData, pendingAutoPrint]);

  const scopeOptions = midweekEnabled
    ? REPORT_SCOPES
    : REPORT_SCOPES.filter((option) => !["matchweek", "midweek"].includes(option.value));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reports and evidence"
        title="Create traceable operational reports"
        subtitle="Combine fixtures, training, friendlies, winter provision and downtime into traceable facility, operational and funding reports."
        action={
          <div className={reportType === "fixtures" ? "grid w-full gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
            {reportType === "fixtures" ? (
              <button
                type="button"
                onClick={shareFixturesToWhatsApp}
                disabled={!model.hasData}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle size={17} /> Share to club WhatsApp
              </button>
            ) : null}
            {reportType === "funding" && advancedReportsEnabled ? (
              <>
                <button
                  type="button"
                  onClick={exportFundingApplication}
                  disabled={fundingExporting || !model.hasData || !selectedFundingProject}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileCheck2 size={17} /> {fundingExporting ? "Authorising…" : "Application pack"}
                </button>
                <button
                  type="button"
                  onClick={exportFundingEvidence}
                  disabled={!model.hasData}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={17} /> Data draft
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              disabled={!activeReportHasData || !dataExportEnabled}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ${reportType === "fixtures" ? "w-full" : ""}`}
            >
              <Download size={17} /> {dataExportEnabled ? "Export CSV" : "CSV locked"}
            </button>
            <button
              type="button"
              onClick={printReport}
              disabled={!activeReportHasData}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${reportType === "fixtures" ? "w-full" : ""}`}
            >
              <Printer size={17} /> Print / save PDF
            </button>
          </div>
        }
      />

      {!advancedReportsEnabled ? (
        <PlanFeatureNotice
          entitlement={ENTITLEMENTS.REPORTS_ADVANCED}
          subscription={subscription}
          title="Advanced evidence reports are available on Pro"
          description="Core includes unified facility usage, operations, fixture, pitch, parking, officials and exception reports. Executive analytics snapshots and funding evidence drafts are available from Pro."
          onOpenSubscription={onOpenSubscription}
          compact
        />
      ) : null}

      <section className="np rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        {reportType === "facilities" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block min-w-0"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">From</span><input type="date" value={facilityStartDate} onChange={(event) => setFacilityStartDate(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></label>
            <label className="block min-w-0"><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">To</span><input type="date" value={facilityEndDate} onChange={(event) => setFacilityEndDate(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></label>
          </div>
        ) : (
          <div className={`grid gap-4 ${reportType === "funding" ? "lg:grid-cols-3" : "lg:grid-cols-[1.2fr_0.8fr]"}`}>
            <SelectControl label="Report data" value={selectedSource} onChange={setSelectedSource}>
              {model.sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectControl>
            <SelectControl label="Matchday scope" value={scope} onChange={setScope}>
              {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectControl>
            {reportType === "funding" ? (
              <SelectControl label="Funding project" value={fundingProjectId} onChange={setFundingProjectId}>
                <option value="">Select a saved funding project</option>
                {fundingProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
              </SelectControl>
            ) : null}
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Report types">
          {availableReportTypes.map((item) => {
            const Icon = REPORT_ICONS[item.id] || FileCheck2;
            const active = reportType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                role="tab"
                aria-selected={active}
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

      {reportType === "facilities" ? (
        <>
          <section className="np grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryMetric label="Total use" value={`${facilityModel.metrics.utilisationPct}%`} detail={`${facilityModel.metrics.facilityHours}h pitch-equivalent`} tone={facilityModel.metrics.utilisationPct >= 85 ? "danger" : facilityModel.metrics.utilisationPct >= 65 ? "warning" : "success"} />
            <SummaryMetric label="Team-hours" value={`${facilityModel.metrics.teamHours}h`} detail={`${facilityModel.metrics.records} combined records`} />
            <SummaryMetric label="Delivered" value={`${facilityModel.metrics.deliveredHours}h`} detail={`${facilityModel.metrics.scheduledHours}h scheduled`} tone="success" />
            <SummaryMetric label="Downtime" value={`${facilityModel.metrics.closureHours}h`} detail="Weather, closure and maintenance" tone={facilityModel.metrics.closureHours ? "danger" : "success"} />
            <SummaryMetric label="Unused" value={`${facilityModel.metrics.unusedHours}h`} detail="Configured usable capacity" tone={facilityModel.metrics.unusedHours ? "warning" : "success"} />
            <SummaryMetric label="Waiting demand" value={facilityModel.metrics.waitingTeams} detail={`${facilityModel.metrics.teams} teams · £${Number(facilityModel.metrics.totalCost || 0).toFixed(2)} cost`} tone={facilityModel.metrics.waitingTeams ? "warning" : "success"} />
          </section>
          {plannerStatus === "loading" ? <div className="h-64 animate-pulse rounded-[28px] bg-slate-200" /> : plannerStatus === "error" ? <EmptyState icon={TriangleAlert} title="Facility report data could not be loaded" description="Matchday evidence remains available, but Annual Planner bookings could not be combined for this report." /> : !facilityModel.hasData ? <EmptyState icon={MapPinned} title="No combined facility data for this period" description="Record fixtures or Annual Planner bookings, or widen the report date range." /> : <UnifiedFacilityReportDocument model={facilityModel} club={club} />}
        </>
      ) : (
        <>
          <section className="np grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryMetric label="Recorded" value={model.evidence.summary.total} detail="Outcome fixtures" />
            <SummaryMetric label="Unresolved" value={model.evidence.summary.unresolved} detail="Need allocation" tone={model.evidence.summary.unresolved ? "danger" : "success"} />
            <SummaryMetric label="Officials" value={`${model.evidence.summary.officialCoverage}%`} detail={`${model.evidence.summary.officialOutstanding} outstanding`} tone={model.evidence.summary.officialCoverage >= 90 ? "success" : "warning"} />
            <SummaryMetric label="Parking peak" value={model.evidence.summary.peakParking} detail={`${model.evidence.summary.parkingOverCapacity} pressure days`} tone={model.evidence.summary.parkingOverCapacity ? "danger" : "success"} />
            <SummaryMetric label="Evidence confidence" value={`${model.quality.score}%`} detail={model.quality.label} tone={model.quality.tone} />
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Report readiness</div>
              <div className="mt-3"><StatusChip status={model.readiness.status}>{model.readiness.label}</StatusChip></div>
              <div className="mt-2 text-xs font-semibold text-slate-500">{model.readiness.detail}</div>
            </div>
          </section>

          {model.hasData ? (
            <section className="np rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
              <strong>Evidence basis:</strong> {model.quality.period.label} · {model.quality.fixtures} fixture record{model.quality.fixtures === 1 ? "" : "s"}. {model.quality.methodology}
            </section>
          ) : null}

          {!model.hasData ? (
            <EmptyState
              icon={FileText}
              title="No report data for this selection"
              description={model.sourceKind === "current" ? "Build a current schedule or select a saved matchday from Report data." : "This saved matchday does not contain fixtures in the selected scope."}
            />
          ) : (
            <ReportDocument model={model} club={club} />
          )}
        </>
      )}
    </PageContainer>
  );
}
