import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Gavel,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { normaliseLeagueClubOperationsData } from "../../lib/league/leagueClubOperations.js";
import { buildLeagueCommandCentre } from "../../lib/league/leagueCommandCentre.js";
import { normaliseLeagueResultsData } from "../../lib/league/leagueResultsEngine.js";
import { normaliseLeagueDisciplineData } from "../../lib/league/leagueDisciplineEngine.js";
import { normaliseLeagueRegistrationData } from "../../lib/league/leagueRegistrationEngine.js";
import { normaliseScheduleVersion, normaliseScheduleVersionPayload } from "../../lib/league/leagueSchedulingEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
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

function Metric({ label, value, detail, tone = "slate", Icon }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50/80",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>{Icon ? <Icon size={17} className="text-slate-400" /> : null}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function statusCopy(status) {
  if (status === "action_required") return { label: "Action required", tone: "rose", title: "League operations need intervention", detail: "Critical queues contain overdue, disputed or replacement work that should be cleared first." };
  if (status === "needs_review") return { label: "Needs review", tone: "amber", title: "League operations are stable with open work", detail: "No critical blocker is visible, but several queues still need league attention." };
  return { label: "Ready", tone: "green", title: "League operations are under control", detail: "No critical or review-level action is currently visible in the command queues." };
}

function dateLabel(value) {
  if (!value) return "Date TBC";
  try { return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }); }
  catch { return value; }
}

export default function LeagueCommandCentreWorkspace({ leagueId, workspace, operations, readiness, onNavigate, onRefreshOperations, onSummaryChange }) {
  const [data, setData] = useState({
    clubOperations: normaliseLeagueClubOperationsData({}),
    results: normaliseLeagueResultsData({}),
    discipline: normaliseLeagueDisciplineData({}),
    registrations: normaliseLeagueRegistrationData({}),
    scheduleVersion: null,
  });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const canLoadDiscipline = ["owner", "admin", "discipline"].includes(workspace.access?.role || "");
      const disciplineRequest = canLoadDiscipline && typeof DB.getLeagueDisciplineData === "function"
        ? DB.getLeagueDisciplineData(leagueId).catch((disciplineError) => {
          const message = disciplineError?.message || "";
          const migrationNotReady = disciplineError?.code === "PGRST202"
            || /schema cache|could not find the function|get_league_discipline_data/i.test(message);
          if (migrationNotReady) return {};
          throw disciplineError;
        })
        : Promise.resolve({});
      const canLoadRegistrations = ["owner", "admin", "registrations"].includes(workspace.access?.role || "");
      const registrationRequest = canLoadRegistrations && typeof DB.getLeagueRegistrationData === "function"
        ? DB.getLeagueRegistrationData(leagueId).catch((registrationError) => {
          const message = registrationError?.message || "";
          const migrationNotReady = registrationError?.code === "PGRST202"
            || /schema cache|could not find the function|get_league_registration_data/i.test(message);
          if (migrationNotReady) return {};
          throw registrationError;
        })
        : Promise.resolve({});
      const [clubPayload, resultPayload, disciplinePayload, registrationPayload, versions] = await Promise.all([
        DB.getLeagueClubOperationsData(leagueId),
        DB.getLeagueResultsData(leagueId),
        disciplineRequest,
        registrationRequest,
        DB.listLeagueScheduleVersions(leagueId),
      ]);
      const versionRows = (Array.isArray(versions) ? versions : []).map(normaliseScheduleVersion);
      const selected = versionRows.find((row) => row.status === "published") || versionRows[0] || null;
      const scheduleVersion = selected ? normaliseScheduleVersionPayload(await DB.getLeagueScheduleVersion(leagueId, selected.id)) : null;
      await onRefreshOperations?.();
      setData({
        clubOperations: normaliseLeagueClubOperationsData(clubPayload),
        results: normaliseLeagueResultsData(resultPayload),
        discipline: normaliseLeagueDisciplineData(disciplinePayload),
        registrations: normaliseLeagueRegistrationData(registrationPayload),
        scheduleVersion,
      });
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "The league command centre could not be loaded.");
      setStatus("error");
    }
  }, [leagueId, onRefreshOperations]);

  useEffect(() => { load(); }, [load]);

  const command = useMemo(() => buildLeagueCommandCentre({
    workspace,
    operations,
    clubOperations: data.clubOperations,
    results: data.results,
    discipline: data.discipline,
    registrations: data.registrations,
    scheduleVersion: data.scheduleVersion,
    readiness,
    role: workspace.access?.role,
  }), [workspace, operations, data, readiness]);

  useEffect(() => {
    onSummaryChange?.(command);
  }, [command, onSummaryChange]);

  if (status === "loading") return <Panel className="flex min-h-[360px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-800">Building the league command picture…</div></div></Panel>;
  if (status === "error") return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="mt-1 shrink-0 text-rose-600" /><div><h2 className="text-xl font-black text-slate-950">Command centre could not load</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={() => load().catch((loadError) => toast.error(loadError?.message))} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  const copy = statusCopy(command.status);
  return <div className="space-y-5">
    <Panel className="overflow-hidden">
      <div className="grid gap-5 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><Badge tone="green">League Operations v3.7</Badge><Badge tone={copy.tone}>{copy.label}</Badge></div><h2 className="mt-4 text-3xl font-black tracking-tight">Operational command centre</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">{command.roleFocus?.detail || "One prioritised view of fixture exceptions, club requests, results, appointments, publications and setup readiness."}</p></div>
        <button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white hover:bg-white/15`}><RefreshCw size={14} /> Refresh command picture</button>
      </div>
      <div className={`border-t px-6 py-5 ${command.status === "action_required" ? "border-rose-200 bg-rose-50" : command.status === "needs_review" ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-start gap-3">{command.status === "ready" ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className={`mt-0.5 shrink-0 ${command.status === "action_required" ? "text-rose-600" : "text-amber-600"}`} />}<div><div className="text-sm font-black text-slate-950">{copy.title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{copy.detail}</div></div></div></div>
    </Panel>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Metric label="Open actions" value={command.counts.openActions} detail="Across all command queues" tone={command.counts.critical ? "rose" : command.counts.attention ? "amber" : "green"} Icon={FileWarning} />
      <Metric label="Results control" value={command.counts.pendingResults + command.counts.missingResults} detail={`${command.counts.pendingResults} verification · ${command.counts.missingResults} missing`} tone={command.counts.pendingResults + command.counts.missingResults ? "amber" : "green"} Icon={ClipboardCheck} />
      <Metric label="Official coverage" value={`${command.counts.officialCoverage}%`} detail={`${command.counts.officialGaps} open roles in 35 days`} tone={command.counts.officialGaps ? "amber" : "green"} Icon={UserRoundCheck} />
      <Metric label="Discipline" value={command.counts.openDisciplineCases} detail={`${command.counts.overdueDisciplineResponses} overdue responses · ${command.counts.overdueDisciplineFines} overdue fines`} tone={command.counts.overdueDisciplineResponses + command.counts.overdueDisciplineFines ? "rose" : command.counts.openDisciplineCases ? "amber" : "green"} Icon={Gavel} />
      <Metric label="Registrations" value={command.counts.pendingRegistrations + command.counts.registrationCorrections} detail={`${command.counts.pendingTransfers} transfers · ${command.counts.invalidTeamSheets} failed sheets`} tone={command.counts.registrationCorrections + command.counts.invalidTeamSheets ? "rose" : command.counts.pendingRegistrations + command.counts.pendingTransfers + command.counts.openEligibilityExceptions ? "amber" : "green"} Icon={UserRoundCheck} />
      <Metric label="Setup readiness" value={`${command.readinessPercentage}%`} detail={`${command.counts.setupGaps} mandatory gaps`} tone={command.counts.setupGaps ? "blue" : "green"} Icon={ShieldCheck} />
    </div>

    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6"><div><h3 className="text-xl font-black text-slate-950">Priority action queue</h3><p className="mt-1 text-sm font-semibold text-slate-500">Critical work first, then review items.</p></div><Badge tone={copy.tone}>{command.actions.length} queues</Badge></div>
        <div className="divide-y divide-slate-100">
          {command.actions.length ? command.actions.map((item) => <button type="button" key={item.id} onClick={() => onNavigate?.(item.tab, item.child)} className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50 sm:px-6"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${item.severity === "critical" ? "bg-rose-100 text-rose-700" : item.severity === "attention" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700"}`}>{item.count}</span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-slate-950">{item.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.detail}</span></span><ArrowRight size={17} className="shrink-0 text-slate-400" /></button>) : <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={30} /><div className="mt-3 text-sm font-black text-slate-900">No command action is currently open.</div><div className="mt-1 text-xs font-semibold text-slate-500">Refresh after new club submissions, fixtures, results or appointment responses.</div></div>}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Upcoming operational window</h3><p className="mt-1 text-sm font-semibold text-slate-500">Next scheduled fixtures inside the 35-day appointments horizon.</p></div>
        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {command.nextFixtures.length ? command.nextFixtures.map((fixture) => <button type="button" key={`${fixture.targetType}:${fixture.targetId}`} onClick={() => onNavigate?.("command", "list")} className="w-full px-5 py-4 text-left hover:bg-slate-50 sm:px-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-950">{fixture.homeTeamName} v {fixture.awayTeamName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(fixture.date)} · {fixture.kickOff || "TBC"} · {fixture.venueName}</div></div><Badge tone={fixture.competitionType === "cup" ? "amber" : "blue"}>{fixture.competitionName}</Badge></div></button>) : <div className="p-10 text-center"><CalendarClock className="mx-auto text-slate-300" size={30} /><div className="mt-3 text-sm font-black text-slate-600">No scheduled fixture is inside the next 35 days.</div></div>}
        </div>
      </Panel>
    </div>
  </div>;
}
