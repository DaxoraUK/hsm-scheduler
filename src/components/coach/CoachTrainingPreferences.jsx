import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  MapPin,
  Save,
  SlidersHorizontal,
} from "lucide-react";
import { normaliseTrainingPreference } from "../../lib/planning/smartTrainingAllocationEngine.js";
import HalfHourTimeSelector from "../planning/HalfHourTimeSelector.jsx";
import {
  applyPolicyToTrainingPreference,
  coachTrainingPreferenceToPayload,
  resolveTrainingSchedulingPolicy,
  validateTrainingPreferenceAgainstPolicy,
} from "../../lib/planning/trainingPolicyEngine.js";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const SEASONS = [
  ["preseason", "Pre-season / summer"],
  ["regular", "Regular season"],
  ["winter", "Winter training"],
];

function teamForAssignment(assignment = {}) {
  return {
    key: assignment.teamKey || assignment.team_key,
    name: assignment.teamName || assignment.team_name,
    teamType: assignment.teamType || assignment.team_type,
    ageGroup: assignment.ageGroup || assignment.age_group,
    ageOrder: assignment.ageOrder || assignment.age_order,
    format: assignment.format,
  };
}

function latestProposal(proposals, teamKey, seasonPhase) {
  return (Array.isArray(proposals) ? proposals : [])
    .filter((row) => String(row.team_key || row.teamKey) === String(teamKey) && String(row.season_phase || row.seasonPhase || "regular") === seasonPhase)
    .sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || "")))[0] || null;
}

function proposalTone(status) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default function CoachTrainingPreferences({
  assignments = [],
  policies = [],
  preferences = [],
  proposals = [],
  pitches = [],
  winterSites = [],
  busy = false,
  onSubmit,
}) {
  const [teamKey, setTeamKey] = useState(() => assignments[0]?.teamKey || assignments[0]?.team_key || "");
  const [seasonPhase, setSeasonPhase] = useState("regular");
  const assignment = assignments.find((row) => String(row.teamKey || row.team_key) === String(teamKey)) || assignments[0] || null;
  const team = useMemo(() => teamForAssignment(assignment || {}), [assignment]);
  const policy = useMemo(() => resolveTrainingSchedulingPolicy({ policies, team, seasonPhase }), [policies, seasonPhase, team]);
  const saved = useMemo(() => (Array.isArray(preferences) ? preferences : []).find((row) => String(row.team_key || row.teamKey) === String(teamKey) && String(row.season_phase || row.seasonPhase || "regular") === seasonPhase) || {}, [preferences, seasonPhase, teamKey]);
  const [form, setForm] = useState(() => normaliseTrainingPreference(saved, team, 0, seasonPhase, policy));
  const proposal = useMemo(() => latestProposal(proposals, teamKey, seasonPhase), [proposals, seasonPhase, teamKey]);

  useEffect(() => {
    setForm(normaliseTrainingPreference(saved, team, 0, seasonPhase, policy));
  }, [policy, saved, seasonPhase, team]);

  useEffect(() => {
    if (!assignments.some((row) => String(row.teamKey || row.team_key) === String(teamKey))) setTeamKey(assignments[0]?.teamKey || assignments[0]?.team_key || "");
  }, [assignments, teamKey]);

  const set = (field, value) => setForm((current) => applyPolicyToTrainingPreference({ ...current, [field]: value, overrideFields: [...new Set([...(current.overrideFields || []), field])] }, policy));
  const toggleDay = (field, day) => {
    if (!policy.allowedDays.includes(day)) return;
    const current = Array.isArray(form[field]) ? form[field] : [];
    set(field, current.includes(day) ? current.filter((value) => value !== day) : [...current, day]);
  };
  const toggleValue = (field, value) => {
    const current = Array.isArray(form[field]) ? form[field] : [];
    set(field, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const errors = validateTrainingPreferenceAgainstPolicy(form, policy);
  const readOnly = policy.coachEditPolicy === "club_only";

  async function submit() {
    if (errors.length || readOnly) return;
    await onSubmit?.(coachTrainingPreferenceToPayload({ ...form, teamKey: team.key, teamName: team.name, seasonPhase }));
  }

  return <div className="space-y-5">
    <section className="rounded-[30px] bg-gradient-to-br from-violet-700 to-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-violet-200"><SlidersHorizontal size={15} /> Training preferences</div>
      <h1 className="mt-2 text-3xl font-black">Tell the club what works for your team</h1>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-violet-100/80">Choose preferred days, times and facilities inside the club's master rules. The scheduler will explain when a preference cannot be honoured.</p>
    </section>

    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Team</span><select className="input" value={teamKey} onChange={(event) => setTeamKey(event.target.value)}>{assignments.map((row) => <option key={row.id || row.teamKey || row.team_key} value={row.teamKey || row.team_key}>{row.teamName || row.team_name}</option>)}</select></label>
        <label><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Season</span><select className="input" value={seasonPhase} onChange={(event) => setSeasonPhase(event.target.value)}>{SEASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RuleCard icon={CalendarDays} label="Permitted days" value={policy.allowedDays.map((day) => DAYS.find(([value]) => value === day)?.[1]).filter(Boolean).join(", ")} />
        <RuleCard icon={Clock3} label="Training window" value={`${policy.earliestStartTime}-${policy.latestEndTime}`} />
        <RuleCard icon={MapPin} label="Default space" value={policy.minimumAreaMode.replace("named_area", "Named area").replace("full_pitch", "Full Pitch").replace("any", "Any suitable space")} />
        <RuleCard icon={LockKeyhole} label="Coach changes" value={policy.coachEditPolicy === "approval" ? "Club approval required" : policy.coachEditPolicy === "immediate" ? "Apply immediately" : "Club managed only"} />
      </div>
      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold leading-5 text-slate-600"><span className="font-black text-slate-900">Inherited from:</span> {policy.inheritedFrom}. Weekend training is {policy.weekendAllowed ? "allowed" : "disabled"}.</div>

      {proposal ? <div className={`mt-5 rounded-2xl border p-4 text-xs font-bold ${proposalTone(proposal.status || "pending")}`}><CheckCircle2 className="mr-2 inline" size={15} />Latest change: <span className="font-black capitalize">{String(proposal.status || "pending").replace(/_/g, " ")}</span>{proposal.decision_note || proposal.decisionNote ? ` - ${proposal.decision_note || proposal.decisionNote}` : ""}</div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred days</div><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(([day, label]) => { const allowed = policy.allowedDays.includes(day); return <button key={day} type="button" disabled={!allowed || readOnly} onClick={() => toggleDay("preferredDays", day)} className={`h-10 rounded-xl border px-3 text-xs font-black ${form.preferredDays.includes(day) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300`}>{label}</button>; })}</div></div>
        <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Unavailable days</div><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(([day, label]) => { const allowed = policy.allowedDays.includes(day); return <button key={day} type="button" disabled={!allowed || readOnly} onClick={() => toggleDay("unavailableDays", day)} className={`h-10 rounded-xl border px-3 text-xs font-black ${form.unavailableDays.includes(day) ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-500"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300`}>{label}</button>; })}</div></div>
        <div className="lg:col-span-2"><HalfHourTimeSelector value={form.preferredStartTimes} earliestStartTime={policy.earliestStartTime} latestEndTime={policy.latestEndTime} durationMinutes={form.requiredDurationMinutes} disabled={readOnly} onChange={(value) => set("preferredStartTimes", value)} compact /></div>
        <label><span className="mb-2 block text-xs font-black text-slate-700">Preferred duration</span><select disabled={readOnly} className="input" value={form.requiredDurationMinutes} onChange={(event) => set("requiredDurationMinutes", Number(event.target.value))}>{[45, 60, 75, 90, 105, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        <label><span className="mb-2 block text-xs font-black text-slate-700">Space preference</span><select disabled={readOnly} className="input" value={form.minimumAreaMode} onChange={(event) => set("minimumAreaMode", event.target.value)}><option value="any">Any suitable space</option><option value="named_area">Named area / half</option><option value="full_pitch">Full Pitch</option></select></label>
        <label><span className="mb-2 block text-xs font-black text-slate-700">Notes for the scheduler</span><input disabled={readOnly} className="input" value={form.notes || ""} onChange={(event) => set("notes", event.target.value)} placeholder="Shared coach, school commitments, travel..." /></label>

        {seasonPhase === "winter" ? <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred winter sites</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{winterSites.filter((site) => !policy.permittedWinterSiteIds.length || policy.permittedWinterSiteIds.includes(String(site.id))).map((site) => <button key={site.id} type="button" disabled={readOnly} onClick={() => toggleValue("preferredWinterSiteIds", String(site.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${form.preferredWinterSiteIds.includes(String(site.id)) ? "border-violet-300 bg-violet-50 text-violet-900" : "border-slate-200 bg-white text-slate-600"}`}>{site.name}</button>)}</div></div> : <div className="lg:col-span-2"><div className="text-xs font-black text-slate-700">Preferred club pitches</div><div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{pitches.filter((pitch) => !policy.permittedPitchIds.length || policy.permittedPitchIds.includes(String(pitch.id))).map((pitch) => <button key={pitch.id} type="button" disabled={readOnly} onClick={() => toggleValue("preferredPitchIds", String(pitch.id))} className={`rounded-xl border p-3 text-left text-xs font-black ${form.preferredPitchIds.includes(String(pitch.id)) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600"}`}>{pitch.label || pitch.id}</button>)}</div></div>}
      </div>

      {errors.length ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800">{errors.join(" ")}</div> : null}
      {readOnly ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">The club currently manages these settings. Contact the scheduler if your availability has changed.</div> : null}
      <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs font-semibold text-slate-500">{policy.coachEditPolicy === "approval" ? "Your changes will be sent to the club for approval." : "Valid changes will update the smart scheduler immediately."}</div><button type="button" disabled={busy || readOnly || errors.length > 0} onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50"><Save size={16} /> {busy ? "Saving..." : policy.coachEditPolicy === "approval" ? "Submit preferences" : "Save preferences"}</button></div>
    </section>
  </div>;
}

function RuleCard({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"><Icon size={14} /> {label}</div><div className="mt-2 text-sm font-black text-slate-900">{value || "Not set"}</div></div>;
}
