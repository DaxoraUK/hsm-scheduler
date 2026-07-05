import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  Gauge,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { toast } from "sonner";

import { DB } from "../lib/supabase.js";
import { getClientStagingDiagnostics } from "../lib/platform/stagingReadiness.js";
import {
  createLaunchEvidenceDraft,
  createPilotFindingDraft,
  createPilotSessionDraft,
  DEPLOYMENT_ENVIRONMENTS,
  LAUNCH_EVIDENCE_RESULTS,
  LAUNCH_EVIDENCE_TYPES,
  normalisePilotEvidencePayload,
  PILOT_CYCLES,
  PILOT_FINDING_SEVERITIES,
  PILOT_FINDING_STATUSES,
  PILOT_FINDING_TYPES,
  PILOT_OUTCOMES,
  PILOT_SESSION_STATUSES,
  validateLaunchEvidenceDraft,
  validatePilotFindingDraft,
  validatePilotSessionDraft,
} from "../lib/platform/pilotEvidenceModel.js";

const inputClass = "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const textAreaClass = "min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
const primaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function pretty(value = "") {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value, includeTime = true) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function toneClass(value = "") {
  const key = String(value || "").toLowerCase();
  if (["pass", "completed", "resolved"].includes(key)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["fail", "blocked", "critical", "high"].includes(key)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (["conditional", "in_progress", "observation", "medium"].includes(key)) return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function Pill({ value, label }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(value)}`}>{label || pretty(value)}</span>;
}

function Metric({ icon: Icon, value, label, helper, tone = "slate" }) {
  const iconTone = tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${iconTone}`}><Icon size={18} /></div>
      <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-black text-slate-800">{label}</div>
      <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div>
    </div>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <label className="text-xs font-black text-slate-600">
      {label}
      <input type="number" min="0" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} className={`${inputClass} mt-2`} />
    </label>
  );
}

export default function PlatformPilotEvidencePanel({ gates = [], selectedPilot = null, selectedClubName = "", isPlatformAdmin = false, onRefresh }) {
  const diagnostics = useMemo(() => getClientStagingDiagnostics(), []);
  const [payload, setPayload] = useState(() => normalisePilotEvidencePayload({}));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState(() => createLaunchEvidenceDraft({ gateCode: "staging_environment", environment: diagnostics.environment, release: diagnostics.release }));
  const [sessionDraft, setSessionDraft] = useState(() => createPilotSessionDraft(selectedPilot?.clubId || ""));
  const [findingDraft, setFindingDraft] = useState(() => createPilotFindingDraft(""));

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await DB.platformGetPilotEvidence(selectedPilot?.clubId || null);
      setPayload(normalisePilotEvidencePayload(result));
    } catch (loadError) {
      setError(loadError?.message || "Structured launch and pilot evidence could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [selectedPilot?.clubId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSessionDraft(createPilotSessionDraft(selectedPilot?.clubId || ""));
    setFindingDraft(createPilotFindingDraft(""));
  }, [selectedPilot?.clubId]);

  const useDiagnostics = () => {
    setEvidenceDraft((current) => ({
      ...current,
      gateCode: gates.some((gate) => gate.code === "staging_environment") ? "staging_environment" : current.gateCode,
      evidenceType: "deployment",
      result: diagnostics.ready ? "pass" : "fail",
      environment: diagnostics.environment,
      release: diagnostics.release,
      observedAt: new Date().toISOString().slice(0, 16),
      summary: `${diagnostics.passed} of ${diagnostics.total} browser-visible staging checks passed on ${diagnostics.host}. ${diagnostics.summary}`,
      metadata: {
        host: diagnostics.host,
        protocol: diagnostics.protocol,
        checks: diagnostics.checks.map(({ code, passed, detail }) => ({ code, passed, detail })),
      },
    }));
  };

  const saveEvidence = async () => {
    if (!isPlatformAdmin) return;
    const validationErrors = validateLaunchEvidenceDraft(evidenceDraft);
    if (validationErrors.length) {
      toast.error("Evidence needs attention", { description: validationErrors[0] });
      return;
    }
    setBusy("evidence");
    try {
      await DB.platformRecordLaunchGateEvidence(evidenceDraft);
      toast.success("Launch evidence recorded");
      setEvidenceDraft(createLaunchEvidenceDraft({ gateCode: evidenceDraft.gateCode, environment: diagnostics.environment, release: diagnostics.release }));
      await Promise.all([load(), onRefresh?.()]);
    } catch (saveError) {
      toast.error("Launch evidence could not be saved", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const saveSession = async () => {
    if (!isPlatformAdmin) return;
    const validationErrors = validatePilotSessionDraft(sessionDraft);
    if (validationErrors.length) {
      toast.error("Pilot session needs attention", { description: validationErrors[0] });
      return;
    }
    setBusy("session");
    try {
      await DB.platformUpsertPilotSession(sessionDraft);
      toast.success(sessionDraft.id ? "Pilot session updated" : "Pilot session recorded");
      setSessionDraft(createPilotSessionDraft(selectedPilot?.clubId || ""));
      await Promise.all([load(), onRefresh?.()]);
    } catch (saveError) {
      toast.error("Pilot session could not be saved", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const saveFinding = async () => {
    if (!isPlatformAdmin) return;
    const validationErrors = validatePilotFindingDraft(findingDraft);
    if (validationErrors.length) {
      toast.error("Pilot finding needs attention", { description: validationErrors[0] });
      return;
    }
    setBusy("finding");
    try {
      await DB.platformUpsertPilotFinding(findingDraft);
      toast.success(findingDraft.id ? "Pilot finding updated" : "Pilot finding recorded");
      setFindingDraft(createPilotFindingDraft(findingDraft.sessionId));
      await Promise.all([load(), onRefresh?.()]);
    } catch (saveError) {
      toast.error("Pilot finding could not be saved", { description: saveError?.message });
    } finally {
      setBusy("");
    }
  };

  const editSession = (session) => {
    setSessionDraft({
      ...session,
      sessionDate: session.sessionDate || "",
    });
  };

  const editFinding = (finding) => {
    setFindingDraft({ ...finding });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${diagnostics.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><FlaskConical size={21} /></span>
              <div>
                <h3 className="text-xl font-black text-slate-950">Staging environment self-check</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Browser-visible configuration only. Database isolation, backups and mobile smoke tests still require separate evidence.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Pill value={diagnostics.ready ? "pass" : "conditional"} label={`${diagnostics.passed}/${diagnostics.total} checks`} />
            <Pill value="observation" label={diagnostics.environment} />
            <Pill value="observation" label={diagnostics.release} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {diagnostics.checks.map((check) => (
            <div key={check.code} className={`rounded-2xl border p-3 ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">{check.passed ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertTriangle size={16} className="text-amber-700" />}{check.label}</div>
              <div className="mt-2 text-[11px] font-semibold leading-5 text-slate-600">{check.detail}</div>
            </div>
          ))}
        </div>
        {isPlatformAdmin ? <button type="button" onClick={useDiagnostics} className={`${secondaryButton} mt-4`}><FileCheck2 size={16} /> Use this check as evidence</button> : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><ShieldCheck size={21} /></span><div><h3 className="text-xl font-black text-slate-950">Record structured launch evidence</h3><p className="mt-1 text-sm font-semibold text-slate-500">Ready status is blocked until the latest definitive evidence for a gate is a pass.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-black text-slate-600">Launch gate<select disabled={!isPlatformAdmin} value={evidenceDraft.gateCode} onChange={(event) => setEvidenceDraft((current) => ({ ...current, gateCode: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}><option value="">Select gate</option>{gates.map((gate) => <option key={gate.code} value={gate.code}>{gate.title}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Evidence type<select disabled={!isPlatformAdmin} value={evidenceDraft.evidenceType} onChange={(event) => setEvidenceDraft((current) => ({ ...current, evidenceType: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{LAUNCH_EVIDENCE_TYPES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Result<select disabled={!isPlatformAdmin} value={evidenceDraft.result} onChange={(event) => setEvidenceDraft((current) => ({ ...current, result: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{LAUNCH_EVIDENCE_RESULTS.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Environment<select disabled={!isPlatformAdmin} value={evidenceDraft.environment} onChange={(event) => setEvidenceDraft((current) => ({ ...current, environment: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{DEPLOYMENT_ENVIRONMENTS.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Release<input disabled={!isPlatformAdmin} value={evidenceDraft.release} onChange={(event) => setEvidenceDraft((current) => ({ ...current, release: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="ground-control-2026.07.05.1" /></label>
            <label className="text-xs font-black text-slate-600">Observed at<input disabled={!isPlatformAdmin} type="datetime-local" value={evidenceDraft.observedAt || ""} onChange={(event) => setEvidenceDraft((current) => ({ ...current, observedAt: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
          </div>
          <label className="mt-3 block text-xs font-black text-slate-600">Evidence summary<textarea disabled={!isPlatformAdmin} value={evidenceDraft.summary} onChange={(event) => setEvidenceDraft((current) => ({ ...current, summary: event.target.value }))} className={`${textAreaClass} mt-2 disabled:bg-slate-100`} placeholder="State what was tested, the data/environment used, the result and what the evidence proves." /></label>
          <label className="mt-3 block text-xs font-black text-slate-600">HTTPS evidence link<input disabled={!isPlatformAdmin} type="url" value={evidenceDraft.artifactUrl} onChange={(event) => setEvidenceDraft((current) => ({ ...current, artifactUrl: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="https://github.com/.../actions/runs/..." /></label>
          {isPlatformAdmin ? <button type="button" onClick={saveEvidence} disabled={busy === "evidence"} className={`${primaryButton} mt-4`}>{busy === "evidence" ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Record evidence</button> : null}
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-xl font-black text-slate-950">Evidence register</h3><p className="mt-1 text-sm font-semibold text-slate-500">Append-only records preserve failed tests and retests rather than overwriting them.</p></div><button type="button" onClick={load} disabled={loading} className={secondaryButton}><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Refresh</button></div>
          {error ? <div role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</div> : null}
          <div className="mt-5 space-y-3">
            {payload.launchEvidence.length ? payload.launchEvidence.slice(0, 12).map((item) => (
              <article key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.gateTitle}</div><div className="mt-2 text-sm font-black leading-6 text-slate-900">{item.summary}</div></div><div className="flex shrink-0 gap-2"><Pill value={item.result} /><Pill value="observation" label={item.environment} /></div></div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500"><span>{pretty(item.evidenceType)}</span><span>{item.release || "No release label"}</span><span>{formatDate(item.observedAt)}</span><span>{item.createdByName}</span>{item.artifactUrl ? <a href={item.artifactUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-emerald-700 hover:underline">Open evidence <ExternalLink size={12} /></a> : null}</div>
              </article>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">No structured launch evidence has been recorded. Apply migration 011, then record the automated release gate and staging smoke test.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ClipboardList size={21} /></span><div><h3 className="text-xl font-black text-slate-950">Controlled pilot evidence</h3><p className="mt-1 text-sm font-semibold text-slate-500">Record every historical replay, shadow-live week, controlled-use session and final decision.</p></div></div>
          <div className="flex flex-wrap gap-2"><Pill value="observation" label={`${payload.summary.sessionsCompleted}/${payload.summary.sessionsTotal} sessions completed`} /><Pill value={payload.summary.criticalFindings ? "critical" : "pass"} label={`${payload.summary.openFindings} open findings`} /></div>
        </div>

        {!selectedPilot ? <div className="mt-5 rounded-[24px] border border-dashed border-amber-300 bg-amber-50 p-6 text-center"><div className="text-sm font-black text-amber-900">Save the club pilot record first</div><div className="mt-2 text-xs font-semibold leading-5 text-amber-800">Choose Horwich St Mary’s above, complete the pilot owner/checklist record and save it before logging a controlled pilot session.</div></div> : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pilot session</div><div className="mt-1 text-lg font-black text-slate-950">{selectedClubName || selectedPilot.clubName}</div></div>{sessionDraft.id ? <Pill value="in_progress" label="Editing session" /> : <Pill value="observation" label="New session" />}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black text-slate-600">Cycle<select disabled={!isPlatformAdmin} value={sessionDraft.cycle} onChange={(event) => setSessionDraft((current) => ({ ...current, cycle: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_CYCLES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Status<select disabled={!isPlatformAdmin} value={sessionDraft.status} onChange={(event) => setSessionDraft((current) => ({ ...current, status: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_SESSION_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Session date<input disabled={!isPlatformAdmin} type="date" value={sessionDraft.sessionDate || ""} onChange={(event) => setSessionDraft((current) => ({ ...current, sessionDate: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label>
                  <label className="text-xs font-black text-slate-600">Operator<input disabled={!isPlatformAdmin} value={sessionDraft.operatorName} onChange={(event) => setSessionDraft((current) => ({ ...current, operatorName: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="Andrew Manville" /></label>
                  <label className="text-xs font-black text-slate-600">Outcome<select disabled={!isPlatformAdmin} value={sessionDraft.outcome} onChange={(event) => setSessionDraft((current) => ({ ...current, outcome: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_OUTCOMES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Sign-off name<input disabled={!isPlatformAdmin} value={sessionDraft.signoffName} onChange={(event) => setSessionDraft((current) => ({ ...current, signoffName: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="Required for successful sign-off" /></label>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <NumberInput label="Fixtures" value={sessionDraft.fixtureCount} onChange={(value) => setSessionDraft((current) => ({ ...current, fixtureCount: value }))} />
                  <NumberInput label="Automatically scheduled" value={sessionDraft.autoScheduledCount} onChange={(value) => setSessionDraft((current) => ({ ...current, autoScheduledCount: value }))} />
                  <NumberInput label="Manually resolved" value={sessionDraft.manualResolvedCount} onChange={(value) => setSessionDraft((current) => ({ ...current, manualResolvedCount: value }))} />
                  <NumberInput label="Unresolved" value={sessionDraft.unresolvedCount} onChange={(value) => setSessionDraft((current) => ({ ...current, unresolvedCount: value }))} />
                  <NumberInput label="Invalid recommendations" value={sessionDraft.invalidRecommendationCount} onChange={(value) => setSessionDraft((current) => ({ ...current, invalidRecommendationCount: value }))} />
                  <NumberInput label="Missed warnings" value={sessionDraft.missedWarningCount} onChange={(value) => setSessionDraft((current) => ({ ...current, missedWarningCount: value }))} />
                  <NumberInput label="Correct warnings" value={sessionDraft.correctWarningCount} onChange={(value) => setSessionDraft((current) => ({ ...current, correctWarningCount: value }))} />
                  <NumberInput label="Overrides" value={sessionDraft.overrideCount} onChange={(value) => setSessionDraft((current) => ({ ...current, overrideCount: value }))} />
                  <NumberInput label="Time saved (minutes)" value={sessionDraft.timeSavedMinutes} onChange={(value) => setSessionDraft((current) => ({ ...current, timeSavedMinutes: value }))} />
                  <NumberInput label="Critical defects" value={sessionDraft.criticalDefectCount} onChange={(value) => setSessionDraft((current) => ({ ...current, criticalDefectCount: value }))} />
                  <NumberInput label="High defects" value={sessionDraft.highDefectCount} onChange={(value) => setSessionDraft((current) => ({ ...current, highDefectCount: value }))} />
                </div>
                <label className="mt-4 block text-xs font-black text-slate-600">Outcome notes<textarea disabled={!isPlatformAdmin} value={sessionDraft.notes} onChange={(event) => setSessionDraft((current) => ({ ...current, notes: event.target.value }))} className={`${textAreaClass} mt-2 disabled:bg-slate-100`} placeholder="Record differences from the club's real process, corrections, user feedback, operational risk and the agreed next action." /></label>
                {isPlatformAdmin ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={saveSession} disabled={busy === "session"} className={primaryButton}>{busy === "session" ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />} Save pilot session</button>{sessionDraft.id ? <button type="button" onClick={() => setSessionDraft(createPilotSessionDraft(selectedPilot.clubId))} className={secondaryButton}>Cancel edit</button> : null}</div> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric icon={Gauge} value={payload.summary.sessionsTotal} label="Recorded sessions" helper="Across this pilot club" />
                <Metric icon={CheckCircle2} value={payload.summary.sessionsCompleted} label="Completed" helper="Outcome recorded" tone="emerald" />
                <Metric icon={AlertTriangle} value={payload.summary.openFindings} label="Open findings" helper="Need action or decision" tone={payload.summary.openFindings ? "amber" : "emerald"} />
                <Metric icon={Siren} value={payload.summary.criticalFindings} label="Critical findings" helper="Block progression" tone={payload.summary.criticalFindings ? "rose" : "emerald"} />
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-slate-200 p-4">
                <h4 className="text-base font-black text-slate-950">Pilot session history</h4>
                <div className="mt-4 space-y-3">
                  {payload.sessions.length ? payload.sessions.map((session) => (
                    <article key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{pretty(session.cycle)} · {formatDate(session.sessionDate, false)}</div><div className="mt-2 text-sm font-black text-slate-900">{session.fixtureCount} fixtures · {session.autoScheduledCount} automatic · {session.unresolvedCount} unresolved</div><div className="mt-1 text-xs font-semibold text-slate-500">{session.notes || "No session notes recorded."}</div></div><div className="flex shrink-0 flex-col items-end gap-2"><Pill value={session.outcome} /><Pill value={session.status} /></div></div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500"><span>{session.invalidRecommendationCount} invalid recommendations</span><span>{session.missedWarningCount} missed warnings</span><span>{session.criticalDefectCount} critical defects</span><span>{session.timeSavedMinutes} minutes saved</span></div>
                      {isPlatformAdmin ? <button type="button" onClick={() => editSession(session)} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-700 hover:underline"><Pencil size={14} /> Edit session</button> : null}
                    </article>
                  )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">No pilot sessions recorded for this club.</div>}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 p-4">
                <h4 className="text-base font-black text-slate-950">Defects, usability findings and learning</h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-black text-slate-600">Pilot session<select disabled={!isPlatformAdmin} value={findingDraft.sessionId} onChange={(event) => setFindingDraft((current) => ({ ...current, sessionId: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}><option value="">Select session</option>{payload.sessions.map((session) => <option key={session.id} value={session.id}>{pretty(session.cycle)} · {session.sessionDate}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Type<select disabled={!isPlatformAdmin} value={findingDraft.findingType} onChange={(event) => setFindingDraft((current) => ({ ...current, findingType: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_FINDING_TYPES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Severity<select disabled={!isPlatformAdmin} value={findingDraft.severity} onChange={(event) => setFindingDraft((current) => ({ ...current, severity: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_FINDING_SEVERITIES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                  <label className="text-xs font-black text-slate-600">Status<select disabled={!isPlatformAdmin} value={findingDraft.status} onChange={(event) => setFindingDraft((current) => ({ ...current, status: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`}>{PILOT_FINDING_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select></label>
                </div>
                <label className="mt-3 block text-xs font-black text-slate-600">Title<input disabled={!isPlatformAdmin} value={findingDraft.title} onChange={(event) => setFindingDraft((current) => ({ ...current, title: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="Closed pitch could still be selected manually" /></label>
                <label className="mt-3 block text-xs font-black text-slate-600">Description<textarea disabled={!isPlatformAdmin} value={findingDraft.description} onChange={(event) => setFindingDraft((current) => ({ ...current, description: event.target.value }))} className={`${textAreaClass} mt-2 disabled:bg-slate-100`} placeholder="Describe what happened, what should have happened and how the issue was reproduced." /></label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black text-slate-600">Workaround<input disabled={!isPlatformAdmin} value={findingDraft.workaround} onChange={(event) => setFindingDraft((current) => ({ ...current, workaround: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} /></label><label className="text-xs font-black text-slate-600">Defect/reference ID<input disabled={!isPlatformAdmin} value={findingDraft.reference} onChange={(event) => setFindingDraft((current) => ({ ...current, reference: event.target.value }))} className={`${inputClass} mt-2 disabled:bg-slate-100`} placeholder="GC-PILOT-001" /></label></div>
                {isPlatformAdmin ? <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={saveFinding} disabled={busy === "finding"} className={primaryButton}>{busy === "finding" ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />} Save finding</button>{findingDraft.id ? <button type="button" onClick={() => setFindingDraft(createPilotFindingDraft(findingDraft.sessionId))} className={secondaryButton}>Cancel edit</button> : null}</div> : null}
                <div className="mt-5 space-y-3">
                  {payload.findings.length ? payload.findings.map((finding) => (
                    <article key={finding.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Pill value={finding.severity} /><Pill value={finding.status} /><Pill value="observation" label={pretty(finding.findingType)} /></div><div className="mt-3 text-sm font-black text-slate-900">{finding.title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{finding.description}</div>{finding.workaround ? <div className="mt-2 text-xs font-bold text-amber-800">Workaround: {finding.workaround}</div> : null}</div>{isPlatformAdmin ? <button type="button" onClick={() => editFinding(finding)} className="shrink-0 text-emerald-700"><Pencil size={16} /></button> : null}</div></article>
                  )) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
