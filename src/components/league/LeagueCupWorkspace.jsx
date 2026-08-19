import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
  Save,
  Shuffle,
  Trash2,
  Trophy,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";
import {
  buildCupOpeningRound,
  buildNextCupRound,
  cupTiesToCsv,
  findCupLeagueConflicts,
  getCupEligibleTeams,
  prepareLeagueRebalanceForCups,
} from "../../lib/league/leagueCupEngine.js";
import {
  generateLeagueSchedule,
  normaliseScheduleVersionPayload,
  serialiseScheduleEntries,
  validateLeagueSchedule,
} from "../../lib/league/leagueSchedulingEngine.js";
import { getCurrentLeagueSeason } from "../../lib/league/leagueManagerModel.js";
import { useDaxoraConfirm } from "../../contexts/DaxoraInteractionContext.jsx";

const INPUT = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-500";
const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50";
const SECTIONS = [
  ["setup", "Cup setup"],
  ["eligibility", "Teams"],
  ["draw", "Draw & rounds"],
  ["results", "Results"],
  ["impact", "League impact"],
];

function Panel({ children, className = "" }) {
  return <section className={`rounded-[26px] border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

function Field({ label, children, className = "" }) {
  return <label className={className}><span className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>{children}</label>;
}

function downloadText(filename, value) {
  const blob = new Blob([value], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function cupDraft(season) {
  return {
    id: "",
    seasonId: season?.id || "",
    name: "",
    code: "",
    startsOn: season?.startsOn || "",
    defaultKickOff: "",
    finalDate: "",
    finalVenueId: "",
    drawMode: "random",
    roundIntervalDays: 14,
    sameClubAvoidUntilRound: 1,
    status: "draft",
  };
}

function serialiseCup(draft) {
  return {
    ...(draft.id ? { id: draft.id } : {}),
    season_id: draft.seasonId,
    name: String(draft.name || "").trim(),
    code: String(draft.code || "").trim(),
    starts_on: draft.startsOn,
    default_kick_off: draft.defaultKickOff || null,
    final_date: draft.finalDate || null,
    final_venue_id: draft.finalVenueId || null,
    draw_mode: draft.drawMode || "random",
    round_interval_days: Number(draft.roundIntervalDays || 14),
    same_club_avoid_until_round: Number(draft.sameClubAvoidUntilRound || 0),
    status: draft.status || "draft",
  };
}


function CupList({ cups, selectedCupId, onSelect, onCreate }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Competitions</div><div className="mt-1 text-lg font-black text-slate-950">{cups.length} cup{cups.length === 1 ? "" : "s"}</div></div>
        <button type="button" onClick={onCreate} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Plus size={17} /></button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {cups.map((cup) => (
          <button key={cup.id} type="button" onClick={() => onSelect(cup.id)} className={`rounded-2xl border p-3 text-left transition ${selectedCupId === cup.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-black">{cup.name}</div><div className={`mt-1 text-xs font-semibold ${selectedCupId === cup.id ? "text-slate-300" : "text-slate-500"}`}>{cup.startsOn || "Start date not set"}</div></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${selectedCupId === cup.id ? "bg-white/10 text-white" : "bg-emerald-50 text-emerald-700"}`}>{cup.status}</span></div>
          </button>
        ))}
        {!cups.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm font-bold text-slate-500">Create the league's first cup competition.</div> : null}
      </div>
    </Panel>
  );
}

export default function LeagueCupWorkspace({ leagueId, workspace, canOperate, onWorkspaceRefresh }) {
  const daxoraConfirm = useDaxoraConfirm();
  const season = getCurrentLeagueSeason(workspace);
  const cups = useMemo(() => workspace.cups.filter((cup) => !season || cup.seasonId === season.id), [season, workspace.cups]);
  const [selectedCupId, setSelectedCupId] = useState(cups[0]?.id || "new");
  const selectedCup = cups.find((cup) => cup.id === selectedCupId) || null;
  const [draft, setDraft] = useState(() => selectedCup ? { ...selectedCup } : cupDraft(season));
  const [section, setSection] = useState("setup");
  const [busy, setBusy] = useState(false);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [includedTeamIds, setIncludedTeamIds] = useState([]);
  const [excludedTeamIds, setExcludedTeamIds] = useState([]);
  const [drawDate, setDrawDate] = useState(selectedCup?.startsOn || season?.startsOn || "");
  const [resultEdits, setResultEdits] = useState({});
  const [tieEdits, setTieEdits] = useState({});

  useEffect(() => {
    if (!selectedCup) {
      setDraft(cupDraft(season));
      setSelectedDivisionIds([]);
      setIncludedTeamIds([]);
      setExcludedTeamIds([]);
      return;
    }
    setDraft({ ...selectedCup });
    setDrawDate(selectedCup.startsOn || season?.startsOn || "");
    setSelectedDivisionIds(workspace.cupDivisions.filter((row) => row.cupId === selectedCup.id).map((row) => row.divisionId));
    setIncludedTeamIds(workspace.cupTeamOverrides.filter((row) => row.cupId === selectedCup.id && row.included).map((row) => row.teamId));
    setExcludedTeamIds(workspace.cupTeamOverrides.filter((row) => row.cupId === selectedCup.id && !row.included).map((row) => row.teamId));
  }, [season, selectedCup, workspace.cupDivisions, workspace.cupTeamOverrides]);

  useEffect(() => {
    if (selectedCupId !== "new" && cups.some((cup) => cup.id === selectedCupId)) return;
    if (selectedCupId === "new") return;
    setSelectedCupId(cups[0]?.id || "new");
  }, [cups, selectedCupId]);

  const eligibilityCupId = selectedCup?.id || "new";
  const cupForEligibility = selectedCup || { ...draft, id: eligibilityCupId };
  const derivedWorkspace = useMemo(() => ({
    ...workspace,
    cups: [...workspace.cups.filter((cup) => cup.id !== eligibilityCupId), cupForEligibility],
    cupDivisions: [
      ...workspace.cupDivisions.filter((row) => row.cupId !== eligibilityCupId),
      ...selectedDivisionIds.map((divisionId) => ({ cupId: eligibilityCupId, divisionId })),
    ],
    cupTeamOverrides: [
      ...workspace.cupTeamOverrides.filter((row) => row.cupId !== eligibilityCupId),
      ...includedTeamIds.map((teamId) => ({ cupId: eligibilityCupId, teamId, included: true })),
      ...excludedTeamIds.map((teamId) => ({ cupId: eligibilityCupId, teamId, included: false })),
    ],
  }), [cupForEligibility, eligibilityCupId, excludedTeamIds, includedTeamIds, selectedDivisionIds, workspace]);
  const eligibleTeams = getCupEligibleTeams(derivedWorkspace, eligibilityCupId);
  const rounds = workspace.cupRounds.filter((row) => row.cupId === selectedCup?.id).sort((a, b) => a.roundNumber - b.roundNumber);
  const ties = workspace.cupTies.filter((row) => row.cupId === selectedCup?.id).sort((a, b) => a.roundNumber - b.roundNumber || a.tieNumber - b.tieNumber);
  const latestRound = rounds.at(-1) || null;
  const latestRoundTies = latestRound ? ties.filter((tie) => tie.cupRoundId === latestRound.id || tie.roundNumber === latestRound.roundNumber) : [];

  const updateDraft = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));

  const saveCup = async () => {
    if (!draft.name.trim() || !draft.startsOn || !draft.seasonId) {
      toast.error("Add the cup name, season and start date");
      return;
    }
    setBusy(true);
    try {
      const cupId = await DB.upsertLeagueCup(leagueId, serialiseCup(draft));
      await onWorkspaceRefresh?.();
      setSelectedCupId(cupId);
      toast.success("Cup settings saved");
    } catch (error) {
      toast.error("Cup could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const saveEligibility = async () => {
    if (!selectedCup?.id) {
      toast.error("Save the cup setup first");
      return;
    }
    setBusy(true);
    try {
      await DB.setLeagueCupEligibility(leagueId, selectedCup.id, { divisionIds: selectedDivisionIds, includedTeamIds, excludedTeamIds });
      await onWorkspaceRefresh?.();
      toast.success("Cup teams saved", { description: `${eligibleTeams.length} teams are currently eligible.` });
    } catch (error) {
      toast.error("Cup eligibility could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleDivision = (divisionId) => {
    setSelectedDivisionIds((current) => current.includes(divisionId) ? current.filter((id) => id !== divisionId) : [...current, divisionId]);
  };

  const toggleTeam = (team) => {
    const inherited = selectedDivisionIds.includes(team.divisionId);
    const explicitlyIncluded = includedTeamIds.includes(team.id);
    const explicitlyExcluded = excludedTeamIds.includes(team.id);
    const currentlyEligible = explicitlyIncluded || (inherited && !explicitlyExcluded);
    if (currentlyEligible) {
      setIncludedTeamIds((current) => current.filter((id) => id !== team.id));
      setExcludedTeamIds((current) => current.includes(team.id) ? current : [...current, team.id]);
    } else {
      setExcludedTeamIds((current) => current.filter((id) => id !== team.id));
      setIncludedTeamIds((current) => current.includes(team.id) ? current : [...current, team.id]);
    }
  };

  const generateRound = async ({ next = false } = {}) => {
    if (!selectedCup?.id) return;
    const kickOff = selectedCup.defaultKickOff || season?.defaultKickOff || "";
    if (!kickOff) {
      toast.error("Set the league default kick-off or a cup override first");
      return;
    }
    const result = next
      ? buildNextCupRound(latestRoundTies.map((tie) => ({ ...tie, winnerParentClubId: workspace.teams.find((team) => team.id === tie.winnerTeamId)?.parentClubId || "", winnerVenueId: workspace.teams.find((team) => team.id === tie.winnerTeamId)?.homeVenueId || "" })), selectedCup, { scheduledDate: drawDate, kickOff })
      : buildCupOpeningRound(eligibleTeams, selectedCup, { scheduledDate: drawDate, kickOff });
    if (result.errors.length) {
      toast.error(next ? "Next round cannot be created" : "Draw cannot be created", { description: result.errors.join(" ") });
      return;
    }
    setBusy(true);
    try {
      await DB.saveLeagueCupRoundDraw(leagueId, selectedCup.id, {
        round_number: result.round.roundNumber,
        name: result.round.name,
        scheduled_date: result.round.scheduledDate || null,
        status: result.round.status,
      }, result.ties);
      await onWorkspaceRefresh?.();
      toast.success(next ? "Next cup round created" : "Opening cup draw created", { description: `${result.ties.length} ties including byes.` });
    } catch (error) {
      toast.error("Cup draw could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const saveTieResult = async (tie) => {
    const edit = resultEdits[tie.id] || {};
    const homeScore = edit.homeScore ?? tie.homeScore;
    const awayScore = edit.awayScore ?? tie.awayScore;
    if (homeScore === "" || awayScore === "" || homeScore === null || awayScore === null) {
      toast.error("Enter both cup scores");
      return;
    }
    const inferredWinner = Number(homeScore) > Number(awayScore) ? tie.homeTeamId : Number(awayScore) > Number(homeScore) ? tie.awayTeamId : "";
    const winnerTeamId = edit.winnerTeamId || inferredWinner;
    if (!winnerTeamId || ![tie.homeTeamId, tie.awayTeamId].includes(winnerTeamId)) {
      toast.error("Select the team that progressed", { description: "A winner is required when the score is level after extra time or penalties." });
      return;
    }
    setBusy(true);
    try {
      await DB.updateLeagueCupTie(leagueId, tie.id, { home_score: Number(homeScore), away_score: Number(awayScore), winner_team_id: winnerTeamId, status: "played" });
      await onWorkspaceRefresh?.();
      setResultEdits((current) => { const next = { ...current }; delete next[tie.id]; return next; });
      toast.success("Cup result saved");
    } catch (error) {
      toast.error("Cup result could not be saved", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const updateTieEdit = (tieId, patch) => setTieEdits((current) => ({ ...current, [tieId]: { ...current[tieId], ...patch } }));

  const saveTieSchedule = async (tie) => {
    const edit = tieEdits[tie.id] || {};
    const scheduledDate = edit.scheduledDate ?? tie.scheduledDate ?? "";
    const kickOff = edit.kickOff ?? tie.kickOff ?? selectedCup?.defaultKickOff ?? season?.defaultKickOff ?? "";
    const venueId = edit.venueId ?? tie.venueId ?? "";
    const status = edit.status ?? tie.status ?? "draft";
    if (status === "scheduled" && (!scheduledDate || !kickOff || !venueId)) {
      toast.error("A scheduled cup tie needs a date, kick-off and venue");
      return;
    }
    setBusy(true);
    try {
      const isPostponed = status === "postponed";
      await DB.updateLeagueCupTie(leagueId, tie.id, {
        scheduled_date: isPostponed ? null : (scheduledDate || null),
        kick_off: isPostponed ? null : (kickOff || null),
        venue_id: venueId || null,
        status,
      });
      await onWorkspaceRefresh?.();
      setTieEdits((current) => { const next = { ...current }; delete next[tie.id]; return next; });
      toast.success(status === "postponed" ? "Cup tie postponed" : "Cup tie schedule saved");
    } catch (error) {
      toast.error("Cup tie could not be updated", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteCup = async () => {
    if (!selectedCup || !(await daxoraConfirm({ title: `Delete ${selectedCup.name}?`, description: "The cup and all unplayed drawn rounds will be removed.", confirmLabel: "Delete cup", tone: "danger", warning: "Played results are protected by database constraints and may prevent deletion." }))) return;
    setBusy(true);
    try {
      await DB.deleteLeagueCup(leagueId, selectedCup.id);
      await onWorkspaceRefresh?.();
      setSelectedCupId("new");
      toast.success("Cup deleted");
    } catch (error) {
      toast.error("Cup could not be deleted", { description: error?.message });
    } finally {
      setBusy(false);
    }
  };

  const scheduleImpact = async () => {
    if (!selectedCup || !ties.some((tie) => tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status))) {
      toast.error("Draw and schedule at least one cup round first");
      return;
    }
    setBusy(true);
    try {
      const versions = await DB.listLeagueScheduleVersions(leagueId, season.id);
      const sourceVersion = versions.find((version) => version.status === "draft") || versions.find((version) => version.status === "published") || versions[0];
      if (!sourceVersion) throw new Error("Generate a league schedule before applying cup dates.");
      const sourcePayload = normaliseScheduleVersionPayload(await DB.getLeagueScheduleVersion(leagueId, sourceVersion.id));
      const currentCupTies = workspace.cupTies.filter((tie) => tie.seasonId === season.id && tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status));
      const prepared = prepareLeagueRebalanceForCups(sourcePayload.entries, currentCupTies);
      if (prepared.lockedConflicts.length) throw new Error(`${prepared.lockedConflicts.length} locked league fixture${prepared.lockedConflicts.length === 1 ? "" : "s"} conflict with cup ties. Unlock or move them before rebalancing.`);
      const generated = generateLeagueSchedule(workspace, {
        seasonId: season.id,
        baseEntries: prepared.baseEntries,
        preservePlacedBaseEntries: true,
      });
      const validation = validateLeagueSchedule(workspace, generated.entries, generated.config);
      const versionId = await DB.saveLeagueScheduleDraft(leagueId, {
        seasonId: season.id,
        name: `${sourceVersion.name} – cup rebalanced`,
        generationConfig: { ...generated.config, cupRebalance: true, sourceVersionId: sourceVersion.id, displacedFixtures: prepared.movedCount },
        entries: serialiseScheduleEntries(generated.entries),
        parentVersionId: sourceVersion.id,
        source: "restored",
      });
      toast.success("Cup-aware league draft created", { description: `${prepared.movedCount} league fixture${prepared.movedCount === 1 ? "" : "s"} displaced and rescheduled · ${validation.blockingCount} blocking issues.` });
      await onWorkspaceRefresh?.();
      return versionId;
    } catch (error) {
      toast.error("League schedule could not be rebalanced", { description: error?.message });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const impactConflicts = useMemo(() => {
    const officialFixtures = workspace.fixtures.filter((fixture) => fixture.seasonId === season?.id && fixture.scheduledDate);
    return findCupLeagueConflicts(officialFixtures, ties);
  }, [season?.id, ties, workspace.fixtures]);

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden bg-slate-950 text-white">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950"><Trophy size={24} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Unlimited competitions</div><h2 className="mt-2 text-2xl font-black">Cup Manager</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Create as many trophies as the league needs, choose divisions and individual teams, run every draw and result, then rebalance the league programme around cup dates.</p></div></div>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-xl font-black">{cups.length}</div><div className="text-[9px] font-black uppercase tracking-wider text-slate-300">Cups</div></div><div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-xl font-black">{workspace.cupRounds.length}</div><div className="text-[9px] font-black uppercase tracking-wider text-slate-300">Rounds</div></div><div className="rounded-2xl bg-white/10 px-4 py-3"><div className="text-xl font-black">{workspace.cupTies.length}</div><div className="text-[9px] font-black uppercase tracking-wider text-slate-300">Ties</div></div></div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <CupList cups={cups} selectedCupId={selectedCupId} onSelect={setSelectedCupId} onCreate={() => { setSelectedCupId("new"); setSection("setup"); setDraft(cupDraft(season)); }} />
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{SECTIONS.map(([key, label]) => <button key={key} type="button" onClick={() => setSection(key)} disabled={!selectedCup && key !== "setup"} className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${section === key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50 disabled:opacity-40"}`}>{label}</button>)}</div>

          {section === "setup" ? <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h3 className="text-xl font-black text-slate-950">{selectedCup ? selectedCup.name : "New cup competition"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Cup kick-off is optional; blank means inherit the league setting.</p></div>{selectedCup ? <button type="button" onClick={deleteCup} disabled={!canOperate || busy} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"><Trash2 size={16} /></button> : null}</div><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Field label="Cup name" className="sm:col-span-2"><input className={INPUT} value={draft.name || ""} onChange={updateDraft("name")} disabled={!canOperate || busy} placeholder="Lancashire Amateur Cup" /></Field><Field label="Short code"><input className={INPUT} value={draft.code || ""} onChange={updateDraft("code")} disabled={!canOperate || busy} /></Field><Field label="Season"><select className={INPUT} value={draft.seasonId || ""} onChange={updateDraft("seasonId")} disabled={!canOperate || busy}>{workspace.seasons.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field><Field label="Competition starts"><input type="date" className={INPUT} value={draft.startsOn || ""} onChange={updateDraft("startsOn")} disabled={!canOperate || busy} /></Field><Field label="Cup kick-off override"><input type="time" className={INPUT} value={draft.defaultKickOff || ""} onChange={updateDraft("defaultKickOff")} disabled={!canOperate || busy} /></Field><Field label="Draw mode"><select className={INPUT} value={draft.drawMode || "random"} onChange={updateDraft("drawMode")} disabled={!canOperate || busy}><option value="random">Random draw</option><option value="seeded">Seeded draw</option></select></Field><Field label="Days between rounds"><input type="number" min="1" max="90" className={INPUT} value={draft.roundIntervalDays ?? 14} onChange={updateDraft("roundIntervalDays")} disabled={!canOperate || busy} /></Field><Field label="Avoid same parent club until round"><input type="number" min="0" max="10" className={INPUT} value={draft.sameClubAvoidUntilRound ?? 1} onChange={updateDraft("sameClubAvoidUntilRound")} disabled={!canOperate || busy} /></Field><Field label="Final date"><input type="date" className={INPUT} value={draft.finalDate || ""} onChange={updateDraft("finalDate")} disabled={!canOperate || busy} /></Field><Field label="Final venue"><select className={INPUT} value={draft.finalVenueId || ""} onChange={updateDraft("finalVenueId")} disabled={!canOperate || busy}><option value="">Decide later</option>{workspace.venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></Field><Field label="Status"><select className={INPUT} value={draft.status || "draft"} onChange={updateDraft("status")} disabled={!canOperate || busy}><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></select></Field></div><div className="mt-5 flex justify-end"><button type="button" onClick={saveCup} disabled={!canOperate || busy} className={`${BUTTON} bg-slate-950 text-white`}><Save size={15} /> Save cup</button></div></Panel> : null}

          {section === "eligibility" && selectedCup ? <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black text-slate-950">Eligible divisions and teams</h3><p className="mt-1 text-sm font-semibold text-slate-500">Select whole divisions, then include or exclude individual teams.</p></div><div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">{eligibleTeams.length} eligible teams</div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workspace.divisions.filter((division) => division.seasonId === selectedCup.seasonId).map((division) => <label key={division.id} className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-black ${selectedDivisionIds.includes(division.id) ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}><input type="checkbox" checked={selectedDivisionIds.includes(division.id)} onChange={() => toggleDivision(division.id)} disabled={!canOperate || busy} />{division.name}</label>)}</div><div className="mt-6 border-t border-slate-200 pt-5"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{workspace.teams.filter((team) => team.seasonId === selectedCup.seasonId && !["withdrawn", "inactive"].includes(team.status)).map((team) => { const eligible = eligibleTeams.some((row) => row.id === team.id); return <button key={team.id} type="button" onClick={() => toggleTeam(team)} disabled={!canOperate || busy} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left text-xs font-black ${eligible ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-500"}`}><span>{team.name}</span>{eligible ? <CheckCircle2 size={15} /> : <Plus size={15} />}</button>; })}</div></div><div className="mt-5 flex justify-end"><button type="button" onClick={saveEligibility} disabled={!canOperate || busy} className={`${BUTTON} bg-slate-950 text-white`}><Save size={15} /> Save teams</button></div></Panel> : null}

          {section === "draw" && selectedCup ? <div className="space-y-4"><Panel className="p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h3 className="text-xl font-black text-slate-950">Draw and round dates</h3><p className="mt-1 text-sm font-semibold text-slate-500">The league can add as many rounds and cups as required. Byes progress automatically.</p></div><div className="flex flex-wrap items-end gap-2"><Field label="Round date"><input type="date" className={`${INPUT} w-44`} value={drawDate} onChange={(event) => setDrawDate(event.target.value)} disabled={!canOperate || busy} /></Field>{!rounds.length ? <button type="button" onClick={() => generateRound()} disabled={!canOperate || busy || eligibleTeams.length < 2 || !drawDate} className={`${BUTTON} bg-emerald-500 text-slate-950`}><Shuffle size={15} /> Generate opening draw</button> : <button type="button" onClick={() => generateRound({ next: true })} disabled={!canOperate || busy || latestRoundTies.some((tie) => !tie.winnerTeamId)} className={`${BUTTON} bg-slate-950 text-white`}><Plus size={15} /> Generate next round</button>}</div></div></Panel>{rounds.map((round) => <Panel key={round.id} className="overflow-hidden"><div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4"><div><div className="text-sm font-black text-slate-950">{round.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{round.scheduledDate || "Date not set"} · {ties.filter((tie) => tie.roundNumber === round.roundNumber).length} ties</div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-700">{round.status}</span></div><div className="divide-y divide-slate-100">{ties.filter((tie) => tie.roundNumber === round.roundNumber).map((tie) => { const edit = tieEdits[tie.id] || {}; const isBye = !tie.awayTeamId || tie.status === "bye"; return <div key={tie.id} className="px-5 py-4"><div className="grid gap-3 text-sm xl:grid-cols-[60px_minmax(240px,1.4fr)_145px_105px_minmax(180px,1fr)_130px_auto] xl:items-center"><span className="text-xs font-black text-slate-400">Tie {tie.tieNumber}</span><div className="font-black leading-5 text-slate-950">{workspace.teams.find((team) => team.id === tie.homeTeamId)?.name || "TBC"} <span className="text-slate-400">v</span> {workspace.teams.find((team) => team.id === tie.awayTeamId)?.name || "BYE"}</div>{isBye ? <><span className="text-xs font-bold text-emerald-700">Automatic bye</span><span /><span /><span /><span /></> : <><input aria-label={`Cup tie date ${tie.id}`} type="date" className={INPUT} value={edit.scheduledDate ?? tie.scheduledDate ?? round.scheduledDate ?? ""} onChange={(event) => updateTieEdit(tie.id, { scheduledDate: event.target.value })} disabled={!canOperate || busy} /><input aria-label={`Cup tie kick-off ${tie.id}`} type="time" className={INPUT} value={String(edit.kickOff ?? tie.kickOff ?? selectedCup.defaultKickOff ?? season?.defaultKickOff ?? "").slice(0, 5)} onChange={(event) => updateTieEdit(tie.id, { kickOff: event.target.value })} disabled={!canOperate || busy} /><select aria-label={`Cup tie venue ${tie.id}`} className={INPUT} value={edit.venueId ?? tie.venueId ?? ""} onChange={(event) => updateTieEdit(tie.id, { venueId: event.target.value })} disabled={!canOperate || busy}><option value="">Select venue</option>{workspace.venues.filter((venue) => venue.status === "active").map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select><select aria-label={`Cup tie status ${tie.id}`} className={INPUT} value={edit.status ?? tie.status ?? "scheduled"} onChange={(event) => updateTieEdit(tie.id, { status: event.target.value })} disabled={!canOperate || busy}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="postponed">Postponed</option><option value="cancelled">Cancelled</option></select><button type="button" onClick={() => saveTieSchedule(tie)} disabled={!canOperate || busy || !tieEdits[tie.id]} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Save</button></>}</div></div>; })}</div></Panel>)}</div> : null}

          {section === "results" && selectedCup ? <Panel className="p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><h3 className="text-xl font-black text-slate-950">Results and progression</h3><p className="mt-1 text-sm font-semibold text-slate-500">Save each result; once every winner is known the next-round draw becomes available.</p></div><button type="button" onClick={() => downloadText(`${selectedCup.code || selectedCup.name}-cup-fixtures.csv`.replaceAll(/[^a-z0-9._-]+/gi, "-").toLowerCase(), cupTiesToCsv(selectedCup, ties, workspace))} className={`${BUTTON} border border-slate-200 bg-white text-slate-800`}><Download size={15} /> Export CSV</button></div><div className="mt-5 space-y-2">{ties.filter((tie) => tie.awayTeamId).map((tie) => { const edit = resultEdits[tie.id] || {}; return <div key={tie.id} className="grid gap-3 rounded-2xl border border-slate-200 p-3 xl:grid-cols-[90px_minmax(170px,1fr)_80px_20px_80px_minmax(170px,1fr)_minmax(170px,1fr)_auto] xl:items-center"><span className="text-xs font-black text-slate-500">Round {tie.roundNumber}</span><span className="text-sm font-black text-slate-950">{workspace.teams.find((team) => team.id === tie.homeTeamId)?.name}</span><input aria-label={`Home score ${tie.id}`} type="number" min="0" className={INPUT} value={edit.homeScore ?? tie.homeScore ?? ""} onChange={(event) => setResultEdits((current) => ({ ...current, [tie.id]: { ...current[tie.id], homeScore: event.target.value } }))} disabled={!canOperate || busy || tie.status === "played"} /><span className="text-center font-black text-slate-400">–</span><input aria-label={`Away score ${tie.id}`} type="number" min="0" className={INPUT} value={edit.awayScore ?? tie.awayScore ?? ""} onChange={(event) => setResultEdits((current) => ({ ...current, [tie.id]: { ...current[tie.id], awayScore: event.target.value } }))} disabled={!canOperate || busy || tie.status === "played"} /><span className="text-sm font-black text-slate-950">{workspace.teams.find((team) => team.id === tie.awayTeamId)?.name}</span><select aria-label={`Team progressing ${tie.id}`} className={INPUT} value={edit.winnerTeamId ?? tie.winnerTeamId ?? ""} onChange={(event) => setResultEdits((current) => ({ ...current, [tie.id]: { ...current[tie.id], winnerTeamId: event.target.value } }))} disabled={!canOperate || busy || tie.status === "played"}><option value="">Winner (automatic unless tied)</option><option value={tie.homeTeamId}>{workspace.teams.find((team) => team.id === tie.homeTeamId)?.name}</option><option value={tie.awayTeamId}>{workspace.teams.find((team) => team.id === tie.awayTeamId)?.name}</option></select>{tie.status === "played" ? <span className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-800"><CheckCircle2 size={14} /> Saved</span> : <button type="button" onClick={() => saveTieResult(tie)} disabled={!canOperate || busy} className={`${BUTTON} bg-slate-950 text-white`}><Save size={14} /> Result</button>}</div>; })}{!ties.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">Generate the opening draw first.</div> : null}</div></Panel> : null}

          {section === "impact" && selectedCup ? <Panel className="p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black text-slate-950">Cup impact on the league programme</h3><p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Cup ties are treated as hard team and venue reservations. A new league draft preserves every unaffected fixture and moves only conflicts to the earliest valid dates.</p></div><button type="button" onClick={scheduleImpact} disabled={!canOperate || busy || !ties.some((tie) => tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status))} className={`${BUTTON} bg-emerald-500 text-slate-950`}><RefreshCw size={15} /> Rebalance league around cups</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-2xl font-black text-slate-950">{ties.filter((tie) => tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status)).length}</div><div className="mt-1 text-xs font-black uppercase text-slate-500">Scheduled cup ties</div></div><div className={`rounded-2xl p-4 ${impactConflicts.length ? "bg-amber-50" : "bg-emerald-50"}`}><div className={`text-2xl font-black ${impactConflicts.length ? "text-amber-900" : "text-emerald-900"}`}>{impactConflicts.length}</div><div className={`mt-1 text-xs font-black uppercase ${impactConflicts.length ? "text-amber-700" : "text-emerald-700"}`}>Current official conflicts</div></div><div className="rounded-2xl bg-sky-50 p-4"><div className="text-2xl font-black text-sky-900">{workspace.cupTies.filter((tie) => tie.seasonId === season?.id && tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status)).length}</div><div className="mt-1 text-xs font-black uppercase text-sky-700">All season cup reservations</div></div></div>{impactConflicts.length ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-amber-900"><AlertTriangle size={16} /> Conflicting league fixtures will be postponed into a new schedule draft</div><div className="mt-3 grid gap-2 lg:grid-cols-2">{impactConflicts.slice(0, 12).map((conflict, index) => <div key={`${conflict.entry.id}-${conflict.tie.id}-${index}`} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-900">{workspace.teams.find((team) => team.id === conflict.entry.homeTeamId)?.name} v {workspace.teams.find((team) => team.id === conflict.entry.awayTeamId)?.name} · {conflict.entry.scheduledDate}{conflict.locked ? " · LOCKED" : ""}</div>)}</div></div> : <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-900"><CheckCircle2 size={18} /> No conflicts exist in the currently published league fixture registry.</div>}</Panel> : null}
        </div>
      </div>
    </div>
  );
}
