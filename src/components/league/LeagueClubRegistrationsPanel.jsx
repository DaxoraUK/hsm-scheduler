import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileWarning,
  Plus,
  RefreshCw,
  Send,
  Shirt,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { DB } from "../../lib/supabase.js";
import {
  assessLeaguePlayerEligibility,
  normaliseLeagueRegistrationData,
} from "../../lib/league/leagueRegistrationEngine.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["applications", "Applications", ClipboardCheck],
  ["new", "New registration", UserPlus],
  ["exceptions", "Eligibility requests", BadgeCheck],
  ["teamsheets", "Team sheets", Shirt],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Badge({ children, tone = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${styles[tone] || styles.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function statusTone(status) {
  if (["approved", "verified", "eligible"].includes(status)) return "green";
  if (["submitted", "under_review", "warning", "draft"].includes(status)) return "amber";
  if (["correction_required", "rejected", "failed", "ineligible"].includes(status)) return "rose";
  return "slate";
}

function dateLabel(value) {
  if (!value) return "Not set";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function emptyRegistration(data = {}) {
  const season = data.seasons?.find((row) => row.isCurrent) || data.seasons?.[0];
  return { firstName: "", lastName: "", dateOfBirth: "", externalRef: "", seasonId: season?.id || "", teamId: "", registrationType: "new", effectiveFrom: season?.startsOn || "", effectiveTo: season?.endsOn || "" };
}

export default function LeagueClubRegistrationsPanel({ leagueId }) {
  const [data, setData] = useState(() => normaliseLeagueRegistrationData({}));
  const [rawContext, setRawContext] = useState({ club: null, teams: [], seasons: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("applications");
  const [busy, setBusy] = useState(false);
  const [registrationDraft, setRegistrationDraft] = useState({ firstName: "", lastName: "", dateOfBirth: "", externalRef: "", seasonId: "", teamId: "", registrationType: "new", effectiveFrom: "", effectiveTo: "" });
  const [dispensationDraft, setDispensationDraft] = useState({ playerId: "", teamId: "", seasonId: "", ruleType: "maximum_age", startsOn: "", endsOn: "", reason: "" });
  const [selectedFixtureId, setSelectedFixtureId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const payload = await DB.getLeagueClubRegistrationData(leagueId);
      const next = normaliseLeagueRegistrationData(payload);
      setData(next);
      const context = {
        club: payload.club || null,
        teams: Array.isArray(payload.teams) ? payload.teams.map((row) => ({ ...row, id: row.id || "", parentClubId: row.parent_club_id || row.parentClubId || "" })) : [],
        seasons: Array.isArray(payload.seasons) ? payload.seasons.map((row) => ({ ...row, id: row.id || "", startsOn: row.starts_on || row.startsOn || "", endsOn: row.ends_on || row.endsOn || "", isCurrent: Boolean(row.is_current ?? row.isCurrent) })) : [],
      };
      setRawContext(context);
      setRegistrationDraft((current) => current.seasonId ? current : emptyRegistration(context));
      setDispensationDraft((current) => ({ ...current, seasonId: current.seasonId || context.seasons.find((row) => row.isCurrent)?.id || context.seasons[0]?.id || "" }));
      setSelectedFixtureId((current) => current && next.fixtures.some((row) => row.id === current) ? current : next.fixtures[0]?.id || "");
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "Club registrations could not be loaded.");
      setStatus("error");
    }
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);

  const playerById = useMemo(() => new Map(data.players.map((row) => [row.id, row])), [data.players]);
  const approvedRegistrations = useMemo(() => data.registrations.filter((row) => row.status === "approved"), [data.registrations]);
  const selectedFixture = useMemo(() => data.fixtures.find((row) => row.id === selectedFixtureId) || null, [data.fixtures, selectedFixtureId]);
  const fixtureTeamIds = useMemo(() => selectedFixture ? [selectedFixture.homeTeamId, selectedFixture.awayTeamId].filter((id) => rawContext.teams.some((team) => team.id === id)) : [], [rawContext.teams, selectedFixture]);
  useEffect(() => {
    setSelectedTeamId((current) => fixtureTeamIds.includes(current) ? current : fixtureTeamIds[0] || "");
    setSelectedPlayers([]);
  }, [selectedFixtureId, fixtureTeamIds.join("|")]);

  const eligibleRows = useMemo(() => approvedRegistrations.filter((row) => row.teamId === selectedTeamId).map((registration) => {
    const player = playerById.get(registration.playerId);
    return {
      player,
      registration,
      assessment: assessLeaguePlayerEligibility({
        player,
        registration,
        team: rawContext.teams.find((row) => row.id === selectedTeamId),
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
  }).filter((row) => row.player), [approvedRegistrations, data, playerById, rawContext.teams, selectedFixture, selectedTeamId]);

  const submitRegistration = async () => {
    if (!registrationDraft.firstName.trim() || !registrationDraft.lastName.trim() || !registrationDraft.dateOfBirth || !registrationDraft.teamId) { toast.error("Add the player, date of birth and team"); return; }
    setBusy(true);
    try {
      await DB.submitLeaguePlayerRegistration(leagueId, { ...registrationDraft, parentClubId: data.access.clubId });
      setRegistrationDraft(emptyRegistration(rawContext));
      setTab("applications");
      await load();
      toast.success("Registration submitted to the league");
    } catch (submitError) { toast.error("Registration could not be submitted", { description: submitError?.message }); }
    finally { setBusy(false); }
  };

  const resubmit = async (registration) => {
    const note = window.prompt("Tell the league what has been corrected:", "") || "";
    if (!note.trim()) return;
    setBusy(true);
    try {
      await DB.resubmitLeaguePlayerRegistration(leagueId, registration.id, note);
      await load();
      toast.success("Corrected application resubmitted");
    } catch (resubmitError) { toast.error("Application could not be resubmitted", { description: resubmitError?.message }); }
    finally { setBusy(false); }
  };

  const submitDispensation = async () => {
    if (!dispensationDraft.playerId || !dispensationDraft.teamId || dispensationDraft.reason.trim().length < 3) { toast.error("Select the player and add the reason"); return; }
    setBusy(true);
    try {
      await DB.submitLeagueEligibilityDispensation(leagueId, dispensationDraft);
      setDispensationDraft((current) => ({ ...current, playerId: "", teamId: "", reason: "" }));
      await load();
      toast.success("Eligibility request submitted");
    } catch (requestError) { toast.error("Eligibility request could not be submitted", { description: requestError?.message }); }
    finally { setBusy(false); }
  };

  const submitTeamSheet = async () => {
    if (!selectedFixture || !selectedTeamId || !selectedPlayers.length) { toast.error("Select at least one eligible player"); return; }
    setBusy(true);
    try {
      const result = await DB.saveLeagueTeamSheet(leagueId, {
        publicationFixtureId: selectedFixture.id,
        teamId: selectedTeamId,
        status: "submitted",
        players: selectedPlayers.map((playerId, index) => ({ playerId, registrationId: approvedRegistrations.find((row) => row.playerId === playerId && row.teamId === selectedTeamId)?.id || null, squadRole: index < 11 ? "starter" : "substitute", shirtNumber: index + 1 })),
      });
      await load();
      const invalid = Number(result?.invalid_count ?? result?.invalidCount ?? 0);
      if (invalid) toast.warning("Team sheet submitted with eligibility issues");
      else toast.success("Team sheet submitted");
    } catch (sheetError) { toast.error("Team sheet could not be submitted", { description: sheetError?.message }); }
    finally { setBusy(false); }
  };

  if (status === "loading") return <Panel className="flex min-h-[300px] items-center justify-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" /><div className="mt-3 text-sm font-black text-slate-800">Loading player registrations…</div></div></Panel>;
  if (status === "error") return <Panel className="p-6"><div className="flex gap-4"><AlertTriangle className="shrink-0 text-rose-600" /><div><h3 className="text-lg font-black text-slate-950">Registrations could not load</h3><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-4 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5">
    <Panel className="overflow-hidden"><div className="flex flex-col gap-4 bg-slate-950 px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Badge tone="green">Secure club access</Badge><Badge tone={data.summary.correctionRequired ? "rose" : data.summary.pendingRegistrations ? "amber" : "green"}>{data.summary.correctionRequired ? `${data.summary.correctionRequired} corrections` : `${data.summary.pendingRegistrations} pending`}</Badge></div><h2 className="mt-3 text-2xl font-black">Player registrations and team sheets</h2><p className="mt-1 text-sm font-semibold text-slate-300">Submit applications, respond to corrections and prove matchday eligibility.</p></div><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh</button></div><div className="overflow-x-auto p-2"><div className="flex min-w-max gap-2">{TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} />{label}</button>)}</div></div></Panel>

    {tab === "applications" ? <Panel className="overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h3 className="text-xl font-black text-slate-950">Club applications</h3><p className="mt-1 text-sm font-semibold text-slate-500">League decisions and correction requests remain attached to each registration.</p></div><button type="button" onClick={() => setTab("new")} className={`${BUTTON} bg-emerald-600 text-white`}><Plus size={14} /> New</button></div><div className="divide-y divide-slate-100">{data.registrations.map((row) => <article key={row.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-slate-950">{row.playerName || playerById.get(row.playerId)?.displayName}</div><Badge tone={statusTone(row.status)}>{row.status.replaceAll("_", " ")}</Badge></div><div className="mt-2 text-xs font-semibold text-slate-500">{row.teamName} · {row.registrationType.replaceAll("_", " ")} · {dateLabel(row.effectiveFrom)} to {dateLabel(row.effectiveTo)}</div>{row.correctionNotes || row.decisionNotes ? <div className={`mt-3 rounded-xl p-3 text-xs font-semibold ${row.status === "correction_required" || row.status === "rejected" ? "bg-rose-50 text-rose-800" : "bg-slate-50 text-slate-600"}`}>{row.correctionNotes || row.decisionNotes}</div> : null}</div>{row.status === "correction_required" && data.access.canSubmit ? <button type="button" disabled={busy} onClick={() => resubmit(row)} className={`${BUTTON} bg-amber-400 text-slate-950`}><FileWarning size={14} /> Resubmit correction</button> : null}</div></article>)}{!data.registrations.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No player applications have been submitted.</div> : null}</div></Panel> : null}

    {tab === "new" ? <Panel className="p-5 sm:p-6"><div className="flex items-start gap-3"><UserPlus className="mt-1 text-emerald-600" /><div><h3 className="text-xl font-black text-slate-950">Submit player registration</h3><p className="mt-1 text-sm font-semibold text-slate-500">Date of birth and identifiers are visible only to authorised league registration staff.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="First name"><input className={INPUT} value={registrationDraft.firstName} onChange={(event) => setRegistrationDraft((current) => ({ ...current, firstName: event.target.value }))} /></Field><Field label="Last name"><input className={INPUT} value={registrationDraft.lastName} onChange={(event) => setRegistrationDraft((current) => ({ ...current, lastName: event.target.value }))} /></Field><Field label="Date of birth"><input type="date" className={INPUT} value={registrationDraft.dateOfBirth} onChange={(event) => setRegistrationDraft((current) => ({ ...current, dateOfBirth: event.target.value }))} /></Field><Field label="Registration type"><select className={INPUT} value={registrationDraft.registrationType} onChange={(event) => setRegistrationDraft((current) => ({ ...current, registrationType: event.target.value }))}><option value="new">New</option><option value="renewal">Renewal</option><option value="transfer">Transfer</option><option value="dual">Dual registration</option><option value="loan">Loan</option></select></Field><Field label="Season"><select className={INPUT} value={registrationDraft.seasonId} onChange={(event) => setRegistrationDraft((current) => ({ ...current, seasonId: event.target.value }))}>{rawContext.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Team"><select className={INPUT} value={registrationDraft.teamId} onChange={(event) => setRegistrationDraft((current) => ({ ...current, teamId: event.target.value }))}><option value="">Select team</option>{rawContext.teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Effective from"><input type="date" className={INPUT} value={registrationDraft.effectiveFrom} onChange={(event) => setRegistrationDraft((current) => ({ ...current, effectiveFrom: event.target.value }))} /></Field><Field label="Effective to"><input type="date" className={INPUT} value={registrationDraft.effectiveTo} onChange={(event) => setRegistrationDraft((current) => ({ ...current, effectiveTo: event.target.value }))} /></Field><Field label="Governing-body reference"><input className={INPUT} value={registrationDraft.externalRef} onChange={(event) => setRegistrationDraft((current) => ({ ...current, externalRef: event.target.value }))} placeholder="Optional" /></Field></div><div className="mt-6 flex justify-end"><button type="button" disabled={busy || !data.access.canSubmit} onClick={submitRegistration} className={`${BUTTON} bg-emerald-600 text-white`}><Send size={14} /> Submit application</button></div></Panel> : null}

    {tab === "exceptions" ? <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Request dispensation</h3><div className="mt-5 space-y-4"><Field label="Player"><select className={INPUT} value={dispensationDraft.playerId} onChange={(event) => { const registration = approvedRegistrations.find((row) => row.playerId === event.target.value); setDispensationDraft((current) => ({ ...current, playerId: event.target.value, teamId: registration?.teamId || current.teamId })); }}><option value="">Select approved player</option>{approvedRegistrations.map((row) => <option key={row.playerId} value={row.playerId}>{row.playerName || playerById.get(row.playerId)?.displayName}</option>)}</select></Field><Field label="Team"><select className={INPUT} value={dispensationDraft.teamId} onChange={(event) => setDispensationDraft((current) => ({ ...current, teamId: event.target.value }))}><option value="">Select team</option>{rawContext.teams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Rule"><select className={INPUT} value={dispensationDraft.ruleType} onChange={(event) => setDispensationDraft((current) => ({ ...current, ruleType: event.target.value }))}><option value="minimum_age">Minimum age</option><option value="maximum_age">Maximum age</option><option value="registration_deadline">Registration deadline</option><option value="cup_tied">Cup tied</option><option value="transfer_clearance">Transfer clearance</option><option value="suspension">Suspension</option><option value="other">Other</option></select></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Starts"><input type="date" className={INPUT} value={dispensationDraft.startsOn} onChange={(event) => setDispensationDraft((current) => ({ ...current, startsOn: event.target.value }))} /></Field><Field label="Ends"><input type="date" className={INPUT} value={dispensationDraft.endsOn} onChange={(event) => setDispensationDraft((current) => ({ ...current, endsOn: event.target.value }))} /></Field></div><Field label="Reason"><textarea className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={dispensationDraft.reason} onChange={(event) => setDispensationDraft((current) => ({ ...current, reason: event.target.value }))} /></Field><button type="button" disabled={busy || !data.access.canSubmit} onClick={submitDispensation} className={`${BUTTON} w-full bg-slate-950 text-white`}><Send size={14} /> Submit request</button></div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-black text-slate-950">Eligibility decisions</h3></div><div className="divide-y divide-slate-100">{data.dispensations.map((row) => <article key={row.id} className="p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.playerName} · {row.ruleType.replaceAll("_", " ")}</div><div className="mt-1 text-xs font-semibold text-slate-500">{row.teamName} · {dateLabel(row.startsOn)} to {dateLabel(row.endsOn)}</div></div><Badge tone={statusTone(row.status)}>{row.status}</Badge></div><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{row.reason}</p>{row.decisionNotes ? <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">League decision: {row.decisionNotes}</div> : null}</article>)}{!data.dispensations.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No eligibility requests have been submitted.</div> : null}</div></Panel></div> : null}

    {tab === "teamsheets" ? <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Submit team sheet</h3><div className="mt-5 space-y-4"><Field label="Fixture"><select className={INPUT} value={selectedFixtureId} onChange={(event) => setSelectedFixtureId(event.target.value)}><option value="">Select fixture</option>{data.fixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{dateLabel(fixture.scheduledDate)} · {fixture.homeTeamName} v {fixture.awayTeamName}</option>)}</select></Field><Field label="Club team"><select className={INPUT} value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); setSelectedPlayers([]); }}><option value="">Select team</option>{fixtureTeamIds.map((teamId) => <option key={teamId} value={teamId}>{rawContext.teams.find((row) => row.id === teamId)?.name}</option>)}</select></Field><div className="rounded-2xl border border-slate-200 p-4"><div className="text-2xl font-black text-slate-950">{selectedPlayers.length}</div><div className="text-xs font-semibold text-slate-500">players selected</div></div><button type="button" disabled={busy || !selectedPlayers.length || !data.access.canSubmit} onClick={submitTeamSheet} className={`${BUTTON} w-full bg-emerald-600 text-white`}><Send size={14} /> Submit and validate</button></div></Panel><Panel className="overflow-hidden"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-black text-slate-950">Eligible squad</h3></div><div className="divide-y divide-slate-100">{eligibleRows.map(({ player, assessment }) => <label key={player.id} className={`flex items-start gap-4 p-5 ${assessment.status === "ineligible" ? "bg-rose-50/40" : "hover:bg-slate-50"}`}><input type="checkbox" className="mt-1" disabled={assessment.status === "ineligible"} checked={selectedPlayers.includes(player.id)} onChange={(event) => setSelectedPlayers((current) => event.target.checked ? [...current, player.id] : current.filter((id) => id !== player.id))} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-sm font-black text-slate-950">{player.displayName}</span><Badge tone={statusTone(assessment.status)}>{assessment.status}</Badge></span>{assessment.reasons.length || assessment.warnings.length ? <span className="mt-2 block text-xs font-semibold leading-5 text-slate-600">{[...assessment.reasons, ...assessment.warnings].map((row) => row.label).join(" · ")}</span> : <span className="mt-2 block text-xs font-semibold text-emerald-700"><CheckCircle2 className="mr-1 inline" size={13} />All checks passed</span>}</span></label>)}{!eligibleRows.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">Select a published fixture involving one of your teams.</div> : null}</div></Panel></div> : null}
  </div>;
}
