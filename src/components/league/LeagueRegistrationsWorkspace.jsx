import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileWarning,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Shirt,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { useUnsavedChangesGuard } from "../../hooks/useUnsavedChangesGuard.js";
import { useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import {
  assessLeaguePlayerEligibility,
  leagueEligibilityExceptionsToCsv,
  leagueRegistrationsToCsv,
  normaliseLeagueRegistrationData,
} from "../../lib/league/leagueRegistrationEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["command", "Command", ShieldCheck],
  ["applications", "Applications", ClipboardCheck],
  ["players", "Player register", Users],
  ["transfers", "Transfers", ArrowRightLeft],
  ["eligibility", "Rules & exceptions", BadgeCheck],
  ["matchday", "Team sheets", Shirt],
  ["reports", "Reports", FileSpreadsheet],
];

const REGISTRATION_STATUSES = [
  ["submitted", "Submitted"],
  ["under_review", "Under review"],
  ["correction_required", "Correction required"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["withdrawn", "Withdrawn"],
  ["expired", "Expired"],
];

const RULE_TYPES = [
  ["minimum_age", "Minimum age"],
  ["maximum_age", "Maximum age"],
  ["registration_deadline", "Registration deadline"],
  ["cup_tied", "Cup-tied rule"],
  ["transfer_clearance", "Transfer clearance"],
  ["suspension", "Suspension check"],
  ["other", "Other rule"],
];

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
    purple: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone = "slate", Icon }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}><div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>{Icon ? <Icon size={17} className="text-slate-400" /> : null}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function statusTone(status) {
  if (["approved", "verified", "eligible", "completed"].includes(status)) return "green";
  if (["submitted", "under_review", "warning", "draft"].includes(status)) return "amber";
  if (["correction_required", "rejected", "ineligible", "failed"].includes(status)) return "rose";
  if (["withdrawn", "expired"].includes(status)) return "slate";
  return "blue";
}

function dateLabel(value) {
  if (!value) return "Not set";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function emptyRegistrationDraft(workspace = {}) {
  const season = workspace.seasons?.find((row) => row.isCurrent) || workspace.seasons?.[0];
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    externalRef: "",
    seasonId: season?.id || "",
    parentClubId: "",
    teamId: "",
    registrationType: "new",
    effectiveFrom: season?.startsOn || "",
    effectiveTo: season?.endsOn || "",
  };
}

function emptyRuleDraft(workspace = {}) {
  const season = workspace.seasons?.find((row) => row.isCurrent) || workspace.seasons?.[0];
  return {
    seasonId: season?.id || "",
    divisionId: "",
    competitionType: "all",
    ruleType: "registration_deadline",
    name: "Registration deadline",
    severity: "block",
    value: "",
  };
}

export default function LeagueRegistrationsWorkspace({ leagueId, workspace, initialTab = "command", focusToken = 0, onSummaryChange }) {
  const [data, setData] = useState(() => normaliseLeagueRegistrationData({}));
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialTab || "command");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationDraft, setRegistrationDraft] = useState(() => emptyRegistrationDraft(workspace));
  const [ruleDraft, setRuleDraft] = useState(() => emptyRuleDraft(workspace));
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);

  const registrationDirty = showRegistration && Boolean(registrationDraft.firstName || registrationDraft.lastName || registrationDraft.dateOfBirth || registrationDraft.parentClubId);
  const confirmLeave = useUnsavedChangesGuard(registrationDirty, "The registration application has not been saved. Discard it?");
  const daxoraPrompt = useDaxoraPrompt();

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = normaliseLeagueRegistrationData(await DB.getLeagueRegistrationData(leagueId));
      setData(next);
      onSummaryChange?.(next.summary);
      setSelectedFixtureId((current) => current && next.fixtures.some((row) => row.id === current) ? current : next.fixtures[0]?.id || "");
      setStatus("ready");
      return next;
    } catch (loadError) {
      setError(loadError?.message || "The registrations workspace could not be loaded.");
      setStatus("error");
      return null;
    }
  }, [leagueId, onSummaryChange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [focusToken, initialTab]);

  const currentSeason = useMemo(() => workspace.seasons?.find((row) => row.isCurrent) || workspace.seasons?.[0] || null, [workspace.seasons]);
  const playerById = useMemo(() => new Map(data.players.map((row) => [row.id, row])), [data.players]);
  const registrationByPlayer = useMemo(() => {
    const map = new Map();
    data.registrations.forEach((row) => {
      const current = map.get(row.playerId);
      if (!current || String(row.updatedAt || "") > String(current.updatedAt || "")) map.set(row.playerId, row);
    });
    return map;
  }, [data.registrations]);

  const filteredRegistrations = useMemo(() => {
    const search = query.trim().toLowerCase();
    return data.registrations.filter((row) => {
      if (statusFilter === "open" && !["submitted", "under_review", "correction_required"].includes(row.status)) return false;
      if (statusFilter === "approved" && row.status !== "approved") return false;
      if (statusFilter === "closed" && !["rejected", "withdrawn", "expired"].includes(row.status)) return false;
      if (!search) return true;
      const player = playerById.get(row.playerId);
      return [row.playerName, player?.displayName, row.clubName, row.teamName, row.status, row.registrationType]
        .some((value) => String(value || "").toLowerCase().includes(search));
    });
  }, [data.registrations, playerById, query, statusFilter]);

  const selectedFixture = useMemo(() => data.fixtures.find((row) => row.id === selectedFixtureId) || null, [data.fixtures, selectedFixtureId]);
  const fixtureTeamIds = useMemo(() => selectedFixture ? [selectedFixture.homeTeamId, selectedFixture.awayTeamId].filter(Boolean) : [], [selectedFixture]);
  useEffect(() => {
    if (!fixtureTeamIds.length) { setSelectedTeamId(""); return; }
    setSelectedTeamId((current) => fixtureTeamIds.includes(current) ? current : fixtureTeamIds[0]);
    setSelectedPlayerIds([]);
  }, [selectedFixtureId, fixtureTeamIds.join("|")]);

  const teamRegistrations = useMemo(() => data.registrations.filter((row) => row.status === "approved"
    && row.teamId === selectedTeamId
    && (!currentSeason?.id || row.seasonId === currentSeason.id)), [currentSeason?.id, data.registrations, selectedTeamId]);
  const teamPlayers = useMemo(() => teamRegistrations.map((registration) => {
    const player = playerById.get(registration.playerId);
    return {
      player,
      registration,
      assessment: assessLeaguePlayerEligibility({
        player,
        registration,
        team: workspace.teams?.find((row) => row.id === selectedTeamId),
        fixture: selectedFixture,
        rules: data.rules,
        dispensations: data.dispensations,
        sanctions: data.sanctions,
        appearances: data.teamSheetPlayers.map((row) => {
          const sheet = data.teamSheets.find((candidate) => candidate.id === row.teamSheetId);
          const fixture = data.fixtures.find((candidate) => candidate.id === sheet?.publicationFixtureId);
          return { ...row, teamId: sheet?.teamId, teamSheetStatus: sheet?.status, competitionType: fixture?.competitionType, competitionId: fixture?.competitionId };
        }),
      }),
    };
  }).filter((row) => row.player), [data, playerById, selectedFixture, selectedTeamId, teamRegistrations, workspace.teams]);

  const createRegistration = async () => {
    if (!registrationDraft.firstName.trim() || !registrationDraft.lastName.trim() || !registrationDraft.dateOfBirth || !registrationDraft.parentClubId || !registrationDraft.teamId) {
      toast.error("Add the player, date of birth, club and team");
      return;
    }
    setBusy(true);
    try {
      await DB.submitLeaguePlayerRegistration(leagueId, registrationDraft);
      setRegistrationDraft(emptyRegistrationDraft(workspace));
      setShowRegistration(false);
      await load();
      toast.success("Registration application created");
    } catch (saveError) { toast.error("Registration could not be created", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const reviewRegistration = async (registration, decision) => {
    const notes = await daxoraPrompt({
      title: decision === "approved" ? "Approve registration" : decision === "correction_required" ? "Request registration corrections" : "Reject registration",
      description: decision === "approved" ? "Add an optional approval note for the club." : "Record a clear reason that will be shown to the club.",
      label: decision === "approved" ? "Approval note" : "Decision reason",
      confirmLabel: "Record decision",
      required: decision !== "approved",
      minLength: decision !== "approved" ? 3 : 0,
      multiline: true,
    });
    if (notes === null || (decision !== "approved" && !notes.trim())) return;
    setBusy(true);
    try {
      await DB.reviewLeaguePlayerRegistration(leagueId, registration.id, decision, notes);
      await load();
      toast.success(`Registration ${decision.replaceAll("_", " ")}`);
    } catch (reviewError) { toast.error("Registration decision could not be recorded", { description: reviewError?.message }); }
    finally { setBusy(false); }
  };

  const reviewTransfer = async (transfer, decision) => {
    const notes = await daxoraPrompt({
      title: decision === "approved" ? "Approve transfer" : "Reject transfer",
      description: decision === "approved" ? "Add any optional conditions or notes." : "Record the reason that will be shown to the club.",
      label: decision === "approved" ? "Approval note" : "Decision reason",
      confirmLabel: "Record decision",
      required: decision !== "approved",
      minLength: decision !== "approved" ? 3 : 0,
      multiline: true,
    });
    if (notes === null || (decision !== "approved" && !notes.trim())) return;
    setBusy(true);
    try {
      await DB.reviewLeagueTransferRequest(leagueId, transfer.id, decision, notes);
      await load();
      toast.success(`Transfer ${decision}`);
    } catch (transferError) { toast.error("Transfer decision could not be recorded", { description: transferError?.message }); }
    finally { setBusy(false); }
  };

  const saveRule = async () => {
    if (!ruleDraft.name.trim()) { toast.error("Add a rule name"); return; }
    const config = {};
    if (["minimum_age", "maximum_age"].includes(ruleDraft.ruleType)) config.age = Number(ruleDraft.value || 0);
    if (ruleDraft.ruleType === "registration_deadline") config.deadline = ruleDraft.value || null;
    setBusy(true);
    try {
      await DB.upsertLeagueEligibilityRule(leagueId, { ...ruleDraft, config });
      setRuleDraft(emptyRuleDraft(workspace));
      await load();
      toast.success("Eligibility rule saved");
    } catch (ruleError) { toast.error("Eligibility rule could not be saved", { description: ruleError?.message }); }
    finally { setBusy(false); }
  };

  const reviewDispensation = async (dispensation, decision) => {
    const notes = await daxoraPrompt({
      title: decision === "approved" ? "Approve dispensation" : "Reject dispensation",
      description: decision === "approved" ? "Record any conditions attached to this exception." : "Record the reason that will be shown to the club.",
      label: decision === "approved" ? "Conditions" : "Decision reason",
      confirmLabel: "Record decision",
      required: decision !== "approved",
      minLength: decision !== "approved" ? 3 : 0,
      multiline: true,
    });
    if (notes === null || (decision !== "approved" && !notes.trim())) return;
    setBusy(true);
    try {
      await DB.reviewLeagueEligibilityDispensation(leagueId, dispensation.id, decision, notes);
      await load();
      toast.success(`Dispensation ${decision}`);
    } catch (dispensationError) { toast.error("Dispensation decision could not be recorded", { description: dispensationError?.message }); }
    finally { setBusy(false); }
  };

  const saveTeamSheet = async () => {
    if (!selectedFixture || !selectedTeamId || !selectedPlayerIds.length) { toast.error("Select a fixture, team and at least one player"); return; }
    setBusy(true);
    try {
      const result = await DB.saveLeagueTeamSheet(leagueId, {
        publicationFixtureId: selectedFixture.id,
        teamId: selectedTeamId,
        status: "submitted",
        players: selectedPlayerIds.map((playerId, index) => ({
          playerId,
          registrationId: registrationByPlayer.get(playerId)?.id || null,
          squadRole: index < 11 ? "starter" : "substitute",
          shirtNumber: index + 1,
        })),
      });
      await load();
      const invalidCount = Number(result?.invalid_count ?? result?.invalidCount ?? 0);
      if (invalidCount) toast.warning("Team sheet saved with eligibility failures", { description: `${invalidCount} player${invalidCount === 1 ? "" : "s"} require attention.` });
      else toast.success("Team sheet submitted and validated");
    } catch (sheetError) { toast.error("Team sheet could not be saved", { description: sheetError?.message }); }
    finally { setBusy(false); }
  };

  if (status === "loading") return <Panel className="flex min-h-[380px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" size={28} /><div className="mt-3 text-sm font-black text-slate-800">Loading registrations and eligibility…</div></div></Panel>;
  if (status === "error") return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="mt-1 shrink-0 text-rose-600" /><div><h2 className="text-xl font-black text-slate-950">Registrations could not load</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5">
    <Panel className="overflow-hidden">
      <div className="flex flex-col gap-5 bg-slate-950 px-6 py-7 text-white lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="green">League Operations v3.7</Badge><Badge tone={data.summary.status === "action_required" ? "rose" : data.summary.status === "needs_review" ? "amber" : "green"}>{data.summary.status.replaceAll("_", " ")}</Badge></div><h2 className="mt-4 text-3xl font-black tracking-tight">Registrations and eligibility</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">One secure register for player applications, transfers, competition rules, dispensations and matchday team sheets.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh</button>{data.access.canManage ? <button type="button" onClick={() => setShowRegistration(true)} className={`${BUTTON} bg-emerald-500 text-slate-950`}><UserPlus size={14} /> New registration</button> : null}</div></div>
      <div className="overflow-x-auto border-t border-white/10 bg-white p-2"><div className="flex min-w-max gap-2">{TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={async () => { if (key !== tab && !(await confirmLeave())) return; setTab(key); }} className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black transition ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} />{label}{key === "applications" && data.summary.pendingRegistrations + data.summary.correctionRequired ? <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">{data.summary.pendingRegistrations + data.summary.correctionRequired}</span> : null}{key === "transfers" && data.summary.pendingTransfers ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] text-slate-950">{data.summary.pendingTransfers}</span> : null}</button>)}</div></div>
    </Panel>

    {tab === "command" ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Active players" value={data.summary.activePlayers} detail={`${data.summary.approvedRegistrations} approved registrations`} tone="blue" Icon={Users} /><Metric label="Applications" value={data.summary.pendingRegistrations} detail={`${data.summary.correctionRequired} require correction`} tone={data.summary.correctionRequired ? "rose" : data.summary.pendingRegistrations ? "amber" : "green"} Icon={ClipboardCheck} /><Metric label="Transfers" value={data.summary.pendingTransfers} detail={`${data.summary.openDispensations} eligibility exceptions`} tone={data.summary.pendingTransfers + data.summary.openDispensations ? "amber" : "green"} Icon={ArrowRightLeft} /><Metric label="Matchday failures" value={data.summary.invalidTeamSheets} detail={`${data.summary.duplicateWarnings} duplicate player warnings`} tone={data.summary.invalidTeamSheets ? "rose" : data.summary.duplicateWarnings ? "amber" : "green"} Icon={FileWarning} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-black text-slate-950">Registration action queue</h3></div><div className="divide-y divide-slate-100">{[
      [data.summary.correctionRequired, "Applications requiring correction", "Clubs need clear feedback before resubmission.", "applications", "rose"],
      [data.summary.pendingRegistrations, "Applications awaiting review", "Submitted registrations need a league decision.", "applications", "amber"],
      [data.summary.pendingTransfers, "Transfers awaiting review", "Clearance decisions are blocking player movement.", "transfers", "amber"],
      [data.summary.openDispensations, "Eligibility exceptions", "Dispensation requests need a recorded decision.", "eligibility", "blue"],
      [data.summary.invalidTeamSheets, "Team sheets with failed checks", "Matchday selections contain ineligible players.", "matchday", "rose"],
    ].filter(([count]) => count > 0).map(([count, title, detail, target, tone]) => <button key={title} type="button" onClick={() => setTab(target)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${tone === "rose" ? "bg-rose-100 text-rose-700" : tone === "amber" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-700"}`}>{count}</span><span><span className="block text-sm font-black text-slate-950">{title}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{detail}</span></span></button>)}{data.summary.status === "ready" ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={30} /><div className="mt-3 text-sm font-black text-slate-900">Registration command queues are clear.</div></div> : null}</div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Control coverage</h3><div className="mt-5 space-y-4">{[
      ["Player register", data.players.length > 0, `${data.players.length} player records`],
      ["Competition rules", data.rules.length > 0, `${data.rules.length} active and historic rules`],
      ["Club workflow", true, "Applications, corrections, transfers and decisions"],
      ["Matchday eligibility", data.fixtures.length > 0, `${data.fixtures.length} published fixtures available`],
    ].map(([label, complete, detail]) => <div key={label} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">{complete ? <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} /> : <AlertTriangle className="mt-0.5 text-amber-600" size={18} />}<div><div className="text-sm font-black text-slate-950">{label}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div></div>)}</div></Panel></div></div> : null}

    {tab === "applications" ? <div className="space-y-5"><Panel className="p-5"><div className="grid gap-3 md:grid-cols-[1fr_190px_auto]"><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input className={`${INPUT} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player, club or team" /></div><select className={INPUT} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="open">Open applications</option><option value="approved">Approved</option><option value="closed">Closed</option><option value="all">All statuses</option>{REGISTRATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{data.access.canManage ? <button type="button" onClick={() => setShowRegistration(true)} className={`${BUTTON} bg-emerald-600 text-white`}><Plus size={14} /> New application</button> : null}</div></Panel><Panel className="overflow-hidden"><div className="divide-y divide-slate-100">{filteredRegistrations.map((registration) => { const player = playerById.get(registration.playerId); return <article key={registration.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><div className="text-lg font-black text-slate-950">{registration.playerName || player?.displayName}</div><Badge tone={statusTone(registration.status)}>{registration.status.replaceAll("_", " ")}</Badge></div><div className="mt-2 text-sm font-semibold text-slate-600">{registration.clubName} · {registration.teamName} · {registration.seasonName || currentSeason?.name}</div><div className="mt-2 text-xs font-semibold text-slate-500">DOB {dateLabel(player?.dateOfBirth)} · {registration.registrationType.replaceAll("_", " ")} · {dateLabel(registration.effectiveFrom)} to {dateLabel(registration.effectiveTo)}</div>{registration.correctionNotes || registration.decisionNotes ? <div className={`mt-3 rounded-xl p-3 text-xs font-semibold ${registration.status === "correction_required" || registration.status === "rejected" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-600"}`}>{registration.correctionNotes || registration.decisionNotes}</div> : null}</div>{data.access.canManage && ["submitted", "under_review", "correction_required"].includes(registration.status) ? <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => reviewRegistration(registration, "approved")} className={`${BUTTON} bg-emerald-600 text-white`}><CheckCircle2 size={14} /> Approve</button><button type="button" disabled={busy} onClick={() => reviewRegistration(registration, "correction_required")} className={`${BUTTON} bg-amber-400 text-slate-950`}><FileWarning size={14} /> Correction</button><button type="button" disabled={busy} onClick={() => reviewRegistration(registration, "rejected")} className={`${BUTTON} bg-slate-950 text-white`}><XCircle size={14} /> Reject</button></div> : null}</div></article>; })}{!filteredRegistrations.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No registrations match the selected filters.</div> : null}</div></Panel></div> : null}

    {tab === "players" ? <Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">League player register</h3><p className="mt-1 text-sm font-semibold text-slate-500">Date of birth and identifiers are restricted to authorised registration staff and the player’s club.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left"><thead><tr className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><th className="border-b px-4 py-3">Player</th><th className="border-b px-4 py-3">DOB</th><th className="border-b px-4 py-3">Current club</th><th className="border-b px-4 py-3">Team</th><th className="border-b px-4 py-3">Registration</th></tr></thead><tbody>{data.players.map((player) => { const registration = registrationByPlayer.get(player.id); return <tr key={player.id} className="text-sm font-semibold text-slate-700"><td className="border-b border-slate-100 px-4 py-3 font-black text-slate-950">{player.displayName}</td><td className="border-b border-slate-100 px-4 py-3">{dateLabel(player.dateOfBirth)}</td><td className="border-b border-slate-100 px-4 py-3">{registration?.clubName || "Unregistered"}</td><td className="border-b border-slate-100 px-4 py-3">{registration?.teamName || "—"}</td><td className="border-b border-slate-100 px-4 py-3"><Badge tone={statusTone(registration?.status || "none")}>{registration?.status?.replaceAll("_", " ") || "None"}</Badge></td></tr>; })}</tbody></table>{!data.players.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No player records have been created.</div> : null}</div></Panel> : null}

    {tab === "transfers" ? <Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4 sm:px-6"><h3 className="text-xl font-black text-slate-950">Transfer and clearance requests</h3></div><div className="divide-y divide-slate-100">{data.transfers.map((transfer) => <article key={transfer.id} className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-lg font-black text-slate-950">{transfer.playerName}</div><Badge tone={statusTone(transfer.status)}>{transfer.status.replaceAll("_", " ")}</Badge></div><div className="mt-2 text-sm font-semibold text-slate-600">{transfer.fromClubName || "No current club"} → {transfer.toClubName} · {transfer.toTeamName}</div><div className="mt-2 text-xs font-semibold text-slate-500">Requested {dateLabel(transfer.requestedOn)}{transfer.effectiveOn ? ` · Effective ${dateLabel(transfer.effectiveOn)}` : ""}</div>{transfer.reason ? <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{transfer.reason}</p> : null}</div>{data.access.canManage && ["submitted", "under_review"].includes(transfer.status) ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => reviewTransfer(transfer, "approved")} className={`${BUTTON} bg-emerald-600 text-white`}><CheckCircle2 size={14} /> Approve</button><button type="button" disabled={busy} onClick={() => reviewTransfer(transfer, "rejected")} className={`${BUTTON} bg-slate-950 text-white`}><XCircle size={14} /> Reject</button></div> : null}</div></article>)}{!data.transfers.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No transfer requests have been submitted.</div> : null}</div></Panel> : null}

    {tab === "eligibility" ? <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Add competition rule</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Rule name" className="sm:col-span-2"><input className={INPUT} value={ruleDraft.name} onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))} /></Field><Field label="Rule type"><select className={INPUT} value={ruleDraft.ruleType} onChange={(event) => setRuleDraft((current) => ({ ...current, ruleType: event.target.value, name: RULE_TYPES.find(([value]) => value === event.target.value)?.[1] || current.name, value: "" }))}>{RULE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Severity"><select className={INPUT} value={ruleDraft.severity} onChange={(event) => setRuleDraft((current) => ({ ...current, severity: event.target.value }))}><option value="block">Block selection</option><option value="warn">Warning only</option></select></Field><Field label="Season"><select className={INPUT} value={ruleDraft.seasonId} onChange={(event) => setRuleDraft((current) => ({ ...current, seasonId: event.target.value }))}><option value="">All seasons</option>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Division"><select className={INPUT} value={ruleDraft.divisionId} onChange={(event) => setRuleDraft((current) => ({ ...current, divisionId: event.target.value }))}><option value="">Whole league</option>{workspace.divisions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>{["minimum_age", "maximum_age"].includes(ruleDraft.ruleType) ? <Field label="Age"><input type="number" min="0" max="100" className={INPUT} value={ruleDraft.value} onChange={(event) => setRuleDraft((current) => ({ ...current, value: event.target.value }))} /></Field> : null}{ruleDraft.ruleType === "registration_deadline" ? <Field label="Deadline"><input type="date" className={INPUT} value={ruleDraft.value} onChange={(event) => setRuleDraft((current) => ({ ...current, value: event.target.value }))} /></Field> : null}</div>{data.access.canManage ? <button type="button" disabled={busy} onClick={saveRule} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><Plus size={14} /> Save rule</button> : null}<div className="mt-6 border-t border-slate-200 pt-5"><h4 className="text-sm font-black text-slate-950">Current rules</h4><div className="mt-3 space-y-2">{data.rules.map((rule) => <div key={rule.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><div className="text-sm font-black text-slate-950">{rule.name}</div><Badge tone={rule.severity === "block" ? "rose" : "amber"}>{rule.severity}</Badge></div><div className="mt-1 text-xs font-semibold text-slate-500">{rule.ruleType.replaceAll("_", " ")}{rule.config?.age !== undefined ? ` · age ${rule.config.age}` : ""}{rule.config?.deadline ? ` · ${dateLabel(rule.config.deadline)}` : ""}</div></div>)}{!data.rules.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No eligibility rules have been configured.</div> : null}</div></div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-black text-slate-950">Dispensations and exceptions</h3></div><div className="divide-y divide-slate-100">{data.dispensations.map((row) => <article key={row.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{row.playerName}</div><Badge tone={statusTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div><div className="mt-2 text-xs font-semibold text-slate-500">{row.teamName} · {row.ruleType.replaceAll("_", " ")} · {dateLabel(row.startsOn)} to {dateLabel(row.endsOn)}</div><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{row.reason}</p></div>{data.access.canManage && ["submitted", "under_review"].includes(row.status) ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => reviewDispensation(row, "approved")} className={`${BUTTON} bg-emerald-600 text-white`}>Approve</button><button type="button" disabled={busy} onClick={() => reviewDispensation(row, "rejected")} className={`${BUTTON} bg-slate-950 text-white`}>Reject</button></div> : null}</div></article>)}{!data.dispensations.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No dispensation requests have been submitted.</div> : null}</div></Panel></div> : null}

    {tab === "matchday" ? <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Build team sheet</h3><div className="mt-5 space-y-4"><Field label="Published fixture"><select className={INPUT} value={selectedFixtureId} onChange={(event) => setSelectedFixtureId(event.target.value)}><option value="">Select fixture</option>{data.fixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{dateLabel(fixture.scheduledDate)} · {fixture.homeTeamName} v {fixture.awayTeamName}</option>)}</select></Field><Field label="Team"><select className={INPUT} value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); setSelectedPlayerIds([]); }}><option value="">Select team</option>{fixtureTeamIds.map((teamId) => <option key={teamId} value={teamId}>{workspace.teams.find((row) => row.id === teamId)?.name || teamId}</option>)}</select></Field><div className="rounded-2xl border border-slate-200 p-4"><div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Selection</div><div className="mt-2 text-2xl font-black text-slate-950">{selectedPlayerIds.length}</div><div className="text-xs font-semibold text-slate-500">players selected</div></div><button type="button" disabled={busy || !selectedPlayerIds.length} onClick={saveTeamSheet} className={`${BUTTON} w-full bg-emerald-600 text-white`}><ListChecks size={14} /> Submit and validate</button></div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-black text-slate-950">Registered squad eligibility</h3><p className="mt-1 text-sm font-semibold text-slate-500">Checks registration status, dates, age rules, transfer clearance, suspensions and cup-tied history.</p></div><div className="divide-y divide-slate-100">{teamPlayers.map(({ player, assessment }) => <label key={player.id} className={`flex cursor-pointer items-start gap-4 p-5 ${assessment.status === "ineligible" ? "bg-rose-50/40" : "hover:bg-slate-50"}`}><input type="checkbox" className="mt-1" disabled={assessment.status === "ineligible"} checked={selectedPlayerIds.includes(player.id)} onChange={(event) => setSelectedPlayerIds((current) => event.target.checked ? [...current, player.id] : current.filter((id) => id !== player.id))} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-950">{player.displayName}</span><Badge tone={statusTone(assessment.status)}>{assessment.status}</Badge></span>{assessment.reasons.length || assessment.warnings.length ? <span className="mt-2 block text-xs font-semibold leading-5 text-slate-600">{[...assessment.reasons, ...assessment.warnings].map((row) => row.label).join(" · ")}</span> : <span className="mt-2 block text-xs font-semibold text-emerald-700">All configured checks passed.</span>}</span></label>)}{!teamPlayers.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">Choose a fixture and team to load its approved registrations.</div> : null}</div></Panel></div> : null}

    {tab === "reports" ? <div className="space-y-5"><Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black text-slate-950">Registration reporting pack</h3><p className="mt-1 text-sm font-semibold text-slate-500">Structured exports feed the dedicated League Analytics and Reports phase.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => downloadText("league-player-registrations.csv", leagueRegistrationsToCsv(data))} className={`${BUTTON} bg-slate-950 text-white`}><Download size={14} /> Registration register</button><button type="button" onClick={() => downloadText("league-eligibility-exceptions.csv", leagueEligibilityExceptionsToCsv(data))} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={14} /> Exceptions register</button></div></div></Panel><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Approval rate" value={`${data.registrations.length ? Math.round((data.summary.approvedRegistrations / data.registrations.length) * 100) : 0}%`} detail="All registration decisions" tone="green" Icon={CheckCircle2} /><Metric label="Corrections" value={data.summary.correctionRequired} detail="Club resubmissions required" tone={data.summary.correctionRequired ? "rose" : "green"} Icon={FileWarning} /><Metric label="Expiring" value={data.summary.expiringRegistrations} detail="Within the next 30 days" tone={data.summary.expiringRegistrations ? "amber" : "green"} Icon={CalendarClock} /><Metric label="Duplicate warnings" value={data.summary.duplicateWarnings} detail="Matching name and date of birth" tone={data.summary.duplicateWarnings ? "amber" : "green"} Icon={Users} /></div></div> : null}

    {showRegistration ? <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/65 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true"><Panel className="max-h-[94vh] w-full max-w-4xl overflow-y-auto p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Guided registration</div><h3 className="mt-2 text-2xl font-black text-slate-950">Create player application</h3><p className="mt-1 text-sm font-semibold text-slate-500">The player record and registration application are created together, then retained in the audit history.</p></div><button type="button" onClick={async () => { if (await confirmLeave()) setShowRegistration(false); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">Close</button></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="First name"><input className={INPUT} value={registrationDraft.firstName} onChange={(event) => setRegistrationDraft((current) => ({ ...current, firstName: event.target.value }))} /></Field><Field label="Last name"><input className={INPUT} value={registrationDraft.lastName} onChange={(event) => setRegistrationDraft((current) => ({ ...current, lastName: event.target.value }))} /></Field><Field label="Date of birth"><input type="date" className={INPUT} value={registrationDraft.dateOfBirth} onChange={(event) => setRegistrationDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} /></Field><Field label="Governing-body reference"><input className={INPUT} value={registrationDraft.externalRef} onChange={(event) => setRegistrationDraft((current) => ({ ...current, externalRef: event.target.value }))} placeholder="Optional" /></Field><Field label="Season"><select className={INPUT} value={registrationDraft.seasonId} onChange={(event) => setRegistrationDraft((current) => ({ ...current, seasonId: event.target.value }))}>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Registration type"><select className={INPUT} value={registrationDraft.registrationType} onChange={(event) => setRegistrationDraft((current) => ({ ...current, registrationType: event.target.value }))}><option value="new">New</option><option value="renewal">Renewal</option><option value="transfer">Transfer</option><option value="dual">Dual registration</option><option value="loan">Loan</option></select></Field><Field label="Club"><select className={INPUT} value={registrationDraft.parentClubId} onChange={(event) => setRegistrationDraft((current) => ({ ...current, parentClubId: event.target.value, teamId: "" }))}><option value="">Select club</option>{workspace.clubs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Team"><select className={INPUT} value={registrationDraft.teamId} onChange={(event) => setRegistrationDraft((current) => ({ ...current, teamId: event.target.value }))}><option value="">Select team</option>{workspace.teams.filter((row) => !registrationDraft.parentClubId || row.parentClubId === registrationDraft.parentClubId).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Effective from"><input type="date" className={INPUT} value={registrationDraft.effectiveFrom} onChange={(event) => setRegistrationDraft((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field><Field label="Effective to"><input type="date" className={INPUT} value={registrationDraft.effectiveTo} onChange={(event) => setRegistrationDraft((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field></div><div className="mt-7 flex justify-end gap-2"><button type="button" onClick={async () => { if (await confirmLeave()) setShowRegistration(false); }} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Cancel</button><button type="button" disabled={busy} onClick={createRegistration} className={`${BUTTON} bg-emerald-600 text-white`}><UserPlus size={14} /> Create application</button></div></Panel></div> : null}
  </div>;
}
