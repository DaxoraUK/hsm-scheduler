import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  LockKeyhole,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  COACH_EDIT_POLICY_OPTIONS,
  POLICY_SCOPE_OPTIONS,
  normaliseTrainingSchedulingPolicy,
  policyScopeLabel,
  teamPolicyAgeGroup,
  teamPolicyType,
} from "../../lib/planning/trainingPolicyEngine.js";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

function exactPolicy(policies, seasonPhase, scopeType, scopeKey) {
  return (Array.isArray(policies) ? policies : []).find((row) =>
    String(row.season_phase || row.seasonPhase || "regular") === seasonPhase
    && String(row.scope_type || row.scopeType || "club") === scopeType
    && String(row.scope_key || row.scopeKey || "all").toLowerCase() === String(scopeKey || "all").toLowerCase(),
  );
}

function scopeOptions(teams, scopeType) {
  if (scopeType === "club") return [{ value: "all", label: "All teams" }];
  const values = new Set((Array.isArray(teams) ? teams : []).map((team) => scopeType === "age_group" ? teamPolicyAgeGroup(team) : teamPolicyType(team)).filter(Boolean));
  return [...values].sort().map((value) => ({ value, label: value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }));
}

function proposalPreference(proposal = {}) {
  return proposal.proposed_preference || proposal.proposedPreference || proposal.preference_data || proposal.preferenceData || {};
}

function proposalStatusTone(status) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default function TrainingSchedulingPolicyPanel({
  seasonPhase = "regular",
  teams = [],
  policies = [],
  proposals = [],
  pitches = [],
  winterSites = [],
  saving = false,
  onSavePolicy,
  onReviewProposal,
}) {
  const [scopeType, setScopeType] = useState("club");
  const availableScopes = useMemo(() => scopeOptions(teams, scopeType), [scopeType, teams]);
  const [scopeKey, setScopeKey] = useState("all");
  const [editor, setEditor] = useState(() => normaliseTrainingSchedulingPolicy({ seasonPhase }, seasonPhase));

  useEffect(() => {
    const options = scopeOptions(teams, scopeType);
    const nextKey = scopeType === "club" ? "all" : options.some((option) => option.value === scopeKey) ? scopeKey : options[0]?.value || "";
    if (nextKey !== scopeKey) setScopeKey(nextKey);
    const existing = exactPolicy(policies, seasonPhase, scopeType, nextKey);
    setEditor(normaliseTrainingSchedulingPolicy(existing || { seasonPhase, scopeType, scopeKey: nextKey }, seasonPhase));
  }, [policies, scopeKey, scopeType, seasonPhase, teams]);

  const pending = useMemo(() => (Array.isArray(proposals) ? proposals : []).filter((proposal) =>
    String(proposal.status || "pending") === "pending"
    && String(proposal.season_phase || proposal.seasonPhase || "regular") === seasonPhase,
  ), [proposals, seasonPhase]);

  const set = (field, value) => setEditor((current) => normaliseTrainingSchedulingPolicy({ ...current, [field]: value }, seasonPhase));
  const toggleDay = (day) => {
    const current = editor.allowedDays || [];
    set("allowedDays", current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  };
  const toggleResource = (field, value) => {
    const current = Array.isArray(editor[field]) ? editor[field] : [];
    set(field, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700"><ShieldCheck size={15} /> Master scheduling rules</div>
        <h3 className="mt-1 text-xl font-black text-slate-950">Set safe defaults before the assistant allocates teams</h3>
        <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">Weekends are disabled by default. Team and coach preferences can improve a draft, but they cannot bypass these club controls.</p>
      </div>
      <button type="button" onClick={() => onSavePolicy?.(editor)} disabled={saving || (scopeType !== "club" && !scopeKey)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"><Save size={15} /> Save master rule</button>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-3">
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Rule level</span><select className="input" value={scopeType} onChange={(event) => { setScopeType(event.target.value); setScopeKey(event.target.value === "club" ? "all" : ""); }}>{POLICY_SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Applies to</span><select className="input" value={scopeKey} disabled={scopeType === "club" || !availableScopes.length} onChange={(event) => setScopeKey(event.target.value)}>{availableScopes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Coach changes</span><select className="input" value={editor.coachEditPolicy} onChange={(event) => set("coachEditPolicy", event.target.value)}>{COACH_EDIT_POLICY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black text-slate-800">Permitted training days</div><div className="mt-1 text-[11px] font-semibold text-slate-500">The allocator will leave a team unassigned rather than use a blocked day.</div></div><label className="flex items-center gap-2 text-xs font-black text-slate-700"><input type="checkbox" checked={editor.weekendAllowed} onChange={(event) => set("weekendAllowed", event.target.checked)} /> Allow weekend training</label></div>
        <div className="mt-3 flex flex-wrap gap-2">{DAYS.map(([day, label]) => { const weekend = day === 0 || day === 6; const disabled = weekend && !editor.weekendAllowed; return <button key={day} type="button" disabled={disabled} onClick={() => toggleDay(day)} className={`h-9 rounded-xl border px-3 text-xs font-black ${editor.allowedDays.includes(day) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300`}>{label}</button>; })}</div>
      </div>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Earliest start</span><input type="time" className="input" value={editor.earliestStartTime} onChange={(event) => set("earliestStartTime", event.target.value)} /></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Latest finish</span><input type="time" className="input" value={editor.latestEndTime} onChange={(event) => set("latestEndTime", event.target.value)} /></label>
      <label className="space-y-1.5 lg:col-span-2"><span className="text-xs font-black text-slate-700">Default preferred start times</span><input className="input" value={editor.preferredStartTimes.join(", ")} onChange={(event) => set("preferredStartTimes", event.target.value.split(/[,;]+/).map((value) => value.trim()).filter(Boolean))} placeholder="17:00, 18:00, 19:00" /></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Default session duration</span><select className="input" value={editor.defaultDurationMinutes} onChange={(event) => set("defaultDurationMinutes", Number(event.target.value))}>{[45, 60, 75, 90, 105, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Default space</span><select className="input" value={editor.minimumAreaMode} onChange={(event) => set("minimumAreaMode", event.target.value)}><option value="any">Any suitable space</option><option value="named_area">Named area / half</option><option value="full_pitch">Full Pitch only</option></select></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Sessions per week</span><input type="number" min="1" max="7" className="input" value={editor.sessionsPerWeek} onChange={(event) => set("sessionsPerWeek", Number(event.target.value))} /></label>
      <label className="space-y-1.5"><span className="text-xs font-black text-slate-700">Internal note</span><input className="input" value={editor.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Why this rule exists" /></label>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><CalendarDays size={15} /> Permitted club pitches</div><div className="mt-1 text-[11px] font-semibold text-slate-500">Leave empty to allow every suitable club pitch.</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{pitches.map((pitch) => <button key={pitch.id} type="button" onClick={() => toggleResource("permittedPitchIds", String(pitch.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${editor.permittedPitchIds.includes(String(pitch.id)) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600"}`}>{pitch.label || pitch.id}</button>)}</div></div>
      <div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><Clock3 size={15} /> Permitted winter sites</div><div className="mt-1 text-[11px] font-semibold text-slate-500">Leave empty to allow every active winter site.</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{winterSites.map((site) => <button key={site.id} type="button" onClick={() => toggleResource("permittedWinterSiteIds", String(site.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${editor.permittedWinterSiteIds.includes(String(site.id)) ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-600"}`}>{site.name}</button>)}</div></div>
    </div>

    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-900"><LockKeyhole className="mr-2 inline" size={15} />Editing <span className="font-black">{policyScopeLabel(editor)}</span> for {seasonPhase.replace("preseason", "pre-season")}. These rules are enforced during recommendations, coach submissions and publication.</div>

    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700"><Users size={14} /> Coach preference review</div><h4 className="mt-1 text-lg font-black text-slate-950">{pending.length} change{pending.length === 1 ? "" : "s"} awaiting a decision</h4></div></div>
      <div className="mt-4 space-y-3">{pending.map((proposal) => { const proposed = proposalPreference(proposal); return <article key={proposal.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h5 className="text-sm font-black text-amber-950">{proposal.team_name || proposal.teamName}</h5><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${proposalStatusTone(proposal.status)}`}>{proposal.status || "pending"}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-amber-900/75"><span>Days: {(proposed.preferred_days || proposed.preferredDays || []).join(", ") || "Club defaults"}</span><span>Times: {(proposed.preferred_start_times || proposed.preferredStartTimes || []).join(", ") || "Club defaults"}</span><span>{proposed.required_duration_minutes || proposed.requiredDurationMinutes || editor.defaultDurationMinutes} minutes</span></div>{proposed.notes ? <p className="mt-2 text-xs font-semibold text-amber-900">{proposed.notes}</p> : null}</div><div className="flex shrink-0 gap-2"><button type="button" disabled={saving} onClick={() => onReviewProposal?.(proposal, "reject")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-black text-rose-700"><X size={14} /> Reject</button><button type="button" disabled={saving} onClick={() => onReviewProposal?.(proposal, "approve")} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white"><Check size={14} /> Approve</button></div></div></article>; })}{!pending.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-bold text-slate-500"><SlidersHorizontal className="mx-auto mb-2 text-slate-400" size={20} />No coach preference changes are waiting for review.</div> : null}</div>
    </div>
  </section>;
}
