import { useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Copy,
  ListPlus,
  PackagePlus,
  Plus,
  Save,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import HalfHourTimeSelector from "./HalfHourTimeSelector.jsx";
import {
  RESOURCE_TYPE_OPTIONS,
  WAITLIST_STATUS_OPTIONS,
  buildSeasonRolloverPreview,
  normalisePlannerResource,
  normaliseSeasonRollover,
  normaliseWaitlistEntry,
} from "../../lib/planning/seasonalResourceEngine.js";

const SEASONS = [
  { value: "preseason", label: "Pre-season" },
  { value: "regular", label: "Regular season" },
  { value: "winter", label: "Winter training" },
];

const DAYS = [
  [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"],
];

function dateDefaults(phase) {
  const year = new Date().getFullYear();
  if (phase === "preseason") return { startDate: `${year}-07-01`, endDate: `${year}-08-31` };
  if (phase === "winter") return { startDate: `${year}-10-01`, endDate: `${year + 1}-03-31` };
  return { startDate: `${year}-09-01`, endDate: `${year + 1}-05-31` };
}

function blankResource() {
  return { name: "", resourceType: "equipment", quantity: 1, setupBufferMinutes: 0, clearDownBufferMinutes: 0, notes: "", active: true };
}

function blankWaitlist(teams = []) {
  const team = teams[0] || {};
  return {
    teamKey: String(team.id || team.key || team.name || ""),
    teamName: String(team.name || ""),
    seasonPhase: "regular",
    preferredDays: [1, 2, 3, 4, 5],
    preferredStartTimes: ["18:00"],
    requiredDurationMinutes: 90,
    pitchId: "",
    pitchAreaId: "",
    winterSiteId: "",
    resourceRequirements: [],
    participantCount: 0,
    priority: 50,
    status: "waiting",
    notes: "",
  };
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>;
}

export default function SeasonalResourceWorkspace({
  teams = [],
  preferences = [],
  allocationRuns = [],
  allocationItems = [],
  resources = [],
  waitlist = [],
  rollovers = [],
  canManage = false,
  saving = false,
  onSaveResource,
  onDeleteResource,
  onSaveWaitlist,
  onUpdateWaitlist,
  onCreateRollover,
}) {
  const [resourceDraft, setResourceDraft] = useState(blankResource());
  const [waitlistDraft, setWaitlistDraft] = useState(blankWaitlist(teams));
  const regular = dateDefaults("regular");
  const winter = dateDefaults("winter");
  const [rolloverDraft, setRolloverDraft] = useState({
    fromSeasonPhase: "regular",
    toSeasonPhase: "winter",
    fromStartDate: regular.startDate,
    fromEndDate: regular.endDate,
    toStartDate: winter.startDate,
    toEndDate: winter.endDate,
    copyPreferences: true,
    copyAllocations: true,
  });

  const safeResources = useMemo(() => resources.map(normalisePlannerResource), [resources]);
  const safeWaitlist = useMemo(() => waitlist.map(normaliseWaitlistEntry), [waitlist]);
  const safeRollovers = useMemo(() => rollovers.map(normaliseSeasonRollover), [rollovers]);
  const rolloverPreview = useMemo(() => buildSeasonRolloverPreview({
    preferences,
    allocationRuns,
    allocationItems,
    fromSeasonPhase: rolloverDraft.fromSeasonPhase,
    copyPreferences: rolloverDraft.copyPreferences,
    copyAllocations: rolloverDraft.copyAllocations,
  }), [allocationItems, allocationRuns, preferences, rolloverDraft.copyAllocations, rolloverDraft.copyPreferences, rolloverDraft.fromSeasonPhase]);

  const updateRolloverSeason = (field, value) => {
    const dates = dateDefaults(value);
    setRolloverDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "fromSeasonPhase" ? { fromStartDate: dates.startDate, fromEndDate: dates.endDate } : { toStartDate: dates.startDate, toEndDate: dates.endDate }),
    }));
  };

  const toggleWaitlistDay = (day) => setWaitlistDraft((current) => ({
    ...current,
    preferredDays: current.preferredDays.includes(day) ? current.preferredDays.filter((item) => item !== day) : [...current.preferredDays, day],
  }));

  const toggleResourceRequirement = (resourceId) => setWaitlistDraft((current) => {
    const existing = current.resourceRequirements.find((item) => item.resourceId === resourceId);
    return {
      ...current,
      resourceRequirements: existing
        ? current.resourceRequirements.filter((item) => item.resourceId !== resourceId)
        : [...current.resourceRequirements, { resourceId, quantity: 1 }],
    };
  });

  return <div className="space-y-6">
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700"><Copy size={15} /> Seasonal rollover</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Carry proven allocations into the next season</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">Copy team preferences and the latest published allocation into a new draft. Nothing is published until an operator reviews it.</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-900">
          <div>{rolloverPreview.preferenceCount} team profiles</div>
          <div className="mt-1">{rolloverPreview.allocationCount} published allocations</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Source season</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Season"><select className="input" value={rolloverDraft.fromSeasonPhase} onChange={(event) => updateRolloverSeason("fromSeasonPhase", event.target.value)}>{SEASONS.map((season) => <option key={season.value} value={season.value}>{season.label}</option>)}</select></Field>
            <Field label="Published run"><div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700">{rolloverPreview.sourceRun ? `${String(rolloverPreview.sourceRun.start_date || rolloverPreview.sourceRun.startDate)} to ${String(rolloverPreview.sourceRun.end_date || rolloverPreview.sourceRun.endDate)}` : "No published run"}</div></Field>
            <Field label="From"><input type="date" className="input" value={rolloverDraft.fromStartDate} onChange={(event) => setRolloverDraft((current) => ({ ...current, fromStartDate: event.target.value }))} /></Field>
            <Field label="To"><input type="date" className="input" value={rolloverDraft.fromEndDate} onChange={(event) => setRolloverDraft((current) => ({ ...current, fromEndDate: event.target.value }))} /></Field>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Target season</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Season"><select className="input" value={rolloverDraft.toSeasonPhase} onChange={(event) => updateRolloverSeason("toSeasonPhase", event.target.value)}>{SEASONS.map((season) => <option key={season.value} value={season.value}>{season.label}</option>)}</select></Field>
            <Field label="Result"><div className="flex h-11 items-center rounded-xl border border-emerald-200 bg-white px-3 text-sm font-bold text-emerald-800">New reviewable draft</div></Field>
            <Field label="From"><input type="date" className="input" value={rolloverDraft.toStartDate} onChange={(event) => setRolloverDraft((current) => ({ ...current, toStartDate: event.target.value }))} /></Field>
            <Field label="To"><input type="date" className="input" value={rolloverDraft.toEndDate} onChange={(event) => setRolloverDraft((current) => ({ ...current, toEndDate: event.target.value }))} /></Field>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={rolloverDraft.copyPreferences} onChange={(event) => setRolloverDraft((current) => ({ ...current, copyPreferences: event.target.checked }))} /> Copy team preferences</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={rolloverDraft.copyAllocations} onChange={(event) => setRolloverDraft((current) => ({ ...current, copyAllocations: event.target.checked }))} /> Copy latest published allocation</label>
        </div>
        <button type="button" disabled={!canManage || saving || !rolloverPreview.ready || rolloverDraft.fromSeasonPhase === rolloverDraft.toSeasonPhase} onClick={() => onCreateRollover?.(rolloverDraft)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40"><ArrowRight size={17} /> Create rollover draft</button>
      </div>
      {rolloverPreview.warning ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">{rolloverPreview.warning}</div> : null}
      {safeRollovers.length ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{safeRollovers.slice(0, 6).map((rollover) => <div key={rollover.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between"><span className="text-xs font-black text-slate-900">{rollover.fromSeasonPhase} <ArrowRight className="inline" size={13} /> {rollover.toSeasonPhase}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase text-slate-600">{rollover.status}</span></div><div className="mt-3 text-xs font-semibold text-slate-500">{rollover.copiedPreferences} profiles · {rollover.copiedAllocations} allocations</div></div>)}</div> : null}
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700"><Boxes size={15} /> Shared resources</div><h3 className="mt-2 text-xl font-black text-slate-950">Equipment, rooms and access capacity</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Bookings can reserve quantities and use setup or clear-down buffers.</p></div><PackagePlus className="text-sky-500" size={23} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Resource name" wide><input className="input" value={resourceDraft.name} onChange={(event) => setResourceDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Portable goals" /></Field>
          <Field label="Type"><select className="input" value={resourceDraft.resourceType} onChange={(event) => setResourceDraft((current) => ({ ...current, resourceType: event.target.value }))}>{RESOURCE_TYPE_OPTIONS.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
          <Field label="Available quantity"><input type="number" min="1" max="999" className="input" value={resourceDraft.quantity} onChange={(event) => setResourceDraft((current) => ({ ...current, quantity: Number(event.target.value) }))} /></Field>
          <Field label="Setup buffer"><select className="input" value={resourceDraft.setupBufferMinutes} onChange={(event) => setResourceDraft((current) => ({ ...current, setupBufferMinutes: Number(event.target.value) }))}>{[0, 15, 30, 45, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></Field>
          <Field label="Clear-down buffer"><select className="input" value={resourceDraft.clearDownBufferMinutes} onChange={(event) => setResourceDraft((current) => ({ ...current, clearDownBufferMinutes: Number(event.target.value) }))}>{[0, 15, 30, 45, 60].map((value) => <option key={value} value={value}>{value} minutes</option>)}</select></Field>
          <Field label="Operational note" wide><textarea className="input min-h-[82px] py-3" value={resourceDraft.notes} onChange={(event) => setResourceDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Storage, keyholder or setup instructions" /></Field>
        </div>
        <button type="button" disabled={!canManage || saving || !resourceDraft.name.trim()} onClick={async () => { await onSaveResource?.(resourceDraft); setResourceDraft(blankResource()); }} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-5 text-sm font-black text-white disabled:opacity-40"><Save size={16} /> Save resource</button>
        <div className="mt-5 space-y-2">{safeResources.length ? safeResources.map((resource) => <div key={resource.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-4"><div><div className="text-sm font-black text-slate-950">{resource.name}</div><div className="mt-1 text-xs font-semibold text-slate-500">{RESOURCE_TYPE_OPTIONS.find((type) => type.value === resource.resourceType)?.label || resource.resourceType} · {resource.quantity} available · {resource.setupBufferMinutes}/{resource.clearDownBufferMinutes} min buffers</div></div>{canManage ? <button type="button" onClick={() => onDeleteResource?.(resource.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-600"><Trash2 size={15} /></button> : null}</div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs font-bold text-slate-500">No shared resources configured yet.</div>}</div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700"><ListPlus size={15} /> Training waitlist</div><h3 className="mt-2 text-xl font-black text-slate-950">Keep unmet demand visible</h3><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">Record teams that cannot yet be placed so they are included in later drafts and grant evidence.</p></div><Users className="text-amber-500" size={23} /></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Team" wide><select className="input" value={waitlistDraft.teamKey} onChange={(event) => { const team = teams.find((row) => String(row.id || row.key || row.name) === event.target.value); setWaitlistDraft((current) => ({ ...current, teamKey: event.target.value, teamName: team?.name || event.target.value })); }}><option value="">Choose team</option>{teams.map((team) => <option key={team.id || team.key || team.name} value={team.id || team.key || team.name}>{team.name}</option>)}</select></Field>
          <Field label="Season"><select className="input" value={waitlistDraft.seasonPhase} onChange={(event) => setWaitlistDraft((current) => ({ ...current, seasonPhase: event.target.value }))}>{SEASONS.map((season) => <option key={season.value} value={season.value}>{season.label}</option>)}</select></Field>
          <Field label="Duration"><select className="input" value={waitlistDraft.requiredDurationMinutes} onChange={(event) => setWaitlistDraft((current) => ({ ...current, requiredDurationMinutes: Number(event.target.value) }))}>{[45, 60, 75, 90, 105, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></Field>
          <Field label="Participants"><input type="number" min="0" max="999" className="input" value={waitlistDraft.participantCount} onChange={(event) => setWaitlistDraft((current) => ({ ...current, participantCount: Number(event.target.value) }))} /></Field>
          <Field label="Priority"><input type="number" min="1" max="100" className="input" value={waitlistDraft.priority} onChange={(event) => setWaitlistDraft((current) => ({ ...current, priority: Number(event.target.value) }))} /></Field>
          <div className="sm:col-span-2"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Preferred days</div><div className="mt-2 flex flex-wrap gap-2">{DAYS.map(([day, label]) => <button key={day} type="button" onClick={() => toggleWaitlistDay(day)} className={`h-9 rounded-xl border px-3 text-xs font-black ${waitlistDraft.preferredDays.includes(day) ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}>{label}</button>)}</div></div>
          <div className="sm:col-span-2"><HalfHourTimeSelector value={waitlistDraft.preferredStartTimes} earliestStartTime="16:00" latestEndTime="22:00" durationMinutes={waitlistDraft.requiredDurationMinutes} onChange={(value) => setWaitlistDraft((current) => ({ ...current, preferredStartTimes: value }))} compact /></div>
          {safeResources.length ? <div className="sm:col-span-2"><div className="text-[10px] font-black uppercase tracking-wide text-slate-500">Required resources</div><div className="mt-2 grid gap-2 sm:grid-cols-2">{safeResources.filter((resource) => resource.active).map((resource) => <button key={resource.id} type="button" onClick={() => toggleResourceRequirement(resource.id)} className={`rounded-xl border p-3 text-left text-xs font-black ${waitlistDraft.resourceRequirements.some((item) => item.resourceId === resource.id) ? "border-sky-300 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}>{resource.name}</button>)}</div></div> : null}
          <Field label="Notes" wide><textarea className="input min-h-[82px] py-3" value={waitlistDraft.notes} onChange={(event) => setWaitlistDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Why the team could not be allocated or what alternatives are acceptable" /></Field>
        </div>
        <button type="button" disabled={!canManage || saving || !waitlistDraft.teamKey} onClick={async () => { await onSaveWaitlist?.(waitlistDraft); setWaitlistDraft(blankWaitlist(teams)); }} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-slate-950 disabled:opacity-40"><Plus size={16} /> Add to waitlist</button>
        <div className="mt-5 space-y-2">{safeWaitlist.length ? safeWaitlist.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-black text-slate-950">{entry.teamName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{entry.seasonPhase} · {entry.requiredDurationMinutes} min · priority {entry.priority}</div><div className="mt-2 flex flex-wrap gap-1.5">{entry.preferredStartTimes.map((time) => <span key={time} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{time}</span>)}</div></div><select disabled={!canManage || saving} value={entry.status} onChange={(event) => onUpdateWaitlist?.({ ...entry, status: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700">{WAITLIST_STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div></div>) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-xs font-bold text-slate-500">No teams are waiting for a slot.</div>}</div>
      </section>
    </div>

    <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={CalendarRange} label="Rollover drafts" value={safeRollovers.length} detail="Season transitions retained" />
        <Summary icon={Wrench} label="Shared resources" value={safeResources.filter((resource) => resource.active).length} detail="Capacity-aware inventory" />
        <Summary icon={Clock3} label="Waiting teams" value={safeWaitlist.filter((entry) => entry.status === "waiting").length} detail="Unmet training demand" />
        <Summary icon={CheckCircle2} label="Allocated from waitlist" value={safeWaitlist.filter((entry) => entry.status === "allocated").length} detail="Demand recovered" />
      </div>
    </section>
  </div>;
}

function Summary({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span><Icon size={16} className="text-slate-400" /></div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}
