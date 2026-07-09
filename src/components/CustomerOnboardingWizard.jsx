import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Car,
  Check,
  CheckCircle2,
  CircleAlert,
  CloudSun,
  Database,
  Flag,
  LoaderCircle,
  MapPinned,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import {
  ONBOARDING_STEPS,
  buildOnboardingConfiguration,
  getOnboardingReadiness,
  validateOnboardingStep,
} from "../lib/onboarding/onboardingEngine.js";

const SPORTS = ["Football", "Rugby Union", "Rugby League", "Cricket", "Hockey", "Netball", "Other"];
const FORMATS = ["3v3", "5v5", "7v7", "9v9", "11v11-youth", "11v11-small", "11v11"];
const DAYS = ["Saturday", "Sunday", "Midweek"];
const SURFACES = ["grass", "astro", "3g", "4g", "indoor"];
const MINUTES = [0, 15, 30, 45];

const inputClass = "h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";
const selectClass = `${inputClass} appearance-none`;

function mergeDraft(base, stored) {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return base;
  const next = { ...base };
  Object.entries(stored).forEach(([key, value]) => {
    if (Array.isArray(value)) next[key] = value;
    else if (value && typeof value === "object") next[key] = mergeDraft(base?.[key] || {}, value);
    else next[key] = value;
  });
  return next;
}

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
      {hint ? <span className="ml-2 text-xs font-semibold text-slate-400">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function Toggle({ checked, onChange, title, description, icon: Icon, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      aria-disabled={disabled}
      className={`flex w-full items-start gap-4 rounded-[24px] border p-5 text-left transition ${disabled ? "cursor-default" : "hover:border-emerald-300"} ${checked ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-slate-50"}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${checked ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}>
        <Icon size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-slate-950">{title}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">{description}</span>
      </span>
      <span className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function StepHeader({ eyebrow, title, description }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500 sm:text-base">{description}</p>
    </div>
  );
}

function WelcomeStep() {
  const cards = [
    [Building2, "Club identity", "Shared details used across operations, reports and support."],
    [MapPinned, "Venue truth", "One primary site powers weather, parking and pitch allocation."],
    [CalendarClock, "Operating rules", "Scheduling windows and turnaround rules are set once."],
    [UsersRound, "Matchday resources", "Teams and pitches become the source of operational intelligence."],
  ];
  return (
    <div className="space-y-7">
      <StepHeader
        eyebrow="Customer onboarding"
        title="Build a clean operational workspace"
        description="This guided setup creates the minimum reliable configuration Ground Control needs. Progress is saved securely to the selected club and can be resumed on another device."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(([Icon, title, description]) => (
          <div key={title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300"><Icon size={21} /></span>
            <h3 className="mt-4 text-base font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{description}</p>
          </div>
        ))}
      </div>
      <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold leading-6 text-emerald-950">
        <div className="flex items-start gap-3">
          <ShieldCheck size={21} className="mt-0.5 shrink-0 text-emerald-700" />
          <div><strong className="font-black">Secure by default.</strong> Only a club owner or administrator can change this setup. Every completed onboarding is attributed in the audit log.</div>
        </div>
      </div>
    </div>
  );
}

function ClubStep({ draft, update }) {
  const club = draft.club || {};
  const set = (field, value) => update("club", { ...club, [field]: value });
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Step 2" title="Tell us about the club" description="These details identify the workspace and support future reporting, governing-body matching and account administration." />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Club or organisation name"><input className={inputClass} value={club.name || ""} onChange={(event) => set("name", event.target.value)} /></Field>
        <Field label="Primary sport"><select className={selectClass} value={club.sport || "Football"} onChange={(event) => set("sport", event.target.value)}>{SPORTS.map((sport) => <option key={sport}>{sport}</option>)}</select></Field>
        <Field label="County / region"><input className={inputClass} value={club.region || ""} onChange={(event) => set("region", event.target.value)} placeholder="e.g. Greater Manchester" /></Field>
        <Field label="County FA / governing body"><input className={inputClass} value={club.governingBody || ""} onChange={(event) => set("governingBody", event.target.value)} placeholder="e.g. Lancashire FA" /></Field>
        <Field label="Primary contact"><input className={inputClass} value={club.contactName || ""} onChange={(event) => set("contactName", event.target.value)} placeholder="Name" /></Field>
        <Field label="Contact role"><input className={inputClass} value={club.contactRole || ""} onChange={(event) => set("contactRole", event.target.value)} placeholder="e.g. Club Secretary" /></Field>
        <Field label="Contact email"><input type="email" className={inputClass} value={club.contactEmail || ""} onChange={(event) => set("contactEmail", event.target.value)} placeholder="name@club.org.uk" /></Field>
        <Field label="Contact phone"><input className={inputClass} value={club.contactPhone || ""} onChange={(event) => set("contactPhone", event.target.value)} placeholder="07xxx xxxxxx" /></Field>
      </div>
    </div>
  );
}

function WorkspaceStep({ draft, update }) {
  const features = draft.features || {};
  const set = (field, value) => update("features", { ...features, [field]: value });
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Step 3" title="Choose the operational modules" description="Optional workspaces disappear cleanly when the club does not need them. Saved data is retained if a module is enabled later." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Toggle checked disabled title="Weekend Operations" description="Saturday and Sunday scheduling is the core Ground Control workspace." icon={CalendarClock} onChange={() => {}} />
        <Toggle checked={features.midweekEnabled !== false} title="Midweek Operations" description="Enable evening fixtures and a separate weekday operating window." icon={CloudSun} onChange={(value) => set("midweekEnabled", value)} />
        <Toggle checked={features.parkingEnabled !== false} title="Parking & Arrivals" description="Use capacity, arrival-wave forecasting and parking-safe recommendations." icon={Car} onChange={(value) => set("parkingEnabled", value)} />
        <Toggle checked disabled title="Analytics & Reports" description="Operational evidence, trends and launch reporting stay included." icon={Database} onChange={() => {}} />
      </div>
    </div>
  );
}

function VenueStep({ draft, update }) {
  const venue = draft.venue || {};
  const set = (field, value) => update("venue", { ...venue, [field]: value });
  const parkingEnabled = draft.features?.parkingEnabled !== false;
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Step 4" title="Configure the primary venue" description="The postcode powers live weather. The site identity is also used by pitches, teams and future multi-site reporting." />
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Site name"><input className={inputClass} value={venue.name || ""} onChange={(event) => set("name", event.target.value)} placeholder="Main Ground" /></Field>
        <Field label="Venue / ground"><input className={inputClass} value={venue.venue || ""} onChange={(event) => set("venue", event.target.value)} placeholder="Ground name and town" /></Field>
        <Field label="Postcode" hint="Required for weather"><input className={inputClass} value={venue.postcode || ""} onChange={(event) => set("postcode", event.target.value.toUpperCase())} placeholder="BL6 7QE" /></Field>
        <Field label="Parking spaces" hint={parkingEnabled ? "Use 0 until measured" : "Stored while parking is off"}><input type="number" min={0} className={inputClass} value={venue.carParkSpaces ?? 0} onChange={(event) => set("carParkSpaces", Math.max(0, Number(event.target.value) || 0))} /></Field>
      </div>
      <Toggle checked={venue.weatherEnabled !== false} title="Use this site for weather intelligence" description="Ground Control will use the postcode for the selected matchday forecast." icon={CloudSun} onChange={(value) => set("weatherEnabled", value)} />
    </div>
  );
}

function ScheduleStep({ draft, update }) {
  const scheduling = draft.scheduling || {};
  const set = (field, value) => update("scheduling", { ...scheduling, [field]: value });
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Step 5" title="Set permanent scheduling rules" description="These are club-wide defaults. Temporary closures and one-off changes remain in Matchday Operations." />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-black text-slate-950">Youth operating window</h3>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Start hour"><input type="number" min={6} max={13} className={inputClass} value={scheduling.startHour ?? 8} onChange={(event) => set("startHour", Number(event.target.value))} /></Field>
            <Field label="Start minute"><select className={selectClass} value={scheduling.startMin ?? 30} onChange={(event) => set("startMin", Number(event.target.value))}>{MINUTES.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}</select></Field>
            <Field label="End hour"><input type="number" min={8} max={16} className={inputClass} value={scheduling.endHour ?? 11} onChange={(event) => set("endHour", Number(event.target.value))} /></Field>
            <Field label="End minute"><select className={selectClass} value={scheduling.endMin ?? 30} onChange={(event) => set("endMin", Number(event.target.value))}>{MINUTES.map((minute) => <option key={minute} value={minute}>{String(minute).padStart(2, "0")}</option>)}</select></Field>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-base font-black text-slate-950">Turnaround and capacity</h3>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Youth buffer"><input type="number" min={0} max={60} step={5} className={inputClass} value={scheduling.bufferYouth ?? 15} onChange={(event) => set("bufferYouth", Number(event.target.value))} /></Field>
            <Field label="Adult buffer"><input type="number" min={0} max={90} step={5} className={inputClass} value={scheduling.bufferAdult ?? 30} onChange={(event) => set("bufferAdult", Number(event.target.value))} /></Field>
            <Field label="Maximum concurrent games" className="col-span-2"><input type="number" min={1} max={30} className={inputClass} value={scheduling.maxConcurrent ?? 3} onChange={(event) => set("maxConcurrent", Math.max(1, Number(event.target.value) || 1))} /></Field>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourcesStep({ draft, update }) {
  const teams = Array.isArray(draft.teams) ? draft.teams : [];
  const pitches = Array.isArray(draft.pitches) ? draft.pitches : [];
  const updateTeam = (index, patch) => update("teams", teams.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const updatePitch = (index, patch) => update("pitches", pitches.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addTeam = () => update("teams", [...teams, { name: "New Team", teamType: "youth", format: "11v11-youth", day: "Saturday", gameMins: 70, ageOrder: teams.length + 1 }]);
  const addPitch = () => update("pitches", [...pitches, { id: `P${pitches.length + 1}`, label: `Pitch ${pitches.length + 1}`, format: "11v11", surface: "grass", independent: false, affectsParking: true }]);
  return (
    <div className="space-y-8">
      <StepHeader eyebrow="Step 6" title="Add the operational resources" description="Start with the teams and playing areas used most often. Full suitability, linked-pitch and alternative-pitch details can be refined later in Settings." />
      <section>
        <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-slate-950">Teams</h3><p className="text-sm font-semibold text-slate-500">At least one team is required.</p></div><button type="button" onClick={addTeam} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={16} className="text-emerald-300" /> Add team</button></div>
        <div className="mt-4 space-y-3">
          {teams.map((team, index) => (
            <div key={`team-${index}`} className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(180px,1.4fr)_1fr_1fr_100px_44px]">
              <input aria-label={`Team ${index + 1} name`} className={inputClass} value={team.name || ""} onChange={(event) => updateTeam(index, { name: event.target.value })} />
              <select aria-label={`Team ${index + 1} format`} className={selectClass} value={team.format || "11v11-youth"} onChange={(event) => updateTeam(index, { format: event.target.value, teamType: event.target.value === "11v11" ? "adult" : "youth" })}>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select>
              <select aria-label={`Team ${index + 1} day`} className={selectClass} value={team.day || "Saturday"} onChange={(event) => updateTeam(index, { day: event.target.value })}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select>
              <input aria-label={`Team ${index + 1} minutes`} type="number" min={20} max={120} step={5} className={inputClass} value={team.gameMins ?? 70} onChange={(event) => updateTeam(index, { gameMins: Number(event.target.value) })} />
              <button type="button" aria-label={`Remove ${team.name || "team"}`} onClick={() => update("teams", teams.filter((_, rowIndex) => rowIndex !== index))} className="flex h-12 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600"><Trash2 size={17} /></button>
            </div>
          ))}
          {!teams.length ? <div className="rounded-[22px] border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No teams added.</div> : null}
        </div>
      </section>
      <section>
        <div className="flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-slate-950">Pitches and playing areas</h3><p className="text-sm font-semibold text-slate-500">Pitch IDs must be unique.</p></div><button type="button" onClick={addPitch} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={16} className="text-emerald-300" /> Add pitch</button></div>
        <div className="mt-4 space-y-3">
          {pitches.map((pitch, index) => (
            <div key={`pitch-${index}`} className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[100px_minmax(180px,1.4fr)_1fr_1fr_44px]">
              <input aria-label={`Pitch ${index + 1} ID`} className={inputClass} value={pitch.id || ""} onChange={(event) => updatePitch(index, { id: event.target.value.replace(/\s+/g, "") })} />
              <input aria-label={`Pitch ${index + 1} name`} className={inputClass} value={pitch.label || ""} onChange={(event) => updatePitch(index, { label: event.target.value })} />
              <select aria-label={`Pitch ${index + 1} format`} className={selectClass} value={pitch.format || "11v11"} onChange={(event) => updatePitch(index, { format: event.target.value })}>{FORMATS.map((format) => <option key={format}>{format}</option>)}</select>
              <select aria-label={`Pitch ${index + 1} surface`} className={selectClass} value={pitch.surface || "grass"} onChange={(event) => updatePitch(index, { surface: event.target.value })}>{SURFACES.map((surface) => <option key={surface}>{surface}</option>)}</select>
              <button type="button" aria-label={`Remove ${pitch.label || "pitch"}`} onClick={() => update("pitches", pitches.filter((_, rowIndex) => rowIndex !== index))} className="flex h-12 w-11 items-center justify-center rounded-2xl border border-rose-200 bg-white text-rose-600"><Trash2 size={17} /></button>
            </div>
          ))}
          {!pitches.length ? <div className="rounded-[22px] border border-dashed border-slate-300 p-7 text-center text-sm font-bold text-slate-500">No pitches added.</div> : null}
        </div>
      </section>
    </div>
  );
}

function FixturesStep({ draft, update }) {
  const fixtures = draft.fixtures || {};
  const set = (field, value) => update("fixtures", { ...fixtures, [field]: value });
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Step 7" title="Connect the fixture source" description="Full-Time FA can be configured now or left disabled while the club starts with manual fixtures. Planned integrations are not presented as live connections." />
      <Toggle checked={Boolean(fixtures.enabled)} title="Enable Full-Time FA" description="Make the configured source available to live fixture import workflows." icon={Trophy} onChange={(value) => set("enabled", value)} />
      <div className={`grid gap-5 md:grid-cols-2 ${fixtures.enabled ? "" : "opacity-55"}`}>
        <Field label="Fixture source URL" className="md:col-span-2"><input disabled={!fixtures.enabled} className={inputClass} value={fixtures.sourceUrl || ""} onChange={(event) => set("sourceUrl", event.target.value)} placeholder="https://fulltime.thefa.com/..." /></Field>
        <Field label="Full-Time club ID"><input disabled={!fixtures.enabled} className={inputClass} value={fixtures.clubId || ""} onChange={(event) => set("clubId", event.target.value)} placeholder="Optional" /></Field>
        <Field label="Import mode"><select disabled={!fixtures.enabled} className={selectClass} value={fixtures.mode || "import"} onChange={(event) => set("mode", event.target.value)}><option value="import">Import fixtures</option><option value="manual">Manual preparation</option></select></Field>
      </div>
    </div>
  );
}

function ReviewStep({ draft }) {
  const readiness = getOnboardingReadiness(draft);
  const rows = [
    [Building2, "Club", draft.club?.name || "Missing", draft.club?.sport || "Missing"],
    [MapPinned, "Venue", draft.venue?.venue || "Missing", draft.venue?.postcode || "Missing"],
    [CalendarClock, "Scheduling", `${String(draft.scheduling?.startHour ?? 8).padStart(2, "0")}:${String(draft.scheduling?.startMin ?? 30).padStart(2, "0")}–${String(draft.scheduling?.endHour ?? 11).padStart(2, "0")}:${String(draft.scheduling?.endMin ?? 30).padStart(2, "0")}`, `${draft.scheduling?.maxConcurrent ?? 3} concurrent`],
    [UsersRound, "Resources", `${draft.teams?.length || 0} teams`, `${draft.pitches?.length || 0} pitches`],
    [Trophy, "Fixtures", draft.fixtures?.enabled ? "Full-Time enabled" : "Manual for now", draft.fixtures?.enabled ? "Source configured" : "Can connect later"],
  ];
  return (
    <div className="space-y-7">
      <StepHeader eyebrow="Final review" title="Ready to create the operating baseline" description="Completing setup saves the club profile, teams and pitches in one secured database transaction, then records the completion in the audit log." />
      <div className={`rounded-[24px] border p-5 ${readiness.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-center gap-3">
          {readiness.ready ? <CheckCircle2 size={25} className="text-emerald-700" /> : <CircleAlert size={25} className="text-amber-700" />}
          <div><div className="text-lg font-black text-slate-950">{readiness.ready ? "Configuration ready" : "A few items still need attention"}</div><div className="text-sm font-semibold text-slate-600">{readiness.completed} of {readiness.total} required areas pass validation.</div></div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(([Icon, label, value, helper]) => (
          <div key={label} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm"><Icon size={19} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-1 text-sm font-black text-slate-950">{value}</div><div className="mt-0.5 text-xs font-semibold text-slate-500">{helper}</div></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderStep(stepId, props) {
  if (stepId === "welcome") return <WelcomeStep />;
  if (stepId === "club") return <ClubStep {...props} />;
  if (stepId === "workspace") return <WorkspaceStep {...props} />;
  if (stepId === "venue") return <VenueStep {...props} />;
  if (stepId === "schedule") return <ScheduleStep {...props} />;
  if (stepId === "resources") return <ResourcesStep {...props} />;
  if (stepId === "fixtures") return <FixturesStep {...props} />;
  return <ReviewStep {...props} />;
}

export default function CustomerOnboardingWizard({
  open,
  onboarding,
  status = "ready",
  initialDraft,
  currentClub,
  canClose = false,
  onClose,
  onSaveProgress,
  onComplete,
}) {
  const [draft, setDraft] = useState(initialDraft || {});
  const [stepIndex, setStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(mergeDraft(initialDraft || {}, onboarding?.draft || {}));
    setStepIndex(Math.max(0, Math.min(onboarding?.currentStep || 0, ONBOARDING_STEPS.length - 1)));
    setCompletedSteps(Array.isArray(onboarding?.completedSteps) ? onboarding.completedSteps : []);
    setErrors([]);
  }, [initialDraft, onboarding?.completedSteps, onboarding?.currentStep, onboarding?.draft, open]);

  const step = ONBOARDING_STEPS[stepIndex] || ONBOARDING_STEPS[0];
  const progress = Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);
  const busy = saving || status === "saving";
  const readiness = useMemo(() => getOnboardingReadiness(draft), [draft]);

  if (!open) return null;

  const update = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  };

  const saveAndMove = async (nextIndex) => {
    const validation = validateOnboardingStep(step.id, draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    const nextCompleted = [...new Set([...completedSteps, step.id])];
    setSaving(true);
    try {
      await onSaveProgress?.({ currentStep: nextIndex, completedSteps: nextCompleted, draft });
      setCompletedSteps(nextCompleted);
      setStepIndex(nextIndex);
      setErrors([]);
    } catch (error) {
      setErrors([error?.message || "Progress could not be saved."]);
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    const validation = validateOnboardingStep("review", draft);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setSaving(true);
    try {
      const payload = buildOnboardingConfiguration(draft, currentClub);
      await onComplete?.({ ...payload, draft });
      setErrors([]);
    } catch (error) {
      setErrors([error?.message || "Setup could not be completed."]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#050816] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-4 sm:px-6 sm:py-6">
        <header className="flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950"><Sparkles size={21} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">Daxora Ground Control</div><div className="text-lg font-black">Customer setup</div></div></div>
          {canClose ? <button type="button" onClick={onClose} className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm font-black text-slate-200 hover:bg-white/10"><X size={17} /> Finish later</button> : <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">Required setup</div>}
        </header>

        <div className="mt-5 grid flex-1 gap-5 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4 text-white xl:self-start xl:sticky xl:top-6">
            <div className="px-2 pb-4"><div className="flex items-center justify-between text-xs font-black"><span>Setup progress</span><span className="text-emerald-300">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} /></div></div>
            <nav className="space-y-1">
              {ONBOARDING_STEPS.map((item, index) => {
                const active = index === stepIndex;
                const complete = completedSteps.includes(item.id) || index < stepIndex;
                return <button key={item.id} type="button" disabled={index > stepIndex && !complete} onClick={() => index <= stepIndex && setStepIndex(index)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${complete ? "bg-emerald-400 text-slate-950" : active ? "bg-slate-950 text-emerald-300" : "bg-white/10"}`}>{complete ? <Check size={16} /> : index + 1}</span><span><span className="block text-sm font-black">{item.label}</span><span className={`mt-0.5 block text-[11px] font-semibold ${active ? "text-slate-500" : "text-slate-500"}`}>{item.title}</span></span></button>;
              })}
            </nav>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4 text-xs font-semibold leading-5 text-slate-400"><ShieldCheck size={17} className="mb-2 text-emerald-300" />Draft progress is club-scoped and protected by Row Level Security.</div>
          </aside>

          <main className="flex min-h-[720px] flex-col overflow-hidden rounded-[32px] bg-white shadow-[0_35px_100px_rgba(0,0,0,0.4)]">
            <div className="flex-1 p-6 sm:p-8 lg:p-10">
              {renderStep(step.id, { draft, update })}
              {errors.length ? <div className="mt-7 rounded-[22px] border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><CircleAlert size={20} className="mt-0.5 shrink-0 text-rose-700" /><div><div className="text-sm font-black text-rose-900">Review this step</div><ul className="mt-2 space-y-1 text-sm font-semibold text-rose-800">{[...new Set(errors)].map((error) => <li key={error}>• {error}</li>)}</ul></div></div></div> : null}
            </div>

            <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <button type="button" disabled={stepIndex === 0 || busy} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-40"><ArrowLeft size={17} /> Back</button>
              <div className="text-center text-xs font-bold text-slate-400">Step {stepIndex + 1} of {ONBOARDING_STEPS.length}{status === "saving" ? " · Saving securely" : ""}</div>
              {step.id === "review" ? <button type="button" disabled={busy || !readiness.ready} onClick={finish} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={18} className="animate-spin" /> : <Flag size={18} />} Complete setup</button> : <button type="button" disabled={busy} onClick={() => saveAndMove(Math.min(stepIndex + 1, ONBOARDING_STEPS.length - 1))} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-lg shadow-slate-950/10 disabled:opacity-50">{busy ? <LoaderCircle size={18} className="animate-spin text-emerald-300" /> : null} Save & continue <ArrowRight size={17} className="text-emerald-300" /></button>}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
