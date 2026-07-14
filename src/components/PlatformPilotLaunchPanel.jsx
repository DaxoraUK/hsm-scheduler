import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Rocket,
  Save,
  ShieldCheck,
  Siren,
  UsersRound,
} from "lucide-react";
import { toast } from "../lib/notifications/daxoraNotifications.js";

import PlatformPilotEvidencePanel from "./PlatformPilotEvidencePanel.jsx";
import { DB } from "../lib/supabase.js";
import {
  createPilotDraft,
  LAUNCH_GATE_STATUSES,
  normalisePilotLaunchReadiness,
  PILOT_CHECKLIST_ITEMS,
  PILOT_HEALTH,
  PILOT_STAGES,
  validatePilotDraft,
} from "../lib/platform/pilotModel.js";

const inputClass = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const textAreaClass = "min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const primaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

function pretty(value = "") {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function toneFor(value) {
  if (["ready", "on_track", "graduated", "live_pilot"].includes(value)) return "emerald";
  if (["in_progress", "validation", "onboarding", "invited", "attention"].includes(value)) return "amber";
  if (["blocked", "withdrawn", "paused", "error"].includes(value)) return "rose";
  return "slate";
}

function Pill({ value, label }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${tones[toneFor(value)]}`}>{label || pretty(value)}</span>;
}

function Metric({ icon: Icon, value, label, helper, tone = "slate" }) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone] || tones.slate}`}><Icon size={19} /></div>
      <div className="mt-4 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-black text-slate-800">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="text-sm font-black text-slate-800">{title}</div>
      <div className="mx-auto mt-2 max-w-xl text-xs font-semibold leading-5 text-slate-500">{message}</div>
    </div>
  );
}

export default function PlatformPilotLaunchPanel({ clubs = [], isPlatformAdmin = false }) {
  const [readiness, setReadiness] = useState(() => normalisePilotLaunchReadiness({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [gateDrafts, setGateDrafts] = useState({});
  const [selectedPilotClubId, setSelectedPilotClubId] = useState("");
  const [pilotDraft, setPilotDraft] = useState(() => createPilotDraft(""));
  const [resolutionNotes, setResolutionNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = normalisePilotLaunchReadiness(await DB.platformGetPilotLaunchReadiness());
      setReadiness(next);
      setGateDrafts(Object.fromEntries(next.gates.map((gate) => [gate.code, {
        status: gate.status,
        evidence: gate.evidence,
        ownerLabel: gate.ownerLabel,
        dueDate: gate.dueDate || "",
      }])));
      setSelectedPilotClubId((current) => current || next.pilots[0]?.clubId || "");
    } catch (loadError) {
      setError(loadError?.message || "Pilot and launch readiness could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPilot = useMemo(
    () => readiness.pilots.find((pilot) => pilot.clubId === selectedPilotClubId) || null,
    [readiness.pilots, selectedPilotClubId]
  );

  useEffect(() => {
    if (!selectedPilotClubId) {
      setPilotDraft(createPilotDraft(""));
      return;
    }
    if (!selectedPilot) {
      setPilotDraft(createPilotDraft(selectedPilotClubId));
      return;
    }
    setPilotDraft({
      clubId: selectedPilot.clubId,
      stage: selectedPilot.stage,
      health: selectedPilot.health,
      coordinatorUserId: selectedPilot.coordinatorUserId,
      targetStartDate: selectedPilot.targetStartDate || "",
      targetReviewDate: selectedPilot.targetReviewDate || "",
      notes: selectedPilot.notes,
      checklist: Object.fromEntries(PILOT_CHECKLIST_ITEMS.map(([key]) => [key, Boolean(selectedPilot.checklist[key])])),
    });
  }, [selectedPilot, selectedPilotClubId]);

  const saveGate = async (gate) => {
    if (!isPlatformAdmin) return;
    const draft = gateDrafts[gate.code] || {};
    setBusy(`gate:${gate.code}`);
    try {
      await DB.platformUpdateLaunchGate({ code: gate.code, ...draft });
      toast.success("Launch gate updated");
      await load();
    } catch (saveError) {
      toast.error("Launch gate could not be updated", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const savePilot = async () => {
    if (!isPlatformAdmin) return;
    const validationErrors = validatePilotDraft(pilotDraft);
    if (validationErrors.length) {
      toast.error("Pilot details need attention", { description: validationErrors[0] });
      return;
    }
    setBusy("pilot");
    try {
      await DB.platformUpsertPilot(pilotDraft);
      toast.success("Pilot record updated");
      await load();
    } catch (saveError) {
      toast.error("Pilot record could not be updated", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const resolveEvent = async (eventId) => {
    setBusy(`event:${eventId}`);
    try {
      await DB.platformResolveClientEvent(eventId, resolutionNotes[eventId] || "Reviewed by Daxora support");
      toast.success("Client event resolved");
      await load();
    } catch (resolveError) {
      toast.error("Client event could not be resolved", { description: resolveError?.message });
    } finally {
      setBusy("");
    }
  };

  if (loading && !readiness.gates.length) {
    return <div className="flex min-h-[520px] items-center justify-center rounded-[30px] border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-emerald-600" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300"><Rocket size={14} /> Pilot and launch control</div>
            <h2 className="mt-4 text-3xl font-black tracking-tight">Turn launch readiness into evidence.</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Track the platform gates, pilot-club handover and production client errors without relying on a separate spreadsheet.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white hover:bg-white/15 disabled:opacity-50"><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh</button>
        </div>
        {error ? <div role="alert" className="border-t border-rose-200 bg-rose-50 px-6 py-4 text-sm font-bold text-rose-800">{error}</div> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Gauge} value={`${readiness.summary.gatePercent}%`} label="Launch gates ready" helper={`${readiness.summary.gateReady} of ${readiness.summary.gateTotal} gates`} tone={readiness.summary.gateBlocked ? "rose" : readiness.summary.gatePercent === 100 ? "emerald" : "amber"} />
        <Metric icon={UsersRound} value={readiness.summary.pilotTotal} label="Pilot clubs" helper={`${readiness.summary.pilotLive} currently live`} tone="slate" />
        <Metric icon={AlertTriangle} value={readiness.summary.pilotBlocked} label="Blocked pilots" helper="Need intervention before progression" tone={readiness.summary.pilotBlocked ? "rose" : "emerald"} />
        <Metric icon={Siren} value={readiness.summary.openClientErrors} label="Open client errors" helper="Unresolved production telemetry" tone={readiness.summary.openClientErrors ? "rose" : "emerald"} />
        <Metric icon={ShieldCheck} value={readiness.summary.billingLegalReady ? "Ready" : "Blocked"} label="Billing and legal" helper="Commercial checkout readiness" tone={readiness.summary.billingLegalReady ? "emerald" : "amber"} />
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div><h3 className="text-xl font-black text-slate-950">Platform launch gates</h3><p className="mt-1 text-sm font-semibold text-slate-500">A gate is only Ready when evidence exists and the accountable owner has verified it.</p></div>
          {!isPlatformAdmin ? <Pill value="in_progress" label="Read-only support view" /> : null}
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {readiness.gates.map((gate) => {
            const draft = gateDrafts[gate.code] || {};
            return (
              <article key={gate.code} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{pretty(gate.category)}</div><div className="mt-1 text-sm font-black text-slate-950">{gate.title}</div></div>
                  <Pill value={draft.status || gate.status} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black text-slate-600">Status<select disabled={!isPlatformAdmin} value={draft.status || gate.status} onChange={(event) => setGateDrafts((current) => ({ ...current, [gate.code]: { ...current[gate.code], status: event.target.value } }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{LAUNCH_GATE_STATUSES.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Due date<input disabled={!isPlatformAdmin} type="date" value={draft.dueDate || ""} onChange={(event) => setGateDrafts((current) => ({ ...current, [gate.code]: { ...current[gate.code], dueDate: event.target.value } }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
                </div>
                <label className="mt-3 block text-xs font-black text-slate-600">Owner<input disabled={!isPlatformAdmin} value={draft.ownerLabel || ""} onChange={(event) => setGateDrafts((current) => ({ ...current, [gate.code]: { ...current[gate.code], ownerLabel: event.target.value } }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
                <label className="mt-3 block text-xs font-black text-slate-600">Evidence<textarea disabled={!isPlatformAdmin} value={draft.evidence || ""} onChange={(event) => setGateDrafts((current) => ({ ...current, [gate.code]: { ...current[gate.code], evidence: event.target.value } }))} className={`${textAreaClass} mt-2 disabled:bg-slate-100`} placeholder="Record the test, document, deployment or decision that closes this gate." /></label>
                <div className="mt-3 flex items-center justify-between gap-3"><div className="text-[11px] font-semibold text-slate-400">{gate.lastVerifiedAt ? `Verified ${formatDate(gate.lastVerifiedAt)}${gate.lastVerifiedByName ? ` by ${gate.lastVerifiedByName}` : ""}` : "Not yet verified"}</div>{isPlatformAdmin ? <button type="button" onClick={() => saveGate(gate)} disabled={busy === `gate:${gate.code}`} className={primaryButton}>{busy === `gate:${gate.code}` ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save gate</button> : null}</div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-950">Pilot clubs</h3><p className="mt-1 text-xs font-semibold text-slate-500">Choose an existing club to create or update its pilot record.</p>
          <select value={selectedPilotClubId} onChange={(event) => setSelectedPilotClubId(event.target.value)} className={`${inputClass} mt-4`}><option value="">Select club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
          <div className="mt-4 space-y-3">
            {readiness.pilots.length ? readiness.pilots.map((pilot) => <button key={pilot.clubId} type="button" onClick={() => setSelectedPilotClubId(pilot.clubId)} className={`w-full rounded-2xl border p-3 text-left ${pilot.clubId === selectedPilotClubId ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-black text-slate-900">{pilot.clubName}</div><div className="mt-1 text-xs font-semibold text-slate-500">{pilot.checklistComplete}/{pilot.checklistTotal} checks complete</div></div><Pill value={pilot.health} /></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pilot.checklistPercent}%` }} /></div><div className="mt-2"><Pill value={pilot.stage} /></div></button>) : <EmptyState title="No pilot clubs yet" message="Select a club above and save a pilot record when the design-partner process begins." />}
          </div>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {!selectedPilotClubId ? <EmptyState title="Select a pilot club" message="Pilot stages, readiness checks and review dates will be managed here." /> : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">{clubs.find((club) => club.id === selectedPilotClubId)?.name || selectedPilot?.clubName || "Pilot club"}</h3><p className="mt-1 text-sm font-semibold text-slate-500">Keep status factual. A blocked pilot must include a clear note and owner.</p></div>{selectedPilot ? <Pill value={selectedPilot.stage} /> : <Pill value="not_started" label="New pilot record" />}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black text-slate-600">Stage<select disabled={!isPlatformAdmin} value={pilotDraft.stage} onChange={(event) => setPilotDraft((current) => ({ ...current, stage: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_STAGES.map((stage) => <option key={stage} value={stage}>{pretty(stage)}</option>)}</select></label>
                <label className="text-xs font-black text-slate-600">Health<select disabled={!isPlatformAdmin} value={pilotDraft.health} onChange={(event) => setPilotDraft((current) => ({ ...current, health: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_HEALTH.map((health) => <option key={health} value={health}>{pretty(health)}</option>)}</select></label>
                <label className="text-xs font-black text-slate-600">Target start<input disabled={!isPlatformAdmin} type="date" value={pilotDraft.targetStartDate || ""} onChange={(event) => setPilotDraft((current) => ({ ...current, targetStartDate: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
                <label className="text-xs font-black text-slate-600">Review date<input disabled={!isPlatformAdmin} type="date" value={pilotDraft.targetReviewDate || ""} onChange={(event) => setPilotDraft((current) => ({ ...current, targetReviewDate: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
              </div>
              <div><div className="flex items-center gap-2 text-sm font-black text-slate-900"><ClipboardCheck size={18} className="text-emerald-600" /> Pilot checklist</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{PILOT_CHECKLIST_ITEMS.map(([key, label]) => <label key={key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"><input disabled={!isPlatformAdmin} type="checkbox" checked={Boolean(pilotDraft.checklist[key])} onChange={(event) => setPilotDraft((current) => ({ ...current, checklist: { ...current.checklist, [key]: event.target.checked } }))} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" /><span className="text-xs font-bold leading-5 text-slate-700">{label}</span></label>)}</div></div>
              <label className="block text-xs font-black text-slate-600">Internal pilot notes<textarea disabled={!isPlatformAdmin} value={pilotDraft.notes} onChange={(event) => setPilotDraft((current) => ({ ...current, notes: event.target.value }))} className={`${textAreaClass} mt-2 disabled:bg-slate-100`} placeholder="Record decisions, blockers, training notes and the next agreed action." /></label>
              {isPlatformAdmin ? <button type="button" onClick={savePilot} disabled={busy === "pilot"} className={primaryButton}>{busy === "pilot" ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save pilot record</button> : null}
            </div>
          )}
        </div>
      </section>

      <PlatformPilotEvidencePanel
        gates={readiness.gates}
        selectedPilot={selectedPilot}
        selectedClubName={clubs.find((club) => club.id === selectedPilotClubId)?.name || selectedPilot?.clubName || ""}
        isPlatformAdmin={isPlatformAdmin}
        onRefresh={load}
      />

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700"><Siren size={21} /></span><div><h3 className="text-xl font-black text-slate-950">Unresolved client events</h3><p className="mt-1 text-sm font-semibold text-slate-500">Only sanitised diagnostic information is stored. Club fixture and personal data are excluded.</p></div></div>
        <div className="mt-5 space-y-3">
          {readiness.clientEvents.length ? readiness.clientEvents.map((event) => (
            <article key={event.id} className="rounded-[24px] border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Pill value={event.level} /><Pill value="slate" label={pretty(event.category)} /></div><div className="mt-3 text-sm font-black text-slate-900">{event.message}</div><div className="mt-2 text-xs font-semibold text-slate-500">{event.clubName} · {formatDate(event.createdAt)}{event.reference ? ` · ${event.reference}` : ""}</div><div className="mt-1 text-[11px] font-semibold text-slate-400">{event.environment || "unknown environment"}{event.release ? ` · ${event.release}` : ""}{event.route ? ` · ${event.route}` : ""}</div></div><CircleDot size={18} className="mt-1 shrink-0 text-rose-500" /></div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={resolutionNotes[event.id] || ""} onChange={(changeEvent) => setResolutionNotes((current) => ({ ...current, [event.id]: changeEvent.target.value }))} className={inputClass} placeholder="Resolution note" /><button type="button" onClick={() => resolveEvent(event.id)} disabled={busy === `event:${event.id}`} className={primaryButton}>{busy === `event:${event.id}` ? <LoaderCircle className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Resolve</button></div>
            </article>
          )) : <EmptyState title="No unresolved client errors" message="Application crashes and unhandled background failures will appear here after migration 007 is applied." />}
        </div>
      </section>
    </div>
  );
}
