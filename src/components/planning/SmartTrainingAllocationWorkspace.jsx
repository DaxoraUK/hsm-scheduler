import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Lock,
  MapPin,
  RefreshCw,
  Save,
  Sparkles,
  Unlock,
  Users,
  WandSparkles,
} from "lucide-react";
import TrainingSchedulingPolicyPanel from "./TrainingSchedulingPolicyPanel.jsx";
import HalfHourTimeSelector from "./HalfHourTimeSelector.jsx";
import { normaliseTrainingSchedulingPolicy, resolveTrainingSchedulingPolicy } from "../../lib/planning/trainingPolicyEngine.js";
import {
  SMART_ALLOCATION_MODES,
  TEAM_ALLOCATION_MODE_OPTIONS,
  SEASON_PHASE_OPTIONS,
  allocationDayLabel,
  buildSmartTrainingAllocationDraft,
  normaliseTrainingPreference,
} from "../../lib/planning/smartTrainingAllocationEngine.js";

const DAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"],
];

function teamKey(team = {}, index = 0) {
  return String(team.key || team.id || team.teamKey || team.name || `team-${index + 1}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function dateDefaults(seasonPhase) {
  const year = new Date().getFullYear();
  if (seasonPhase === "winter") return { startDate: `${year}-10-01`, endDate: `${year + 1}-03-31` };
  if (seasonPhase === "preseason") return { startDate: `${year}-07-01`, endDate: `${year}-08-31` };
  return { startDate: `${year}-09-01`, endDate: `${year + 1}-05-31` };
}

function confidenceTone(value) {
  if (value === "high") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "medium") return "border-sky-200 bg-sky-50 text-sky-800";
  if (value === "low") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function modeLabel(value) {
  if (value === "inherit") return "Follow run";
  return SMART_ALLOCATION_MODES.find((mode) => mode.value === value)?.label || "Assisted";
}

function normalisePreferences(teams, rows, seasonPhase, policies = []) {
  const map = new Map((Array.isArray(rows) ? rows : []).filter((row) => String(row.season_phase || row.seasonPhase || "regular") === seasonPhase).map((row) => [String(row.team_key || row.teamKey || "").toLowerCase(), row]));
  return teams.map((team, index) => normaliseTrainingPreference(map.get(teamKey(team, index)) || {}, team, index, seasonPhase, resolveTrainingSchedulingPolicy({ policies, team, seasonPhase })));
}

function seasonClubPolicy(policies, seasonPhase) {
  const row = (Array.isArray(policies) ? policies : []).find((policy) =>
    String(policy.season_phase || policy.seasonPhase || "regular") === seasonPhase
    && String(policy.scope_type || policy.scopeType || "club") === "club"
    && String(policy.scope_key || policy.scopeKey || "all").toLowerCase() === "all",
  );
  return normaliseTrainingSchedulingPolicy(row || { seasonPhase, scopeType: "club", scopeKey: "all" }, seasonPhase);
}

function PreferenceEditor({ preference, pitches, winterSites, saving, onChange, onSave }) {
  const set = (field, value) => onChange({ ...preference, [field]: value });
  const toggleDay = (field, day) => {
    const current = Array.isArray(preference[field]) ? preference[field] : [];
    set(field, current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  };
  const toggleValue = (field, value) => {
    const current = Array.isArray(preference[field]) ? preference[field] : [];
    set(field, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Team scheduling profile</div><h3 className="mt-1 text-xl font-black text-slate-950">{preference.teamName}</h3><p className="mt-1 text-xs font-semibold text-slate-500">Preferences guide the engine but never silently move an approved allocation.</p><div className="mt-2 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">Inherited from {preference.policySource || "club defaults"}</div></div>
      <button type="button" onClick={() => onSave(preference)} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"><Save size={15} /> Save profile</button>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Team mode</span><select className="input" value={preference.allocationMode} onChange={(event) => set("allocationMode", event.target.value)}>{TEAM_ALLOCATION_MODE_OPTIONS.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Session duration</span><select className="input" value={preference.requiredDurationMinutes} onChange={(event) => set("requiredDurationMinutes", Number(event.target.value))}>{[45,60,75,90,105,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
      <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred days</div><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(([day, label]) => <button key={day} type="button" disabled={!preference.allowedDays?.includes(day)} onClick={() => toggleDay("preferredDays", day)} className={`h-9 rounded-xl border px-3 text-xs font-black ${preference.preferredDays.includes(day) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div></div>
      <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Unavailable days</div><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(([day, label]) => <button key={day} type="button" disabled={!preference.allowedDays?.includes(day)} onClick={() => toggleDay("unavailableDays", day)} className={`h-9 rounded-xl border px-3 text-xs font-black ${preference.unavailableDays.includes(day) ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div></div>
      <div className="lg:col-span-2"><HalfHourTimeSelector value={preference.preferredStartTimes} earliestStartTime={preference.earliestStartTime} latestEndTime={preference.latestEndTime} durationMinutes={preference.requiredDurationMinutes} onChange={(value) => set("preferredStartTimes", value)} compact /></div>
      {preference.seasonPhase === "winter" ? <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred winter sites</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{winterSites.map((site) => <button key={site.id} type="button" onClick={() => toggleValue("preferredWinterSiteIds", String(site.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${preference.preferredWinterSiteIds.includes(String(site.id)) ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-700"}`}>{site.name}</button>)}</div></div> : <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred club pitches</div><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{pitches.map((pitch) => <button key={pitch.id} type="button" onClick={() => toggleValue("preferredPitchIds", String(pitch.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${preference.preferredPitchIds.includes(String(pitch.id)) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}>{pitch.label || pitch.id}</button>)}</div></div>}
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Minimum space</span><select className="input" value={preference.minimumAreaMode} onChange={(event) => set("minimumAreaMode", event.target.value)}><option value="any">Any suitable allocation</option><option value="named_area">Named area / half</option><option value="full_pitch">Full pitch only</option></select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Club priority</span><input type="number" min="1" max="100" className="input" value={preference.priorityWeight} onChange={(event) => set("priorityWeight", Number(event.target.value))} /></label>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" checked={preference.keepCurrentAllocation} onChange={(event) => set("keepCurrentAllocation", event.target.checked)} /><span><span className="block text-sm font-black text-slate-900">Keep current allocation</span><span className="mt-1 block text-xs font-semibold text-slate-500">Strongly favour the team's established day, time and resource.</span></span></label>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><input type="checkbox" checked={preference.manualOnly} onChange={(event) => set("manualOnly", event.target.checked)} /><span><span className="block text-sm font-black text-slate-900">Manual only</span><span className="mt-1 block text-xs font-semibold text-slate-500">Show recommendations but never include this team in an automatic draft.</span></span></label>
    </div>
  </section>;
}

function AllocationCard({ item, onToggleLock, onUseAlternative }) {
  return <article className={`rounded-2xl border p-4 ${item.status === "unassigned" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-base font-black text-slate-950">{item.teamName}</h4><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${confidenceTone(item.confidence)}`}>{item.confidence === "none" ? "Unassigned" : `${item.confidence} confidence`}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">{modeLabel(item.mode)}</span></div>{item.status !== "unassigned" ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-1.5"><CalendarCheck2 size={14} /> {allocationDayLabel(item.dayOfWeek)}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={14} /> {item.startTime}–{item.endTime}</span><span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {item.resourceLabel}</span></div> : <p className="mt-2 text-sm font-bold text-rose-800">No conflict-free slot matched this team's current rules.</p>}</div>
      {item.status !== "unassigned" ? <button type="button" onClick={() => onToggleLock(item.teamKey)} className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black ${item.locked ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600"}`}>{item.locked ? <Lock size={14} /> : <Unlock size={14} />}{item.locked ? "Locked" : "Lock"}</button> : null}
    </div>
    {item.reasons.length ? <div className="mt-3 flex flex-wrap gap-2">{item.reasons.slice(0, 5).map((reason) => <span key={reason} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">{reason}</span>)}</div> : null}
    {item.warnings.length ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900"><AlertTriangle className="mr-2 inline" size={14} />{item.warnings.join(" · ")}</div> : null}
    {item.alternatives.length ? <details className="mt-3"><summary className="cursor-pointer text-xs font-black text-sky-700">View {item.alternatives.length} alternatives</summary><div className="mt-2 space-y-2">{item.alternatives.map((alternative) => <button key={`${alternative.resourceLabel}-${alternative.dayOfWeek}-${alternative.startTime}`} type="button" onClick={() => onUseAlternative(item.teamKey, alternative)} className="flex w-full flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold text-slate-700 hover:border-sky-300"><span className="font-black text-slate-950">{allocationDayLabel(alternative.dayOfWeek)} {alternative.startTime}–{alternative.endTime}</span><span className="mt-1">{alternative.resourceLabel} · score {alternative.score}</span></button>)}</div></details> : null}
  </article>;
}

export default function SmartTrainingAllocationWorkspace({
  teams = [],
  pitches = [],
  winterSites = [],
  winterSlots = [],
  bookings = [],
  assignments = [],
  preferences = [],
  allocationRuns = [],
  policies = [],
  preferenceProposals = [],
  canManage = false,
  saving = false,
  onSavePreference,
  onSavePolicy,
  onReviewProposal,
  onSaveDraft,
  onPublishDraft,
}) {
  const [seasonPhase, setSeasonPhase] = useState("regular");
  const initialClubPolicy = seasonClubPolicy(policies, "regular");
  const [mode, setMode] = useState(initialClubPolicy.allocationMode);
  const [range, setRange] = useState(() => dateDefaults("regular"));
  const [defaultStartTimes, setDefaultStartTimes] = useState(initialClubPolicy.preferredStartTimes);
  const [selectedTeamKey, setSelectedTeamKey] = useState(() => teamKey(teams[0] || {}, 0));
  const [editablePreferences, setEditablePreferences] = useState(() => normalisePreferences(teams, preferences, "regular", policies));
  const [draft, setDraft] = useState(null);

  const savedSeasonPolicy = useMemo(() => seasonClubPolicy(policies, seasonPhase), [policies, seasonPhase]);

  useEffect(() => {
    setRange(dateDefaults(seasonPhase));
    setMode(savedSeasonPolicy.allocationMode);
    setDefaultStartTimes(savedSeasonPolicy.preferredStartTimes);
    setEditablePreferences(normalisePreferences(teams, preferences, seasonPhase, policies));
    setSelectedTeamKey((current) => current && teams.some((team, index) => teamKey(team, index) === current) ? current : teamKey(teams[0] || {}, 0));
    setDraft(null);
  }, [policies, preferences, savedSeasonPolicy, seasonPhase, teams]);

  const selectedPreference = editablePreferences.find((preference) => preference.teamKey === selectedTeamKey) || editablePreferences[0] || null;
  const latestRun = useMemo(() => (Array.isArray(allocationRuns) ? allocationRuns : []).filter((run) => String(run.season_phase || run.seasonPhase) === seasonPhase).sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || "")))[0] || null, [allocationRuns, seasonPhase]);

  const updatePreference = (next) => setEditablePreferences((current) => current.map((preference) => preference.teamKey === next.teamKey ? next : preference));
  const buildDraft = () => setDraft(buildSmartTrainingAllocationDraft({ teams, pitches, winterSites, winterSlots, bookings, assignments, preferences: editablePreferences, policies, seasonPhase, mode, startDate: range.startDate, endDate: range.endDate, defaultStartTimes }));
  const toggleLock = (key) => setDraft((current) => current ? { ...current, items: current.items.map((item) => item.teamKey === key ? { ...item, locked: !item.locked } : item) } : current);
  const useAlternative = (key, alternative) => setDraft((current) => current ? { ...current, items: current.items.map((item) => item.teamKey === key ? { ...item, ...alternative, resourceLabel: alternative.resourceLabel, score: alternative.score, confidence: alternative.score >= 100 ? "high" : alternative.score >= 80 ? "medium" : "low", reasons: alternative.reasons || [], warnings: [], status: mode === "automatic" ? "proposed" : "suggested" } : item) } : current);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-950 via-slate-950 to-slate-900 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-300"><WandSparkles size={15} /> Smart training allocation</div><h2 className="mt-2 text-2xl font-black">Build an explainable summer or winter draft</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-300">Ground Control respects usual slots, age groups, pitch suitability, winter inventory, coach clashes and locked allocations. Nothing is published until an operator approves it.</p></div>{latestRun ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-slate-300"><div className="text-[10px] font-black uppercase tracking-wide text-violet-300">Latest saved run</div><div className="mt-1 text-sm font-black text-white">{modeLabel(latestRun.mode)} · {String(latestRun.status || "draft")}</div></div> : null}</div>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Season</span><select value={seasonPhase} onChange={(event) => setSeasonPhase(event.target.value)} className="input">{SEASON_PHASE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">Scheduling mode</span><select value={mode} onChange={(event) => setMode(event.target.value)} className="input">{SMART_ALLOCATION_MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span className={`block text-[10px] font-bold ${mode === savedSeasonPolicy.allocationMode ? "text-emerald-300" : "text-amber-300"}`}>{mode === savedSeasonPolicy.allocationMode ? "Saved season default" : "Unsaved - save the Club default master rule"}</span></label>
        <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">From</span><input type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} className="input" /></label>
        <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-wide text-slate-400">To</span><input type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} className="input" /></label>
        <button type="button" onClick={buildDraft} disabled={!teams.length || (seasonPhase === "winter" && !winterSlots.length)} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-400 px-4 text-sm font-black text-slate-950 disabled:opacity-50"><Sparkles size={17} /> Build draft</button>
      </div>
      {seasonPhase === "winter" && !winterSlots.length ? <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 p-3 text-xs font-bold text-amber-100">Add fixed winter-site slots before running winter allocation.</div> : null}
    </section>

    {canManage ? <TrainingSchedulingPolicyPanel
      seasonPhase={seasonPhase}
      teams={teams}
      policies={policies}
      proposals={preferenceProposals}
      pitches={pitches}
      winterSites={winterSites}
      allocationMode={mode}
      onAllocationModeChange={setMode}
      saving={saving}
      onSavePolicy={onSavePolicy}
      onReviewProposal={onReviewProposal}
    /> : null}

    <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm"><div className="px-2 py-2"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Team profiles</div><div className="mt-1 text-sm font-black text-slate-900">{editablePreferences.length} teams</div></div><div className="mt-2 max-h-[620px] space-y-1 overflow-y-auto">{editablePreferences.map((preference) => <button key={preference.teamKey} type="button" onClick={() => setSelectedTeamKey(preference.teamKey)} className={`w-full rounded-xl px-3 py-3 text-left ${selectedTeamKey === preference.teamKey ? "bg-slate-950 text-white" : "hover:bg-slate-50"}`}><div className="text-sm font-black">{preference.teamName}</div><div className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${selectedTeamKey === preference.teamKey ? "text-slate-400" : "text-slate-500"}`}>{preference.manualOnly ? "Manual only" : modeLabel(preference.allocationMode)} · {preference.requiredDurationMinutes} min</div></button>)}</div></aside>
      {selectedPreference ? <PreferenceEditor preference={selectedPreference} pitches={pitches} winterSites={winterSites} saving={saving} onChange={updatePreference} onSave={onSavePreference} /> : <section className="rounded-[28px] border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">Add teams before configuring smart allocation.</section>}
    </div>

    {draft ? <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Explainable draft</div><h3 className="mt-1 text-xl font-black text-slate-950">{SEASON_PHASE_OPTIONS.find((option) => option.value === seasonPhase)?.label} allocation</h3><p className="mt-1 text-xs font-semibold text-slate-500">Review compromises, alternatives and confidence before saving or publishing.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={buildDraft} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"><RefreshCw size={15} /> Rebuild</button>{canManage ? <button type="button" onClick={() => onSaveDraft?.({ ...draft, defaultStartTimes, status: "draft" })} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 text-xs font-black text-sky-800"><Save size={15} /> Save draft</button> : null}{canManage && draft.summary.publishable ? <button type="button" onClick={() => onPublishDraft?.({ ...draft, defaultStartTimes, status: "draft" })} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white"><CheckCircle2 size={15} /> Publish recurring allocations</button> : null}</div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={Users} label="Teams" value={draft.summary.teams} detail={`${draft.summary.assigned} assigned`} /><Metric icon={CheckCircle2} label="High confidence" value={draft.summary.highConfidence} detail={`${draft.summary.mediumConfidence} medium`} /><Metric icon={AlertTriangle} label="Unassigned" value={draft.summary.unassigned} detail="Require operator action" warning={draft.summary.unassigned > 0} /><Metric icon={Lock} label="Locked" value={draft.items.filter((item) => item.locked).length} detail="Protected in this draft" /><Metric icon={Sparkles} label="Average score" value={draft.summary.averageScore} detail={modeLabel(mode)} /></div>
      {mode === "manual" ? <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-900">Manual mode shows recommendations only. Switch to Assisted or Automatic Draft to create publishable allocations.</div> : null}
      <div className="mt-5 grid gap-3 xl:grid-cols-2">{draft.items.map((item) => <AllocationCard key={item.teamKey} item={item} onToggleLock={toggleLock} onUseAlternative={useAlternative} />)}</div>
    </section> : null}
  </div>;
}

function Metric({ icon: Icon, label, value, detail, warning = false }) {
  return <div className={`rounded-2xl border p-4 ${warning ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span><Icon size={16} className={warning ? "text-amber-600" : "text-slate-500"} /></div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}
