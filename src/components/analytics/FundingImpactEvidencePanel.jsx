import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import StatusChip from "../../ui/StatusChip.jsx";
import ConfirmDialog from "../../ui/ConfirmDialog.jsx";
import {
  createFundingImpactDraft,
  deleteFundingImpactEvidence,
  loadFundingImpactEvidence,
  saveFundingImpactEvidence,
  summariseFundingImpactEvidence,
  validateFundingImpactRecord,
} from "../../lib/grants/fundingImpactEvidenceService.js";

const INPUT = "mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";
const TEXTAREA = "mt-2 min-h-24 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function Metric({ label, value, detail, icon: Icon, tone = "slate" }) {
  const styles = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    slate: "border-slate-200 bg-white text-slate-950",
  }[tone];
  return (
    <div className={`rounded-[22px] border p-4 ${styles}`}>
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{label}</div><div className="mt-2 text-2xl font-black">{value}</div><div className="mt-1 text-xs font-semibold opacity-70">{detail}</div></div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/75 ring-1 ring-black/5"><Icon size={19} /></div>
      </div>
    </div>
  );
}

function formatPeriod(record) {
  const format = (value) => {
    if (!value) return "Not dated";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  return record.periodStart === record.periodEnd ? format(record.periodStart) : `${format(record.periodStart)} – ${format(record.periodEnd)}`;
}

function numberInput(value, onChange) {
  return {
    className: INPUT,
    type: "number",
    min: "0",
    step: "1",
    value: value || "",
    onChange: (event) => onChange(Number(event.target.value || 0)),
  };
}

export default function FundingImpactEvidencePanel({
  clubId,
  projectId,
  canManage = true,
  onEvidenceChange,
}) {
  const [mode, setMode] = useState("loading");
  const [reason, setReason] = useState("");
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState(() => createFundingImpactDraft(projectId));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const summary = useMemo(() => summariseFundingImpactEvidence(records), [records]);

  useEffect(() => {
    onEvidenceChange?.(records);
  }, [onEvidenceChange, records]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setMode("idle");
      setRecords([]);
      setDraft(createFundingImpactDraft(""));
      return () => { cancelled = true; };
    }
    setMode("loading");
    loadFundingImpactEvidence(clubId, projectId)
      .then((result) => {
        if (cancelled) return;
        setMode(result.mode);
        setReason(result.reason || "");
        setRecords(result.records);
        setDraft(createFundingImpactDraft(projectId));
        setEditing(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setMode("error");
        setReason(error?.message || "Impact evidence could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [clubId, projectId]);

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const startNew = () => {
    setDraft(createFundingImpactDraft(projectId));
    setEditing(true);
  };

  const editRecord = (record) => {
    setDraft(record);
    setEditing(true);
  };

  const saveRecord = async () => {
    const candidate = { ...draft, projectId };
    const errors = validateFundingImpactRecord(candidate);
    if (errors.length) {
      toast.error("Impact record needs attention", { description: errors.join(" ") });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveFundingImpactEvidence(clubId, candidate, mode);
      setRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setDraft(createFundingImpactDraft(projectId));
      setEditing(false);
      toast.success(saved.status === "verified" ? "Verified impact evidence saved" : "Impact evidence draft saved", {
        description: saved.status === "verified" ? "This record can now appear in application-ready funding packs." : "Draft figures remain excluded from external claim totals.",
      });
    } catch (error) {
      toast.error("Impact evidence could not be saved", { description: error?.message || "Try again." });
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFundingImpactEvidence(clubId, deleteTarget.id, mode);
      setRecords((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Impact evidence removed");
    } catch (error) {
      toast.error("Impact evidence could not be removed", { description: error?.message || "Try again." });
    }
  };

  if (!projectId) {
    return (
      <div className="mt-6 rounded-[26px] border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <div className="flex items-start gap-4"><AlertTriangle size={22} className="mt-1 shrink-0" /><div><h3 className="text-lg font-black">Save the funding project first</h3><p className="mt-2 text-sm font-semibold leading-6">Completed sessions, attendance, participants and volunteer evidence must belong to a saved project so every claim has a stable audit trail.</p></div></div>
      </div>
    );
  }

  if (mode === "loading") {
    return <div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-600"><Loader2 size={19} className="animate-spin text-emerald-600" /> Loading impact evidence…</div>;
  }

  return (
    <div className="mt-6 space-y-5">
      <div className={`flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6 ${mode === "remote" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : mode === "error" ? "border-rose-200 bg-rose-50 text-rose-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
        {mode === "remote" ? <CheckCircle2 size={19} className="mt-0.5 shrink-0" /> : <AlertTriangle size={19} className="mt-0.5 shrink-0" />}
        <div><strong>{mode === "remote" ? "Shared impact evidence active." : "Local draft mode."}</strong> {reason || (mode === "remote" ? "Verified records are available to authorised club users and can be included in funding packs." : "Apply the impact-evidence migration before relying on these records across devices.")}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Verified records" value={summary.verifiedRecords} detail={`${summary.draftRecords} draft record${summary.draftRecords === 1 ? "" : "s"} excluded from claim totals.`} icon={FileCheck2} tone="emerald" />
        <Metric label="Completed sessions" value={summary.completedSessions} detail="Manually verified delivery, separate from scheduled fixtures." icon={ClipboardCheck} tone="sky" />
        <Metric label="Unique participants" value={summary.uniqueParticipants} detail={`${summary.attendanceVisits} total attendance visits recorded.`} icon={UsersRound} tone="slate" />
        <Metric label="Volunteer hours" value={summary.volunteerHours} detail={`${summary.volunteerCount} volunteers recorded across verified periods.`} icon={Clock3} tone="amber" />
      </div>

      <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Outcome evidence register</div>
          <h3 className="mt-1 text-xl font-black text-slate-950">Record only figures the club can evidence</h3>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">Attendance visits count every visit; unique participants count different people. Demographic groups may overlap. Ground Control never derives these figures from fixtures.</p>
        </div>
        <button type="button" onClick={startNew} disabled={!canManage} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-40"><Plus size={17} /> Add evidence period</button>
      </div>

      {editing ? (
        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">{draft.id ? "Edit evidence period" : "New evidence period"}</div><h3 className="mt-1 text-xl font-black text-slate-950">Completed activity and participation</h3></div>
            <StatusChip status={draft.status === "verified" ? "success" : "warning"}>{draft.status === "verified" ? "Verified for reporting" : "Draft only"}</StatusChip>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Period start"><input className={INPUT} type="date" value={draft.periodStart} onChange={(event) => setField("periodStart", event.target.value)} disabled={!canManage} /></Field>
            <Field label="Period end"><input className={INPUT} type="date" value={draft.periodEnd} onChange={(event) => setField("periodEnd", event.target.value)} disabled={!canManage} /></Field>
            <Field label="Evidence status"><select className={INPUT} value={draft.status} onChange={(event) => setField("status", event.target.value)} disabled={!canManage}><option value="draft">Draft — exclude from claim totals</option><option value="verified">Verified — include in funding packs</option></select></Field>
            <Field label="Evidence method"><select className={INPUT} value={draft.evidenceMethod} onChange={(event) => setField("evidenceMethod", event.target.value)} disabled={!canManage}><option value="manual_count">Manual count or register</option><option value="attendance_system">Attendance system export</option><option value="membership_register">Membership register</option><option value="survey">Participant survey</option><option value="combined">Combined evidence sources</option></select></Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Field label="Completed sessions"><input {...numberInput(draft.completedSessions, (value) => setField("completedSessions", value))} disabled={!canManage} /></Field>
            <Field label="Attendance visits" hint="Repeat visits included."><input {...numberInput(draft.attendanceVisits, (value) => setField("attendanceVisits", value))} disabled={!canManage} /></Field>
            <Field label="Unique participants" hint="Distinct people only."><input {...numberInput(draft.uniqueParticipants, (value) => setField("uniqueParticipants", value))} disabled={!canManage} /></Field>
            <Field label="Community sessions"><input {...numberInput(draft.communitySessions, (value) => setField("communitySessions", value))} disabled={!canManage} /></Field>
            <Field label="Cancelled sessions"><input {...numberInput(draft.cancelledSessions, (value) => setField("cancelledSessions", value))} disabled={!canManage} /></Field>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Field label="Under-18 participants"><input {...numberInput(draft.youthParticipants, (value) => setField("youthParticipants", value))} disabled={!canManage} /></Field>
            <Field label="Women & girls"><input {...numberInput(draft.womenGirlsParticipants, (value) => setField("womenGirlsParticipants", value))} disabled={!canManage} /></Field>
            <Field label="Disabled participants"><input {...numberInput(draft.disabilityParticipants, (value) => setField("disabilityParticipants", value))} disabled={!canManage} /></Field>
            <Field label="Volunteers"><input {...numberInput(draft.volunteerCount, (value) => setField("volunteerCount", value))} disabled={!canManage} /></Field>
            <Field label="Volunteer hours"><input className={INPUT} type="number" min="0" step="0.25" value={draft.volunteerHours || ""} onChange={(event) => setField("volunteerHours", Number(event.target.value || 0))} disabled={!canManage} /></Field>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Source label" hint="Required before the record can be verified. Example: signed attendance register, Spond export or volunteer rota."><input className={INPUT} value={draft.sourceLabel} onChange={(event) => setField("sourceLabel", event.target.value)} placeholder="e.g. Summer programme attendance register" disabled={!canManage} /></Field>
            <Field label="Verified by" hint="Record the adult officer or volunteer who checked the figures."><input className={INPUT} value={draft.verifiedBy} onChange={(event) => setField("verifiedBy", event.target.value)} placeholder="Name and role" disabled={!canManage} /></Field>
            <Field label="Outcome summary"><textarea className={TEXTAREA} value={draft.outcomeSummary} onChange={(event) => setField("outcomeSummary", event.target.value)} placeholder="What changed during this period? Keep claims factual and measurable." disabled={!canManage} /></Field>
            <Field label="Evidence notes"><textarea className={TEXTAREA} value={draft.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Limitations, double-counting controls, missing groups or follow-up actions." disabled={!canManage} /></Field>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-emerald-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-bold leading-5 text-slate-600">Verified records can support a funding application, but the attached source and club review remain the evidence of truth.</div>
            <div className="flex gap-2"><button type="button" onClick={() => { setEditing(false); setDraft(createFundingImpactDraft(projectId)); }} disabled={saving} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700">Cancel</button><button type="button" onClick={saveRecord} disabled={!canManage || saving} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save evidence</button></div>
          </div>
        </section>
      ) : null}

      {records.length ? (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"><tr><th className="px-4 py-3">Evidence period</th><th className="px-4 py-3">Delivery</th><th className="px-4 py-3">Participation</th><th className="px-4 py-3">Inclusion & volunteers</th><th className="px-4 py-3">Source</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="px-4 py-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><CalendarDays size={18} /></div><div><div className="text-sm font-black text-slate-950">{formatPeriod(record)}</div><div className="mt-1"><StatusChip status={record.status === "verified" ? "success" : "warning"} size="sm">{record.status === "verified" ? "Verified" : "Draft"}</StatusChip></div></div></div></td>
                    <td className="px-4 py-4 text-sm font-semibold leading-6 text-slate-700"><strong>{record.completedSessions}</strong> completed<br /><span className="text-slate-500">{record.communitySessions} community · {record.cancelledSessions} cancelled</span></td>
                    <td className="px-4 py-4 text-sm font-semibold leading-6 text-slate-700"><strong>{record.uniqueParticipants}</strong> unique<br /><span className="text-slate-500">{record.attendanceVisits} attendance visits</span></td>
                    <td className="px-4 py-4 text-sm font-semibold leading-6 text-slate-700">{record.womenGirlsParticipants} women/girls · {record.disabilityParticipants} disabled<br /><span className="text-slate-500">{record.volunteerCount} volunteers · {record.volunteerHours} hours</span></td>
                    <td className="max-w-xs px-4 py-4 text-sm font-semibold leading-6 text-slate-600"><div className="font-black text-slate-800">{record.sourceLabel || "Source not recorded"}</div><div className="mt-1 line-clamp-2 text-xs">{record.outcomeSummary || record.notes || "No outcome note recorded."}</div></td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2"><button type="button" onClick={() => editRecord(record)} disabled={!canManage} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Pencil size={14} /> Edit</button><button type="button" onClick={() => setDeleteTarget(record)} disabled={!canManage} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 px-3 text-xs font-black text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 size={14} /> Remove</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><UsersRound size={28} className="mx-auto text-slate-400" /><h3 className="mt-3 text-lg font-black text-slate-950">No completed-activity evidence recorded</h3><p className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">Operational schedules can show planned demand, but they cannot prove delivery, attendance or beneficiaries. Add a verified evidence period when the club has a reliable source.</p></div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove this impact record?"
        description="The figures will be removed from future funding packs. Existing downloaded or snapshotted packs will not be changed."
        confirmLabel="Remove record"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeRecord}
      />
    </div>
  );
}
