import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSearch,
  ListChecks,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Table2,
  Upload,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import { useDaxoraConfirm, useDaxoraPrompt } from "../../contexts/DaxoraInteractionContext.jsx";
import { usePersistedWorkspaceState } from "../../hooks/usePersistedWorkspaceState.js";
import {
  buildLeagueStandings,
  buildMissingResultQueue,
  normaliseLeagueResultsData,
  reconcileFullTimeResults,
  resultsToCsv,
} from "../../lib/league/leagueResultsEngine.js";
import { getCurrentLeagueSeason } from "../../lib/league/leagueManagerModel.js";

const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100";
const LABEL = "mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500";

const TABS = [
  ["command", "Result command", ListChecks],
  ["verified", "Verified results", ShieldCheck],
  ["tables", "League tables", Table2],
  ["adjustments", "Adjustments", MinusCircle],
  ["fulltime", "Full-Time results", FileSearch],
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
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className={LABEL}>{label}</span>{children}</label>;
}

function Metric({ label, value, detail, tone = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-slate-50",
    green: "border-emerald-200 bg-emerald-50",
    amber: "border-amber-200 bg-amber-50",
    rose: "border-rose-200 bg-rose-50",
    blue: "border-sky-200 bg-sky-50",
  };
  return <div className={`rounded-2xl border p-4 ${styles[tone] || styles.slate}`}><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div>{detail ? <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div> : null}</div>;
}

function dateLabel(value) {
  if (!value) return "Date TBC";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(value); }
}

function downloadText(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function fixtureLabel(fixture, workspace) {
  const teamName = (id) => workspace.teams.find((team) => team.id === id)?.name || "Team";
  return `${teamName(fixture.homeTeamId)} v ${teamName(fixture.awayTeamId)}`;
}

function competitionLabel(fixture, workspace) {
  if (fixture.competitionType === "cup") return workspace.cups.find((cup) => cup.id === (fixture.cupId || fixture.competitionId))?.name || "Cup";
  return workspace.divisions.find((division) => division.id === (fixture.divisionId || fixture.competitionId))?.name || "League";
}

function defaultResult(fixture = {}) {
  return {
    outcomeType: "played",
    homeScore: "",
    awayScore: "",
    homePenalties: "",
    awayPenalties: "",
    winnerTeamId: "",
    notes: "",
    publicationFixtureId: fixture.publicationFixtureId || "",
  };
}

function ResultEditor({ fixture, workspace, busy, onCancel, onSave, title = "Record result" }) {
  const [form, setForm] = useState(() => defaultResult(fixture));
  const isPlayed = form.outcomeType === "played";
  const scoreReady = !isPlayed || (form.homeScore !== "" && form.awayScore !== "");
  const tiedCup = fixture.competitionType === "cup" && isPlayed && form.homeScore !== "" && form.awayScore !== "" && Number(form.homeScore) === Number(form.awayScore);
  const ready = scoreReady && (!tiedCup || Boolean(form.winnerTeamId));
  const teamName = (id) => workspace.teams.find((team) => team.id === id)?.name || "Team";

  return <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
    <Panel className="max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{title}</div><h3 className="mt-2 text-xl font-black text-slate-950">{fixtureLabel(fixture, workspace)}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{competitionLabel(fixture, workspace)} · {dateLabel(fixture.scheduledDate)}</p></div><button type="button" onClick={onCancel} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Close</button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Outcome"><select className={INPUT} value={form.outcomeType} onChange={(event) => setForm((current) => ({ ...current, outcomeType: event.target.value }))}><option value="played">Played</option><option value="home_walkover">Home walkover</option><option value="away_walkover">Away walkover</option><option value="abandoned">Abandoned</option><option value="void">Void</option></select></Field>
        <div />
        {isPlayed ? <><Field label={`${teamName(fixture.homeTeamId)} score`}><input aria-label="Home score" type="number" min="0" max="99" className={INPUT} value={form.homeScore} onChange={(event) => setForm((current) => ({ ...current, homeScore: event.target.value }))} /></Field><Field label={`${teamName(fixture.awayTeamId)} score`}><input aria-label="Away score" type="number" min="0" max="99" className={INPUT} value={form.awayScore} onChange={(event) => setForm((current) => ({ ...current, awayScore: event.target.value }))} /></Field></> : null}
        {tiedCup ? <><Field label="Home penalties"><input type="number" min="0" max="99" className={INPUT} value={form.homePenalties} onChange={(event) => setForm((current) => ({ ...current, homePenalties: event.target.value }))} /></Field><Field label="Away penalties"><input type="number" min="0" max="99" className={INPUT} value={form.awayPenalties} onChange={(event) => setForm((current) => ({ ...current, awayPenalties: event.target.value }))} /></Field><Field label="Team progressing" className="sm:col-span-2"><select className={INPUT} value={form.winnerTeamId} onChange={(event) => setForm((current) => ({ ...current, winnerTeamId: event.target.value }))}><option value="">Select the progressing team</option><option value={fixture.homeTeamId}>{teamName(fixture.homeTeamId)}</option><option value={fixture.awayTeamId}>{teamName(fixture.awayTeamId)}</option></select></Field></> : null}
        <Field label="Notes" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional league note, walkover reason or abandonment details." /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onCancel} className={`${BUTTON} border border-slate-200 bg-white text-slate-700`}>Cancel</button><button type="button" disabled={busy || !ready} onClick={() => onSave(form)} className={`${BUTTON} bg-emerald-600 text-white`}><Save size={14} /> Save result</button></div>
    </Panel>
  </div>;
}

export default function LeagueResultsWorkspace({ leagueId, workspace, initialTab = "command", focusToken = 0 }) {
  const daxoraConfirm = useDaxoraConfirm();
  const daxoraPrompt = useDaxoraPrompt();
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(() => normaliseLeagueResultsData({}));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resultFixture, setResultFixture] = useState(null);
  const [divisionFilter, setDivisionFilter] = usePersistedWorkspaceState(`daxora:league:${leagueId}:results-division-filter`, "all");
  const [tableDivisionId, setTableDivisionId] = usePersistedWorkspaceState(`daxora:league:${leagueId}:table-division`, "");
  const [adjustment, setAdjustment] = useState({ divisionId: "", teamId: "", pointsDelta: "", goalsForDelta: "", goalsAgainstDelta: "", effectiveOn: new Date().toISOString().slice(0, 10), reason: "" });
  const [fullTimeCsv, setFullTimeCsv] = useState("");
  const [reconciliation, setReconciliation] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(normaliseLeagueResultsData(await DB.getLeagueResultsData(leagueId))); }
    catch (loadError) { setError(loadError?.message || "Results workspace could not be loaded"); }
    finally { setLoading(false); }
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (TABS.some(([key]) => key === initialTab)) setTab(initialTab); }, [initialTab, focusToken]);

  const season = getCurrentLeagueSeason(workspace);
  const missing = useMemo(() => buildMissingResultQueue(data.publishedFixtures, data.results), [data.publishedFixtures, data.results]);
  const filteredMissing = useMemo(() => missing.filter((fixture) => divisionFilter === "all" || fixture.divisionId === divisionFilter || fixture.competitionId === divisionFilter), [missing, divisionFilter]);
  const pending = useMemo(() => data.submissions.filter((submission) => submission.status === "submitted"), [data.submissions]);
  const standings = useMemo(() => buildLeagueStandings({ divisions: workspace.divisions, teams: workspace.teams, results: data.results, adjustments: data.adjustments }), [workspace.divisions, workspace.teams, data.results, data.adjustments]);
  const selectedTable = standings.find((group) => group.division.id === tableDivisionId) || standings[0] || null;
  const activeAdjustments = data.adjustments.filter((row) => row.status === "active");
  const cupResults = data.results.filter((row) => row.competitionType === "cup");

  useEffect(() => {
    if (!tableDivisionId && standings[0]?.division?.id) setTableDivisionId(standings[0].division.id);
  }, [standings, tableDivisionId]);

  const saveDirectResult = async (form, fixture = resultFixture, source = "league_entry") => {
    if (!fixture) return;
    setBusy(true);
    try {
      await DB.recordLeagueFixtureResult(leagueId, fixture.publicationFixtureId, form, source);
      setResultFixture(null);
      await load();
      toast.success("Result verified and tables updated");
    } catch (saveError) { toast.error("Result could not be saved", { description: saveError?.message }); }
    finally { setBusy(false); }
  };

  const reviewSubmission = async (submission, decision) => {
    const notes = decision === "reject" ? await daxoraPrompt({ title: "Reject submitted result", description: "Explain what the club must correct before resubmitting.", label: "Rejection reason", confirmLabel: "Reject result", required: true, minLength: 3, multiline: true }) : "";
    if (decision === "reject" && (notes === null || notes.trim().length < 3)) return;
    setBusy(true);
    try { await DB.reviewLeagueResultSubmission(leagueId, submission.id, decision, notes); await load(); toast.success(decision === "verify" ? "Result verified" : "Result rejected"); }
    catch (reviewError) { toast.error("Result review failed", { description: reviewError?.message }); }
    finally { setBusy(false); }
  };

  const saveAdjustment = async () => {
    if (!season?.id || !adjustment.divisionId || !adjustment.teamId || adjustment.reason.trim().length < 3) { toast.error("Choose a division and team, then add a reason"); return; }
    setBusy(true);
    try {
      await DB.upsertLeagueTableAdjustment(leagueId, { ...adjustment, seasonId: season.id });
      setAdjustment({ divisionId: adjustment.divisionId, teamId: "", pointsDelta: "", goalsForDelta: "", goalsAgainstDelta: "", effectiveOn: new Date().toISOString().slice(0, 10), reason: "" });
      await load(); toast.success("Table adjustment applied");
    } catch (adjustmentError) { toast.error("Adjustment could not be saved", { description: adjustmentError?.message }); }
    finally { setBusy(false); }
  };

  const revokeAdjustment = async (row) => {
    if (!(await daxoraConfirm({ title: "Revoke table adjustment?", description: "The points or goals adjustment will stop affecting the table. Its audit record will remain.", confirmLabel: "Revoke adjustment", tone: "danger" }))) return;
    setBusy(true);
    try { await DB.revokeLeagueTableAdjustment(leagueId, row.id); await load(); toast.success("Adjustment revoked"); }
    catch (revokeError) { toast.error("Adjustment could not be revoked", { description: revokeError?.message }); }
    finally { setBusy(false); }
  };

  const compareFullTime = () => {
    const next = reconcileFullTimeResults(fullTimeCsv, data.publishedFixtures, data.results, workspace);
    setReconciliation(next);
    if (next.errors.length) toast.error("Some Full-Time rows could not be read");
    else toast.success("Full-Time results compared");
  };

  const importFullTimeRows = async () => {
    const rows = reconciliation?.matched?.filter((row) => row.status === "new") || [];
    if (!rows.length) return;
    setBusy(true);
    try {
      for (const row of rows) {
        await DB.recordLeagueFixtureResult(leagueId, row.fixture.publicationFixtureId, { outcomeType: "played", homeScore: row.homeScore, awayScore: row.awayScore }, "full_time_import");
      }
      await load();
      setReconciliation(null); setFullTimeCsv("");
      toast.success(`${rows.length} Full-Time result${rows.length === 1 ? "" : "s"} verified`);
    } catch (importError) { toast.error("Full-Time import stopped", { description: importError?.message }); }
    finally { setBusy(false); }
  };

  if (loading) return <Panel className="p-10 text-center"><RefreshCw className="mx-auto animate-spin text-emerald-600" /><div className="mt-3 text-sm font-black text-slate-900">Loading results and tables…</div></Panel>;
  if (error) return <Panel className="p-7"><div className="flex items-start gap-4"><AlertTriangle className="shrink-0 text-rose-600" /><div><h2 className="text-xl font-black text-slate-950">Results could not be loaded</h2><p className="mt-2 text-sm font-semibold text-slate-600">{error}</p><button type="button" onClick={load} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><RefreshCw size={14} /> Retry</button></div></div></Panel>;

  return <div className="space-y-5">
    <Panel className="overflow-hidden"><div className="grid gap-5 bg-slate-950 px-6 py-7 text-white lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><Badge tone="green">League Operations v3.4</Badge><Badge tone="navy">Results control</Badge></div><h2 className="mt-4 text-3xl font-black tracking-tight">Results, tables and cup progression</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Collect club submissions, verify the official result, maintain auditable standings and keep Full-Time aligned.</p></div><button type="button" onClick={load} className={`${BUTTON} border border-white/15 bg-white/10 text-white`}><RefreshCw size={14} /> Refresh</button></div></Panel>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Missing results" value={missing.length} detail="Played published fixtures" tone={missing.length ? "rose" : "green"} /><Metric label="Awaiting verification" value={pending.length} detail="Club submissions" tone={pending.length ? "amber" : "green"} /><Metric label="Verified" value={data.results.length} detail="Official result register" tone="green" /><Metric label="Table adjustments" value={activeAdjustments.length} detail="Active deductions or corrections" tone={activeAdjustments.length ? "blue" : "slate"} /><Metric label="Cup results" value={cupResults.length} detail="Winners progressed" tone="blue" /></div>

    <nav className="grid grid-cols-2 gap-2 rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-5">{TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-xs font-black ${tab === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Icon size={15} className={tab === key ? "text-emerald-300" : "text-slate-400"} />{label}{key === "command" && (missing.length + pending.length) ? <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white">{missing.length + pending.length}</span> : null}</button>)}</nav>

    {tab === "command" ? <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">Club verification queue</h3><p className="mt-1 text-sm font-semibold text-slate-500">A club submission does not change a table until the league verifies it.</p></div><Badge tone={pending.length ? "amber" : "green"}>{pending.length} pending</Badge></div><div className="mt-5 space-y-3">{pending.length ? pending.map((submission) => <div key={submission.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{fixtureLabel(submission, workspace)}</div><div className="mt-1 text-xs font-semibold text-slate-600">{competitionLabel(submission, workspace)} · {submission.outcomeType.replaceAll("_", " ")} · {submission.homeScore ?? "—"}–{submission.awayScore ?? "—"}</div></div><Badge tone="amber">Submitted</Badge></div>{submission.notes ? <p className="mt-3 text-sm font-semibold text-slate-700">{submission.notes}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => reviewSubmission(submission, "verify")} className={`${BUTTON} bg-emerald-600 text-white`}><ClipboardCheck size={14} /> Verify</button><button type="button" disabled={busy} onClick={() => reviewSubmission(submission, "reject")} className={`${BUTTON} border border-rose-200 bg-white text-rose-700`}>Reject</button></div></div>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" /><div className="mt-3 text-sm font-black text-emerald-900">No club results are waiting for verification.</div></div>}</div></Panel>
      <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-xl font-black text-slate-950">Missing-result command queue</h3><p className="mt-1 text-sm font-semibold text-slate-500">Published fixtures on or before today with no verified result.</p></div><select aria-label="Filter missing results by division" className={`${INPUT} sm:w-52`} value={divisionFilter} onChange={(event) => setDivisionFilter(event.target.value)}><option value="all">All competitions</option>{workspace.divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></div><div className="mt-5 max-h-[620px] space-y-2 overflow-y-auto pr-1">{filteredMissing.length ? filteredMissing.map((fixture) => <div key={fixture.publicationFixtureId || fixture.targetId} className="grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="text-sm font-black text-slate-950">{fixtureLabel(fixture, workspace)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{dateLabel(fixture.scheduledDate)} · {String(fixture.kickOff || "TBC").slice(0, 5)} · {competitionLabel(fixture, workspace)}</div></div><button type="button" disabled={busy || !data.access.canManageResults} onClick={() => setResultFixture(fixture)} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Result</button></div>) : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-600" /><div className="mt-3 text-sm font-black text-emerald-900">Every played published fixture has a verified result.</div></div>}</div></Panel>
    </div> : null}

    {tab === "verified" ? <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-slate-950">Official result register</h3><p className="mt-1 text-sm font-semibold text-slate-500">Verified results, walkovers, abandoned games and void records remain auditable.</p></div><button type="button" onClick={() => downloadText("league-results.csv", resultsToCsv(data.results, workspace))} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={14} /> Export CSV</button></div><div className="mt-5 overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left"><thead><tr className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500"><th className="border-b border-slate-200 px-3 py-3">Date</th><th className="border-b border-slate-200 px-3 py-3">Competition</th><th className="border-b border-slate-200 px-3 py-3">Fixture</th><th className="border-b border-slate-200 px-3 py-3">Result</th><th className="border-b border-slate-200 px-3 py-3">Source</th></tr></thead><tbody>{data.results.map((result) => <tr key={result.id} className="text-sm font-semibold text-slate-700"><td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{dateLabel(result.scheduledDate)}</td><td className="border-b border-slate-100 px-3 py-3">{competitionLabel(result, workspace)}</td><td className="border-b border-slate-100 px-3 py-3 font-black text-slate-950">{fixtureLabel(result, workspace)}</td><td className="border-b border-slate-100 px-3 py-3"><Badge tone={result.outcomeType === "void" ? "slate" : result.outcomeType === "abandoned" ? "amber" : "green"}>{["played", "home_walkover", "away_walkover"].includes(result.outcomeType) ? `${result.homeScore}–${result.awayScore}` : result.outcomeType.replaceAll("_", " ")}</Badge></td><td className="border-b border-slate-100 px-3 py-3 text-xs">{String(result.source || "league_entry").replaceAll("_", " ")}</td></tr>)}</tbody></table>{!data.results.length ? <div className="p-10 text-center text-sm font-bold text-slate-500">No results have been verified yet.</div> : null}</div></Panel> : null}

    {tab === "tables" ? <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-xl font-black text-slate-950">Live league tables</h3><p className="mt-1 text-sm font-semibold text-slate-500">Calculated from verified league results and active adjustments only.</p></div><select className={`${INPUT} sm:w-64`} value={selectedTable?.division?.id || ""} onChange={(event) => setTableDivisionId(event.target.value)}>{standings.map((group) => <option key={group.division.id} value={group.division.id}>{group.division.name}</option>)}</select></div>{selectedTable ? <div className="mt-5 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><th className="rounded-l-xl px-3 py-3 text-left">Pos</th><th className="px-3 py-3 text-left">Team</th>{["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((label) => <th key={label} className={`px-3 py-3 text-center ${label === "Pts" ? "rounded-r-xl" : ""}`}>{label}</th>)}</tr></thead><tbody>{selectedTable.standings.map((row) => <tr key={row.teamId} className="border-b border-slate-100 font-bold text-slate-700"><td className="px-3 py-3 text-slate-500">{row.position}</td><td className="px-3 py-3 font-black text-slate-950">{row.teamName}{row.adjustments ? <span className="ml-2 text-[10px] text-amber-700">({row.adjustments > 0 ? "+" : ""}{row.adjustments} adj.)</span> : null}</td><td className="px-3 py-3 text-center">{row.played}</td><td className="px-3 py-3 text-center">{row.won}</td><td className="px-3 py-3 text-center">{row.drawn}</td><td className="px-3 py-3 text-center">{row.lost}</td><td className="px-3 py-3 text-center">{row.goalsFor}</td><td className="px-3 py-3 text-center">{row.goalsAgainst}</td><td className="px-3 py-3 text-center">{row.goalDifference}</td><td className="px-3 py-3 text-center text-base font-black text-slate-950">{row.points}</td></tr>)}</tbody></table><div className="mt-4 text-xs font-semibold text-slate-500">Rules: {selectedTable.division.winPoints ?? 3} points for a win · {selectedTable.division.drawPoints ?? 1} for a draw · {selectedTable.division.lossPoints ?? 0} for a loss.</div></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">Add divisions and teams to calculate standings.</div>}</Panel> : null}

    {tab === "adjustments" ? <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]"><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Apply table adjustment</h3><p className="mt-1 text-sm font-semibold text-slate-500">Use for deductions, appeals, corrections or administrative awards. The reason is mandatory.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Division" className="sm:col-span-2"><select className={INPUT} value={adjustment.divisionId} onChange={(event) => setAdjustment((current) => ({ ...current, divisionId: event.target.value, teamId: "" }))}><option value="">Select division</option>{workspace.divisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></Field><Field label="Team" className="sm:col-span-2"><select className={INPUT} value={adjustment.teamId} onChange={(event) => setAdjustment((current) => ({ ...current, teamId: event.target.value }))}><option value="">Select team</option>{workspace.teams.filter((team) => team.divisionId === adjustment.divisionId).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></Field><Field label="Points"><input type="number" className={INPUT} value={adjustment.pointsDelta} onChange={(event) => setAdjustment((current) => ({ ...current, pointsDelta: event.target.value }))} placeholder="-3" /></Field><Field label="Effective date"><input type="date" className={INPUT} value={adjustment.effectiveOn} onChange={(event) => setAdjustment((current) => ({ ...current, effectiveOn: event.target.value }))} /></Field><Field label="Goals for"><input type="number" className={INPUT} value={adjustment.goalsForDelta} onChange={(event) => setAdjustment((current) => ({ ...current, goalsForDelta: event.target.value }))} /></Field><Field label="Goals against"><input type="number" className={INPUT} value={adjustment.goalsAgainstDelta} onChange={(event) => setAdjustment((current) => ({ ...current, goalsAgainstDelta: event.target.value }))} /></Field><Field label="Reason" className="sm:col-span-2"><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" value={adjustment.reason} onChange={(event) => setAdjustment((current) => ({ ...current, reason: event.target.value }))} /></Field></div><button type="button" disabled={busy || !data.access.canManageResults} onClick={saveAdjustment} className={`${BUTTON} mt-5 bg-slate-950 text-white`}><Save size={14} /> Apply adjustment</button></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Adjustment register</h3><div className="mt-5 space-y-3">{data.adjustments.length ? data.adjustments.map((row) => <div key={row.id} className={`rounded-2xl border p-4 ${row.status === "active" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{workspace.teams.find((team) => team.id === row.teamId)?.name || "Team"}</div><div className="mt-1 text-xs font-semibold text-slate-600">{row.pointsDelta > 0 ? "+" : ""}{row.pointsDelta} points · Effective {dateLabel(row.effectiveOn)}</div></div><div className="flex items-center gap-2"><Badge tone={row.status === "active" ? "amber" : "slate"}>{row.status}</Badge>{row.status === "active" ? <button type="button" disabled={busy} onClick={() => revokeAdjustment(row)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-700" aria-label="Revoke adjustment"><RotateCcw size={14} /></button> : null}</div></div><p className="mt-3 text-sm font-semibold text-slate-700">{row.reason}</p></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">No table adjustments have been recorded.</div>}</div></Panel></div> : null}

    {tab === "fulltime" ? <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]"><Panel className="p-5 sm:p-6"><div className="flex items-center gap-3"><Upload className="text-emerald-600" /><div><h3 className="text-xl font-black text-slate-950">Full-Time result reconciliation</h3><p className="text-sm font-semibold text-slate-500">Paste or upload a results CSV. Nothing is imported until you review the comparison.</p></div></div><textarea className="mt-5 min-h-72 w-full rounded-2xl border border-slate-200 p-4 font-mono text-xs outline-none focus:border-emerald-500" value={fullTimeCsv} onChange={(event) => { setFullTimeCsv(event.target.value); setReconciliation(null); }} placeholder="Date,Home Team,Home Score,Away Score,Away Team&#10;15/08/2026,Club One,2,1,Club Two" /><div className="mt-4 flex flex-wrap gap-2"><label className={`${BUTTON} cursor-pointer border border-slate-200 bg-white text-slate-800`}><Upload size={14} /> Choose CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { setFullTimeCsv(await file.text()); setReconciliation(null); } }} /></label><button type="button" disabled={!fullTimeCsv.trim()} onClick={compareFullTime} className={`${BUTTON} bg-slate-950 text-white`}><FileSearch size={14} /> Compare</button></div></Panel><Panel className="p-5 sm:p-6"><h3 className="text-xl font-black text-slate-950">Comparison</h3>{reconciliation ? <div className="mt-5 space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="New matches" value={reconciliation.matched.filter((row) => row.status === "new").length} tone="green" /><Metric label="Same" value={reconciliation.matched.filter((row) => row.status === "same").length} /><Metric label="Different" value={reconciliation.differences.length} tone={reconciliation.differences.length ? "amber" : "green"} /><Metric label="Unmatched" value={reconciliation.unmatched.length} tone={reconciliation.unmatched.length ? "rose" : "green"} /></div>{reconciliation.errors.length ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{reconciliation.errors.join(" ")}</div> : null}{reconciliation.differences.length ? <div><div className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">Score differences</div><div className="mt-2 space-y-2">{reconciliation.differences.slice(0, 20).map((row) => <div key={`${row.date}-${row.homeTeam}-${row.awayTeam}`} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold"><strong>{row.homeTeam} v {row.awayTeam}</strong><div className="mt-1 text-xs">Full-Time {row.homeScore}–{row.awayScore} · League Manager {row.recorded.homeScore}–{row.recorded.awayScore}</div></div>)}</div></div> : null}<button type="button" disabled={busy || !reconciliation.matched.some((row) => row.status === "new")} onClick={importFullTimeRows} className={`${BUTTON} bg-emerald-600 text-white`}><ClipboardCheck size={14} /> Verify new matched results</button></div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">Add a Full-Time result export to see matches, differences and unmatched rows.</div>}</Panel></div> : null}

    {resultFixture ? <ResultEditor fixture={resultFixture} workspace={workspace} busy={busy} onCancel={() => setResultFixture(null)} onSave={saveDirectResult} /> : null}
  </div>;
}
