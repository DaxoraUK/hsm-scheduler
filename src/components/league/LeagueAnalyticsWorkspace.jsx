import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  Archive,
  Clock3,
  FileBarChart,
  FileSpreadsheet,
  Gauge,
  ListPlus,
  Mail,
  Printer,
  Landmark,
  LineChart,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { usePersistedWorkspaceState } from "../../hooks/usePersistedWorkspaceState.js";
import { useDaxoraConfirm } from "../../contexts/DaxoraInteractionContext.jsx";
import { normaliseLeagueClubOperationsData } from "../../lib/league/leagueClubOperations.js";
import { normaliseLeagueResultsData } from "../../lib/league/leagueResultsEngine.js";
import { normaliseLeagueDisciplineData } from "../../lib/league/leagueDisciplineEngine.js";
import { normaliseLeagueRegistrationData } from "../../lib/league/leagueRegistrationEngine.js";
import {
  buildLeagueAnalyticsModel,
  buildLeagueSnapshotTrend,
  leagueAnalyticsSnapshotPayload,
  leagueAnalyticsModelFromSnapshot,
  leagueAnalyticsSnapshotAgeHours,
  leagueAnalyticsToCsv,
  leagueAnalyticsToExcelXml,
  leagueAnalyticsToHtml,
  leagueBoardPackHtml,
  normaliseLeagueReportConfiguration,
} from "../../lib/league/leagueAnalyticsEngine.js";
import { getCurrentLeagueSeason } from "../../lib/league/leagueManagerModel.js";
import { deliverLeagueReportRun } from "../../lib/league/reportDeliveryService.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = Object.freeze([
  ["executive", "Executive", Gauge],
  ["competitions", "Competitions", Trophy],
  ["clubs", "Club scorecards", Building2],
  ["officials", "Officials", Users],
  ["governance", "Governance", ShieldCheck],
  ["reports", "Reports & evidence", FileBarChart],
]);

const REPORT_TYPES = Object.freeze([
  ["executive", "Executive board report"],
  ["competitions", "Competition delivery"],
  ["clubs", "Club scorecards"],
  ["officials", "Match official performance"],
  ["governance", "Discipline and registrations"],
  ["funding_evidence", "Funding evidence dataset"],
]);

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    navy: "border-slate-950 bg-slate-950 text-white",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Metric({ label, value, detail, tone = "slate", icon: Icon = BarChart3 }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${styles[tone] || styles.slate}`}><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><Icon size={17} className="text-slate-400" /></div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function toneForPercent(value, { good = 90, warning = 75 } = {}) {
  if (Number(value) >= good) return "green";
  if (Number(value) >= warning) return "amber";
  return "rose";
}

function scoreTone(value) {
  if (Number(value) >= 85) return "green";
  if (Number(value) >= 70) return "amber";
  return "rose";
}

function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function reportFilename(model, suffix, extension) {
  const league = String(model.league?.name || "league").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const season = String(model.season?.name || "season").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${league}-${season}-${suffix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return String(value); }
}

function reportStatusTone(status) {
  if (status === "delivered") return "green";
  if (["queued", "processing"].includes(status)) return "blue";
  if (["failed", "cancelled"].includes(status)) return "rose";
  return "slate";
}

function printHtmlReport(html) {
  const reportWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!reportWindow) throw new Error("Allow pop-ups for Daxora to open the printable report.");
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  window.setTimeout(() => reportWindow.print(), 300);
}

function splitEmails(value) {
  return String(value || "")
    .split(/[;,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function DataCoverage({ model }) {
  const entries = [
    ["Fixtures", model.dataCoverage.fixtures],
    ["Results", model.dataCoverage.results],
    ["Officials", model.dataCoverage.officials],
    ["Club operations", model.dataCoverage.clubs],
    ["Discipline", model.dataCoverage.discipline],
    ["Registrations", model.dataCoverage.registrations],
  ];
  const missing = entries.filter(([, available]) => !available);
  return <div className={`rounded-2xl border p-4 ${missing.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-black text-slate-950">Reporting data coverage</div><div className="mt-1 text-xs font-semibold text-slate-600">Sensitive datasets are included only when your league role is authorised.</div></div><div className="flex flex-wrap gap-2">{entries.map(([label, available]) => <Badge key={label} tone={available ? "green" : "amber"}>{label}: {available ? "available" : "restricted"}</Badge>)}</div></div></div>;
}

function TrendBars({ rows }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">Capture an executive snapshot to begin season-on-season and month-on-month trend tracking.</div>;
  return <div className="overflow-x-auto"><div className="flex min-w-[620px] items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" style={{ minHeight: 230 }}>{rows.map((row) => <div key={row.id} className="flex min-w-16 flex-1 flex-col items-center justify-end gap-2"><div className="flex h-36 w-full items-end justify-center gap-1"><div title={`Fixture completion ${row.fixtureCompletionRate}%`} className="w-3 rounded-t bg-emerald-500" style={{ height: `${Math.max(4, row.fixtureCompletionRate)}%` }} /><div title={`Official coverage ${row.officialCoverageRate}%`} className="w-3 rounded-t bg-sky-500" style={{ height: `${Math.max(4, row.officialCoverageRate)}%` }} /><div title={`Acknowledgements ${row.acknowledgementRate}%`} className="w-3 rounded-t bg-violet-500" style={{ height: `${Math.max(4, row.acknowledgementRate)}%` }} /></div><div className="text-[10px] font-black text-slate-500">{row.label}</div></div>)}</div><div className="mt-3 flex flex-wrap gap-4 text-[11px] font-bold text-slate-500"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Fixtures</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-500" />Officials</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />Acknowledgements</span></div></div>;
}

function ExecutiveView({ model, trendRows, onCapture, capturing, canManage }) {
  const executive = model.executive;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Fixture completion" value={`${executive.fixtureCompletionRate}%`} detail={`${executive.completedResults} verified · ${executive.fixturesDue} due`} tone={toneForPercent(executive.fixtureCompletionRate)} icon={CheckCircle2} />
      <Metric label="Missing results" value={executive.missingResults} detail={`${executive.pendingResultSubmissions} submissions awaiting review`} tone={executive.missingResults ? "rose" : "green"} icon={ClipboardList} />
      <Metric label="Official coverage" value={`${executive.officialCoverageRate}%`} detail={`${executive.officialGaps} appointment gaps`} tone={toneForPercent(executive.officialCoverageRate)} icon={Users} />
      <Metric label="Club acknowledgements" value={`${executive.acknowledgementRate}%`} detail={`${executive.pendingAcknowledgements} pending`} tone={toneForPercent(executive.acknowledgementRate)} icon={UserRoundCheck} />
      <Metric label="Published fixtures" value={executive.fixtureTotal} detail={`${executive.upcomingFixtures} upcoming`} tone="blue" icon={CalendarClock} />
      <Metric label="Open change requests" value={executive.openChangeRequests} detail="Club requests awaiting resolution" tone={executive.openChangeRequests ? "amber" : "green"} icon={RefreshCw} />
      <Metric label="Discipline cases" value={executive.openDisciplineCases} detail={`${executive.overdueDisciplineResponses} overdue responses`} tone={executive.overdueDisciplineResponses ? "rose" : executive.openDisciplineCases ? "amber" : "green"} icon={ShieldCheck} />
      <Metric label="Registrations" value={executive.approvedRegistrations} detail={`${executive.pendingRegistrations} pending · ${executive.invalidTeamSheets} invalid sheets`} tone={executive.invalidTeamSheets ? "rose" : executive.pendingRegistrations ? "amber" : "green"} icon={Users} />
    </div>
    <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><LineChart size={20} className="text-emerald-600" /><h3 className="text-xl font-black text-slate-950">Operational trend</h3></div><p className="mt-1 text-sm font-semibold text-slate-500">Snapshots preserve headline measures so progress can be demonstrated across the season.</p></div>{canManage ? <button type="button" disabled={capturing} onClick={onCapture} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Capture snapshot</button> : null}</div><div className="mt-5"><TrendBars rows={trendRows} /></div></Panel>
    <div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5 sm:p-6"><h3 className="text-lg font-black text-slate-950">Competition delivery</h3><div className="mt-4 space-y-3">{model.competitionRows.slice(0, 6).map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.completed}/{row.due} due fixtures completed</div></div><Badge tone={toneForPercent(row.completionRate)}>{row.completionRate}%</Badge></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${row.completionRate}%` }} /></div></div>)}</div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-lg font-black text-slate-950">Clubs requiring support</h3><div className="mt-4 space-y-3">{model.clubRows.slice().sort((left, right) => left.operationalScore - right.operationalScore).slice(0, 6).map((row) => <div key={row.id} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{row.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.registrationIssues} registration issues · {row.openDisciplineCases} open cases · {row.openChanges} change requests</div></div><Badge tone={scoreTone(row.operationalScore)}>{row.operationalScore}/100</Badge></div>)}</div></Panel></div>
  </div>;
}

function CompetitionView({ model }) {
  return <Panel className="overflow-hidden"><div className="border-b border-slate-200 p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Competition performance</h3><p className="mt-1 text-sm font-semibold text-slate-500">Division delivery, verified outcomes, backlogs and current leaders in sporting order.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{["Competition", "Teams", "Fixtures", "Due", "Completed", "Missing", "Postponed", "Completion", "Avg goals", "Leader"].map((label) => <th key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{model.competitionRows.map((row) => <tr key={row.id} className="border-t border-slate-100 font-bold text-slate-700"><td className="px-4 py-4 font-black text-slate-950">{row.name}</td><td className="px-4 py-4">{row.teams}</td><td className="px-4 py-4">{row.fixtures}</td><td className="px-4 py-4">{row.due}</td><td className="px-4 py-4">{row.completed}</td><td className={`px-4 py-4 ${row.missing ? "text-rose-700" : ""}`}>{row.missing}</td><td className="px-4 py-4">{row.postponed}</td><td className="px-4 py-4"><Badge tone={toneForPercent(row.completionRate)}>{row.completionRate}%</Badge></td><td className="px-4 py-4">{row.averageGoals}</td><td className="px-4 py-4">{row.leader}{row.leaderPoints !== "—" ? ` · ${row.leaderPoints} pts` : ""}</td></tr>)}</tbody></table></div>{!model.competitionRows.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No competitions match the selected filters.</div> : null}</Panel>;
}

function ClubView({ model }) {
  return <Panel className="overflow-hidden"><div className="border-b border-slate-200 p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Club operational scorecards</h3><p className="mt-1 max-w-4xl text-sm font-semibold text-slate-500">The transparent 100-point score combines result completion (35%), acknowledgements (20%), registration health (20%), discipline health (15%) and open change requests (10%). It is a support signal, not a sporting sanction.</p></div><div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-sm"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{["Club", "Score", "Results", "Acknowledgements", "Open requests", "Registration issues", "Invalid sheets", "Open cases", "Unpaid fines"].map((label) => <th key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{model.clubRows.map((row) => <tr key={row.id} className="border-t border-slate-100 font-bold text-slate-700"><td className="px-4 py-4"><div className="font-black text-slate-950">{row.name}</div><div className="mt-1 text-[11px] text-slate-500">{row.teams} team{row.teams === 1 ? "" : "s"}</div></td><td className="px-4 py-4"><Badge tone={scoreTone(row.operationalScore)}>{row.operationalScore}/100</Badge></td><td className="px-4 py-4">{row.resultCompletionRate}%</td><td className="px-4 py-4">{row.acknowledgementRate}%</td><td className="px-4 py-4">{row.openChanges}</td><td className="px-4 py-4">{row.registrationIssues}</td><td className={`px-4 py-4 ${row.invalidTeamSheets ? "text-rose-700" : ""}`}>{row.invalidTeamSheets}</td><td className={`px-4 py-4 ${row.openDisciplineCases ? "text-amber-700" : ""}`}>{row.openDisciplineCases}</td><td className="px-4 py-4">{row.unpaidFines} {row.finePence ? `· £${(row.finePence / 100).toFixed(2)}` : ""}</td></tr>)}</tbody></table></div></Panel>;
}

function OfficialsView({ model }) {
  const metrics = model.officialMetrics;
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active officials" value={metrics.activeOfficials} tone="blue" icon={Users} /><Metric label="Appointment coverage" value={`${metrics.coverageRate}%`} detail={`${metrics.filledSlots}/${metrics.requiredSlots} required roles`} tone={toneForPercent(metrics.coverageRate)} icon={UserRoundCheck} /><Metric label="Appointment gaps" value={metrics.gaps} tone={metrics.gaps ? "rose" : "green"} icon={AlertTriangle} /><Metric label="Confirmation rate" value={`${metrics.confirmationRate}%`} detail={`${metrics.assignments} active appointments`} tone={toneForPercent(metrics.confirmationRate)} icon={CheckCircle2} /></div><Panel className="overflow-hidden"><div className="border-b border-slate-200 p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Official workload and response</h3><p className="mt-1 text-sm font-semibold text-slate-500">Appointment distribution for fixtures within the selected reporting scope.</p></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{["Official", "Grade", "Appointments", "Confirmed", "Confirmation", "Referee", "Assistant"].map((label) => <th key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody>{model.officialRows.map((row) => <tr key={row.id} className="border-t border-slate-100 font-bold text-slate-700"><td className="px-4 py-4 font-black text-slate-950">{row.name}</td><td className="px-4 py-4">{row.grade}</td><td className="px-4 py-4">{row.appointments}</td><td className="px-4 py-4">{row.confirmed}</td><td className="px-4 py-4"><Badge tone={toneForPercent(row.confirmationRate)}>{row.confirmationRate}%</Badge></td><td className="px-4 py-4">{row.referee}</td><td className="px-4 py-4">{row.assistant}</td></tr>)}</tbody></table></div>{!model.officialRows.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No appointments match the selected filters.</div> : null}</Panel></div>;
}

function GovernanceView({ model }) {
  const discipline = model.disciplineSummary;
  const registrations = model.registrationSummary;
  return <div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><ShieldCheck size={22} className="text-rose-600" /><div><h3 className="text-xl font-black text-slate-950">Discipline and compliance</h3><p className="text-sm font-semibold text-slate-500">Confidential details remain inside the discipline workspace.</p></div></div>{discipline ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Open cases" value={discipline.openCases} tone={discipline.openCases ? "amber" : "green"} /><Metric label="Overdue responses" value={discipline.overdueResponses} tone={discipline.overdueResponses ? "rose" : "green"} /><Metric label="Active sanctions" value={discipline.activeSanctions} tone={discipline.activeSanctions ? "amber" : "green"} /><Metric label="Outstanding fines" value={`£${(discipline.totalFinePence / 100).toFixed(2)}`} tone={discipline.overdueFines ? "rose" : discipline.unpaidFines ? "amber" : "green"} /></div> : <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-sm font-bold text-amber-900">Discipline analytics are restricted for your current role.</div>}</Panel><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><Users size={22} className="text-sky-600" /><div><h3 className="text-xl font-black text-slate-950">Registrations and eligibility</h3><p className="text-sm font-semibold text-slate-500">Player-level personal data is not included in this reporting view.</p></div></div>{registrations ? <div className="mt-5 grid gap-3 sm:grid-cols-2"><Metric label="Pending registrations" value={registrations.pendingRegistrations} tone={registrations.pendingRegistrations ? "amber" : "green"} /><Metric label="Corrections required" value={registrations.correctionRequired} tone={registrations.correctionRequired ? "rose" : "green"} /><Metric label="Pending transfers" value={registrations.pendingTransfers} tone={registrations.pendingTransfers ? "amber" : "green"} /><Metric label="Invalid team sheets" value={registrations.invalidTeamSheets} tone={registrations.invalidTeamSheets ? "rose" : "green"} /></div> : <div className="mt-5 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 text-sm font-bold text-amber-900">Registration analytics are restricted for your current role.</div>}</Panel></div>;
}

function ReportsView({
  model,
  configuration,
  canManage,
  onSaveDefinition,
  onDeleteDefinition,
  onRunDefinition,
  onCapture,
  onSaveDistributionList,
  onDeleteDistributionList,
  onRetryRun,
  busy,
}) {
  const [draft, setDraft] = useState({
    name: "Monthly board report",
    reportType: "executive",
    cadence: "monthly",
    deliveryFormat: "html",
    recipients: "",
    distributionListId: "",
    nextRunOn: "",
    freshnessHours: 24,
    sendEmail: true,
    archiveRuns: true,
    active: true,
  });
  const [listDraft, setListDraft] = useState({ name: "Board distribution", recipients: "" });

  const exportCsv = (type) => {
    downloadFile(
      reportFilename(model, type.replaceAll("_", "-"), "csv"),
      leagueAnalyticsToCsv(model, type),
      "text/csv;charset=utf-8",
    );
    toast.success("CSV report downloaded");
  };

  const exportBoardPack = () => {
    downloadFile(
      reportFilename(model, "board-pack", "html"),
      leagueBoardPackHtml(model),
      "text/html;charset=utf-8",
    );
    toast.success("Board report downloaded", { description: "Open the HTML file to print or save it as PDF." });
  };

  const printBoardPack = () => {
    try {
      printHtmlReport(leagueBoardPackHtml(model));
      toast.success("Print-ready board pack opened");
    } catch (printError) {
      toast.error("Board pack could not open", { description: printError?.message });
    }
  };

  const exportWorkbook = () => {
    downloadFile(
      reportFilename(model, "analytics-workbook", "xls"),
      leagueAnalyticsToExcelXml(model, "executive"),
      "application/vnd.ms-excel",
    );
    toast.success("Excel workbook downloaded", { description: "The workbook includes executive, competition, club, officials, governance and funding sheets." });
  };

  const downloadRunArtifact = (run) => {
    if (!run.snapshot || !Object.keys(run.snapshot).length) {
      toast.error("Archived report data is unavailable");
      return;
    }
    const archivedModel = leagueAnalyticsModelFromSnapshot(run.snapshot);
    const suffix = `${run.reportType.replaceAll("_", "-")}-${run.status}`;
    if (run.deliveryFormat === "csv") {
      downloadFile(reportFilename(archivedModel, suffix, "csv"), leagueAnalyticsToCsv(archivedModel, run.reportType), "text/csv;charset=utf-8");
    } else if (run.deliveryFormat === "xls") {
      downloadFile(reportFilename(archivedModel, suffix, "xls"), leagueAnalyticsToExcelXml(archivedModel, run.reportType), "application/vnd.ms-excel");
    } else {
      downloadFile(reportFilename(archivedModel, suffix, "html"), leagueAnalyticsToHtml(archivedModel, run.reportType), "text/html;charset=utf-8");
    }
    toast.success("Archived report downloaded");
  };

  const latestSnapshot = configuration.snapshots[0] || null;
  const latestAge = latestSnapshot ? leagueAnalyticsSnapshotAgeHours(latestSnapshot) : null;
  const delivery = configuration.delivery;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Scheduled packs" value={configuration.definitions.filter((row) => row.active).length} detail={`${delivery.dueDefinitions} currently due`} tone={delivery.dueDefinitions ? "amber" : "green"} icon={CalendarClock} />
        <Metric label="Queued delivery" value={delivery.queued + delivery.processing} detail={`${delivery.processing} currently processing`} tone={delivery.queued || delivery.processing ? "blue" : "green"} icon={Send} />
        <Metric label="Delivered" value={delivery.delivered} detail="Archived delivery runs" tone="green" icon={CheckCircle2} />
        <Metric label="Failed" value={delivery.failed} detail="Retryable from the delivery queue" tone={delivery.failed ? "rose" : "green"} icon={AlertTriangle} />
        <Metric label="Data freshness" value={latestAge === null ? "No snapshot" : latestAge < 1 ? "Current" : `${Math.floor(latestAge)}h`} detail={latestSnapshot ? formatDateTime(latestSnapshot.createdAt) : "Capture a governed snapshot"} tone={latestAge === null ? "amber" : latestAge <= 24 ? "green" : latestAge <= 48 ? "amber" : "rose"} icon={Clock3} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Download className="text-emerald-600" />
            <div>
              <h3 className="text-xl font-black text-slate-950">Report library</h3>
              <p className="text-sm font-semibold text-slate-500">Board-ready PDF, Excel and CSV outputs using the current filters.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <button type="button" onClick={printBoardPack} className={`${BUTTON} w-full justify-start bg-slate-950 text-white`}><Printer size={15} /> Print or save board pack as PDF</button>
            <button type="button" onClick={exportBoardPack} className={`${BUTTON} w-full justify-start border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}><FileBarChart size={15} /> Download board pack · HTML</button>
            <button type="button" onClick={exportWorkbook} className={`${BUTTON} w-full justify-start border border-emerald-200 bg-emerald-50 text-emerald-800`}><FileSpreadsheet size={15} /> Download complete Excel workbook</button>
            {REPORT_TYPES.map(([type, label]) => (
              <button key={type} type="button" onClick={() => exportCsv(type)} className={`${BUTTON} w-full justify-start border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`}>
                <FileSpreadsheet size={15} /> {label} · CSV
              </button>
            ))}
            <button type="button" disabled={busy || !canManage} onClick={onCapture} className={`${BUTTON} w-full justify-start border border-sky-200 bg-sky-50 text-sky-800`}><Save size={15} /> Capture current governed snapshot</button>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-5 text-amber-900">
            <strong>Evidence control:</strong> exported figures are grounded in League Operations records, but they are not automatic proof of grant eligibility or regulatory compliance. Review source records and current programme guidance before submission.
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarClock className="text-sky-600" />
            <div>
              <h3 className="text-xl font-black text-slate-950">Automated reporting schedule</h3>
              <p className="text-sm font-semibold text-slate-500">Queue governed report packs for email delivery and retain a delivery audit.</p>
            </div>
          </div>
          {canManage ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Report name" className="sm:col-span-2"><input className={INPUT} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Report type"><select className={INPUT} value={draft.reportType} onChange={(event) => setDraft((current) => ({ ...current, reportType: event.target.value }))}>{REPORT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Cadence"><select className={INPUT} value={draft.cadence} onChange={(event) => setDraft((current) => ({ ...current, cadence: event.target.value }))}><option value="manual">Manual</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option></select></Field>
              <Field label="Delivery format"><select className={INPUT} value={draft.deliveryFormat} onChange={(event) => setDraft((current) => ({ ...current, deliveryFormat: event.target.value }))}><option value="html">HTML / print PDF</option><option value="csv">CSV</option><option value="xls">Excel workbook</option></select></Field>
              <Field label="Next due"><input type="date" className={INPUT} value={draft.nextRunOn} onChange={(event) => setDraft((current) => ({ ...current, nextRunOn: event.target.value }))} /></Field>
              <Field label="Distribution list"><select className={INPUT} value={draft.distributionListId} onChange={(event) => setDraft((current) => ({ ...current, distributionListId: event.target.value }))}><option value="">No saved list</option>{configuration.distributionLists.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name} · {row.recipients.length}</option>)}</select></Field>
              <Field label="Maximum snapshot age"><select className={INPUT} value={draft.freshnessHours} onChange={(event) => setDraft((current) => ({ ...current, freshnessHours: Number(event.target.value) }))}><option value={6}>6 hours</option><option value={12}>12 hours</option><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option><option value={168}>7 days</option></select></Field>
              <Field label="Additional recipient emails" className="sm:col-span-2"><textarea className={`${INPUT} min-h-20 py-3`} value={draft.recipients} onChange={(event) => setDraft((current) => ({ ...current, recipients: event.target.value }))} placeholder="secretary@league.org, chair@league.org" /></Field>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={draft.sendEmail} onChange={(event) => setDraft((current) => ({ ...current, sendEmail: event.target.checked }))} /><span><span className="block text-xs font-black text-slate-900">Send by email</span><span className="mt-1 block text-[11px] font-semibold text-slate-500">Uses the configured Daxora communications sender.</span></span></label>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={draft.archiveRuns} onChange={(event) => setDraft((current) => ({ ...current, archiveRuns: event.target.checked }))} /><span><span className="block text-xs font-black text-slate-900">Archive delivery runs</span><span className="mt-1 block text-[11px] font-semibold text-slate-500">Retains delivery status, provider reference and source snapshot.</span></span></label>
              <button
                type="button"
                disabled={busy || !draft.name.trim()}
                onClick={() => onSaveDefinition({ ...draft, recipients: splitEmails(draft.recipients), filters: model.filters })}
                className={`${BUTTON} bg-emerald-600 text-white sm:col-span-2`}
              >
                <Save size={14} /> Save automated report
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-500">Only league owners and administrators can manage automated report schedules.</div>
          )}
        </Panel>
      </div>

      {canManage ? (
        <Panel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <ListPlus className="text-violet-600" />
            <div><h3 className="text-xl font-black text-slate-950">Distribution lists</h3><p className="text-sm font-semibold text-slate-500">Maintain board, committee and operational recipient groups once.</p></div>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="List name"><input className={INPUT} value={listDraft.name} onChange={(event) => setListDraft((current) => ({ ...current, name: event.target.value }))} /></Field>
              <Field label="Recipient emails"><textarea className={`${INPUT} min-h-24 py-3`} value={listDraft.recipients} onChange={(event) => setListDraft((current) => ({ ...current, recipients: event.target.value }))} placeholder="chair@league.org; treasurer@league.org" /></Field>
              <button type="button" disabled={busy || !listDraft.name.trim() || !splitEmails(listDraft.recipients).length} onClick={() => onSaveDistributionList({ ...listDraft, recipients: splitEmails(listDraft.recipients), active: true })} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Save distribution list</button>
            </div>
            <div className="space-y-3">
              {configuration.distributionLists.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{row.name}</div><Badge tone={row.active ? "green" : "slate"}>{row.recipients.length} recipients</Badge></div><div className="mt-1 text-xs font-semibold text-slate-500">{row.recipients.join(", ") || "No recipients"}</div></div>
                  <button type="button" disabled={busy} onClick={() => onDeleteDistributionList(row)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700" aria-label={`Delete ${row.name}`}><Trash2 size={14} /></button>
                </div>
              ))}
              {!configuration.distributionLists.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No report distribution lists have been saved.</div> : null}
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-xl font-black text-slate-950">Scheduled packs</h3><p className="mt-1 text-sm font-semibold text-slate-500">The daily automation queues due packs. Run now captures current data and attempts delivery immediately.</p></div>
            <Badge tone={delivery.automationReady ? "green" : "amber"}>{delivery.automationReady ? "Automation ready" : "Automation configuration required"}</Badge>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {configuration.definitions.map((row) => {
            const reportSnapshot = configuration.snapshots.find((snapshot) => snapshot.reportType === row.reportType);
            const age = reportSnapshot ? leagueAnalyticsSnapshotAgeHours(reportSnapshot) : null;
            const recipientCount = row.recipients.length + (configuration.distributionLists.find((list) => list.id === row.distributionListId)?.recipients.length || 0);
            return (
              <div key={row.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{row.name}</div><Badge tone={row.active ? "green" : "slate"}>{row.cadence}</Badge><Badge>{row.deliveryFormat}</Badge>{row.sendEmail ? <Badge tone="blue">Email</Badge> : <Badge>Archive only</Badge>}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">Next due {formatDate(row.nextRunOn)} · Last delivered {row.lastRunAt ? formatDateTime(row.lastRunAt) : "never"} · {recipientCount} recipient{recipientCount === 1 ? "" : "s"}</div>
                  <div className="mt-2 flex flex-wrap gap-2"><Badge tone={age === null ? "amber" : age <= row.freshnessHours ? "green" : "rose"}>{age === null ? "No source snapshot" : `Snapshot ${Math.floor(age)}h old`}</Badge><Badge>Freshness limit {row.freshnessHours}h</Badge></div>
                </div>
                {canManage ? <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => onRunDefinition(row)} className={`${BUTTON} bg-slate-950 text-white`}><Send size={14} /> Run now</button><button type="button" disabled={busy} onClick={() => onDeleteDefinition(row)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700" aria-label="Delete report schedule"><Trash2 size={14} /></button></div> : null}
              </div>
            );
          })}
          {!configuration.definitions.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No recurring report packs have been saved.</div> : null}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-200 p-5 sm:p-6"><div className="flex items-center gap-3"><Archive className="text-sky-600" /><div><h3 className="text-xl font-black text-slate-950">Delivery queue and archive</h3><p className="text-sm font-semibold text-slate-500">Provider status, retry history and the exact governed snapshot used for each delivery.</p></div></div></div>
        <div className="divide-y divide-slate-100">
          {configuration.runs.slice(0, 40).map((run) => (
            <div key={run.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{run.definitionName}</div><Badge tone={reportStatusTone(run.status)}>{run.status}</Badge><Badge>{run.deliveryFormat}</Badge><Badge>{run.requestedSource}</Badge></div>
                <div className="mt-1 text-xs font-semibold text-slate-500">Queued {formatDateTime(run.queuedAt || run.createdAt)} · {run.recipientCount} recipient{run.recipientCount === 1 ? "" : "s"} · Attempt {run.attemptCount}</div>
                {run.completedAt ? <div className="mt-1 text-xs font-semibold text-slate-500">Completed {formatDateTime(run.completedAt)}{run.provider ? ` · ${run.provider}` : ""}{run.providerReference ? ` · ${run.providerReference}` : ""}</div> : null}
                {run.errorMessage ? <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">{run.errorMessage}</div> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {run.snapshot && Object.keys(run.snapshot).length ? <button type="button" onClick={() => downloadRunArtifact(run)} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={14} /> Download archive</button> : null}
                {canManage && ["failed", "cancelled", "skipped"].includes(run.status) ? <button type="button" disabled={busy} onClick={() => onRetryRun(run)} className={`${BUTTON} border border-amber-200 bg-amber-50 text-amber-800`}><RotateCcw size={14} /> Retry</button> : null}
              </div>
            </div>
          ))}
          {!configuration.runs.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No report delivery runs have been queued yet.</div> : null}
        </div>
      </Panel>

      <Panel className="p-5 sm:p-6">
        <h3 className="text-xl font-black text-slate-950">Snapshot history</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {configuration.snapshots.slice(0, 12).map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-black text-slate-950">{REPORT_TYPES.find(([key]) => key === row.reportType)?.[1] || row.reportType}</div>
              <div className="mt-1 text-[11px] font-semibold text-slate-500">{formatDateTime(row.createdAt)}</div>
              <div className="mt-3 flex flex-wrap gap-2"><Badge>{row.generatedFrom}</Badge>{row.snapshot?.executive?.fixtureCompletionRate !== undefined ? <Badge tone="green">{row.snapshot.executive.fixtureCompletionRate}% fixtures</Badge> : null}</div>
            </div>
          ))}
        </div>
        {!configuration.snapshots.length ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No report snapshots have been captured yet.</div> : null}
      </Panel>
    </div>
  );
}
export default function LeagueAnalyticsWorkspace({ leagueId, workspace, operations, initialTab = "executive", focusToken = 0 }) {
  const daxoraConfirm = useDaxoraConfirm();
  const currentSeason = getCurrentLeagueSeason(workspace);
  const [tab, setTab] = usePersistedWorkspaceState(`daxora:league:${leagueId}:analytics-tab`, initialTab);
  const [seasonId, setSeasonId] = usePersistedWorkspaceState(`daxora:league:${leagueId}:analytics-season`, currentSeason?.id || "");
  const [divisionId, setDivisionId] = usePersistedWorkspaceState(`daxora:league:${leagueId}:analytics-division`, "");
  const [dateFrom, setDateFrom] = usePersistedWorkspaceState(`daxora:league:${leagueId}:analytics-from`, "");
  const [dateTo, setDateTo] = usePersistedWorkspaceState(`daxora:league:${leagueId}:analytics-to`, "");
  const [clubOperations, setClubOperations] = useState(() => normaliseLeagueClubOperationsData({}));
  const [results, setResults] = useState(() => normaliseLeagueResultsData({}));
  const [discipline, setDiscipline] = useState(null);
  const [registrations, setRegistrations] = useState(null);
  const [configuration, setConfiguration] = useState(() => normaliseLeagueReportConfiguration({}));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = workspace.access?.role || "viewer";
  const canDiscipline = ["owner", "admin", "discipline"].includes(role);
  const canRegistrations = ["owner", "admin", "registrations"].includes(role);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [clubPayload, resultPayload, reportPayload, disciplinePayload, registrationPayload] = await Promise.all([
        DB.getLeagueClubOperationsData(leagueId),
        DB.getLeagueResultsData(leagueId),
        DB.getLeagueReportConfiguration(leagueId).catch(() => ({})),
        canDiscipline ? DB.getLeagueDisciplineData(leagueId).catch(() => null) : Promise.resolve(null),
        canRegistrations ? DB.getLeagueRegistrationData(leagueId).catch(() => null) : Promise.resolve(null),
      ]);
      setClubOperations(normaliseLeagueClubOperationsData(clubPayload));
      setResults(normaliseLeagueResultsData(resultPayload));
      setConfiguration(normaliseLeagueReportConfiguration(reportPayload));
      setDiscipline(disciplinePayload ? normaliseLeagueDisciplineData(disciplinePayload) : null);
      setRegistrations(registrationPayload ? normaliseLeagueRegistrationData(registrationPayload) : null);
    } catch (loadError) {
      setError(loadError?.message || "League analytics could not be loaded.");
    } finally { setLoading(false); }
  }, [canDiscipline, canRegistrations, leagueId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (TABS.some(([key]) => key === initialTab)) setTab(initialTab); }, [focusToken, initialTab, setTab]);

  const model = useMemo(() => buildLeagueAnalyticsModel({ workspace, operations, clubOperations, results, discipline, registrations, reportConfiguration: configuration, filters: { seasonId, divisionId, dateFrom, dateTo } }), [clubOperations, configuration, dateFrom, dateTo, discipline, divisionId, operations, registrations, results, seasonId, workspace]);
  const trendRows = useMemo(() => buildLeagueSnapshotTrend(configuration.snapshots, model), [configuration.snapshots, model]);

  const autoSnapshotSignature = useRef("");

  const createSnapshot = useCallback((reportType = "executive", definitionId = "", generatedFrom = "manual") => (
    DB.captureLeagueReportSnapshot(leagueId, {
      seasonId: model.season?.id || null,
      definitionId: definitionId || null,
      reportType,
      generatedFrom,
      snapshot: leagueAnalyticsSnapshotPayload(model, reportType),
    })
  ), [leagueId, model]);

  const captureSnapshot = async (reportType = "executive", definitionId = "") => {
    setBusy(true);
    try {
      const snapshotId = await createSnapshot(reportType, definitionId, definitionId ? "scheduled_run" : "manual");
      await load();
      toast.success("Report snapshot captured");
      return snapshotId;
    } catch (saveError) {
      toast.error("Snapshot could not be captured", { description: saveError?.message });
      return null;
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (loading || !configuration.access.canManage || !configuration.definitions.length) return;
    const requiredTypes = [...new Set(configuration.definitions.filter((row) => row.active).map((row) => row.reportType))];
    const staleTypes = requiredTypes.filter((reportType) => {
      const latest = configuration.snapshots.find((row) => row.reportType === reportType);
      return !latest || leagueAnalyticsSnapshotAgeHours(latest) >= 6;
    });
    if (!staleTypes.length) return;
    const signature = `${model.season?.id || "season"}:${staleTypes.sort().join(",")}`;
    if (autoSnapshotSignature.current === signature) return;
    autoSnapshotSignature.current = signature;
    Promise.all(staleTypes.map((reportType) => createSnapshot(reportType, "", "api")))
      .then(() => load())
      .catch((snapshotError) => {
        autoSnapshotSignature.current = "";
        toast.warning("Scheduled report data could not refresh", { description: snapshotError?.message });
      });
  }, [configuration.access.canManage, configuration.definitions, configuration.snapshots, createSnapshot, load, loading, model.season?.id]);

  const saveDefinition = async (definition) => {
    setBusy(true);
    try { await DB.upsertLeagueReportDefinition(leagueId, definition); await load(); toast.success("Automated report saved"); }
    catch (saveError) { toast.error("Report schedule could not be saved", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const deleteDefinition = async (definition) => {
    if (!(await daxoraConfirm({ title: "Delete report schedule?", description: `${definition.name} will be removed from the reporting queue.`, confirmLabel: "Delete schedule", tone: "danger" }))) return;
    setBusy(true);
    try { await DB.deleteLeagueReportDefinition(leagueId, definition.id); await load(); toast.success("Report schedule deleted"); }
    catch (deleteError) { toast.error("Report schedule could not be deleted", { description: deleteError?.message }); }
    finally { setBusy(false); }
  };

  const saveDistributionList = async (list) => {
    setBusy(true);
    try { await DB.upsertLeagueReportDistributionList(leagueId, list); await load(); toast.success("Distribution list saved"); }
    catch (saveError) { toast.error("Distribution list could not be saved", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const deleteDistributionList = async (list) => {
    if (!(await daxoraConfirm({ title: "Delete distribution list?", description: `${list.name} will no longer be available to report schedules. Existing direct recipients are unchanged.`, confirmLabel: "Delete list", tone: "danger" }))) return;
    setBusy(true);
    try { await DB.deleteLeagueReportDistributionList(leagueId, list.id); await load(); toast.success("Distribution list deleted"); }
    catch (deleteError) { toast.error("Distribution list could not be deleted", { description: deleteError?.message }); }
    finally { setBusy(false); }
  };

  const runDefinition = async (definition) => {
    setBusy(true);
    try {
      const snapshotId = await createSnapshot(definition.reportType, definition.id, "scheduled_run");
      const runId = await DB.queueLeagueReportDelivery(leagueId, definition.id, snapshotId, "manual");
      const result = await deliverLeagueReportRun({ leagueId, runId });
      await load();
      if (result?.status === "delivered") toast.success("Report delivered", { description: `${definition.name} was sent and archived.` });
      else toast.warning("Report queued for retry", { description: result?.error || `${definition.name} remains in the delivery queue.` });
    } catch (runError) {
      await load().catch(() => null);
      toast.error("Report delivery failed", { description: runError?.message });
    } finally { setBusy(false); }
  };

  const retryRun = async (run) => {
    setBusy(true);
    try {
      await DB.retryLeagueReportDelivery(leagueId, run.id);
      const result = await deliverLeagueReportRun({ leagueId, runId: run.id });
      await load();
      if (result?.status === "delivered") toast.success("Report delivered on retry");
      else toast.warning("Report remains queued", { description: result?.error || "Daxora will try the delivery again." });
    } catch (retryError) {
      await load().catch(() => null);
      toast.error("Report retry failed", { description: retryError?.message });
    } finally { setBusy(false); }
  };

  if (loading) return <Panel className="flex min-h-[420px] items-center justify-center p-8"><div className="text-center"><RefreshCw size={28} className="mx-auto animate-spin text-emerald-600" /><div className="mt-4 text-sm font-black text-slate-900">Building league intelligence…</div></div></Panel>;
  if (error) return <Panel className="p-6"><div className="flex items-start gap-4"><AlertTriangle className="mt-0.5 text-rose-600" /><div><h3 className="text-xl font-black text-slate-950">Analytics could not load</h3><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5"><Panel className="overflow-hidden"><div className="bg-slate-950 p-5 text-white sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300"><Landmark size={15} /> League intelligence</div><h2 className="mt-2 text-2xl font-black">Analytics and reports</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">One reporting layer across fixtures, results, clubs, officials, discipline and registrations. Every figure can be traced back to an operational register.</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone={model.executive.status === "ready" ? "green" : model.executive.status === "needs_review" ? "amber" : "rose"}>{model.executive.status.replaceAll("_", " ")}</Badge><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white hover:bg-white/15`}><RefreshCw size={14} /> Refresh</button></div></div></div><div className="grid gap-3 border-t border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Season"><select className={INPUT} value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Division"><select className={INPUT} value={divisionId} onChange={(event) => setDivisionId(event.target.value)}><option value="">All divisions</option>{workspace.divisions.filter((row) => !seasonId || row.seasonId === seasonId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="From"><input type="date" className={INPUT} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></Field><Field label="To"><input type="date" className={INPUT} value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></Field></div></Panel><DataCoverage model={model} /><div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" role="tablist" aria-label="League analytics sections">{TABS.map(([key, label, Icon]) => { const active = tab === key; return <button key={key} type="button" onClick={() => setTab(key)} role="tab" aria-selected={active} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black transition ${active ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={16} className={active ? "text-emerald-300" : "text-slate-400"} />{label}</button>; })}</div>{tab === "executive" ? <ExecutiveView model={model} trendRows={trendRows} onCapture={() => captureSnapshot("executive")} capturing={busy} canManage={configuration.access.canManage} /> : null}{tab === "competitions" ? <CompetitionView model={model} /> : null}{tab === "clubs" ? <ClubView model={model} /> : null}{tab === "officials" ? <OfficialsView model={model} /> : null}{tab === "governance" ? <GovernanceView model={model} /> : null}{tab === "reports" ? <ReportsView model={model} configuration={configuration} canManage={configuration.access.canManage} onSaveDefinition={saveDefinition} onDeleteDefinition={deleteDefinition} onRunDefinition={runDefinition} onCapture={() => captureSnapshot("executive")} onSaveDistributionList={saveDistributionList} onDeleteDistributionList={deleteDistributionList} onRetryRun={retryRun} busy={busy} /> : null}</div>;
}
