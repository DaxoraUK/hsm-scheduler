import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react";
import { FUNDING_DOCUMENT_RULES } from "../../lib/grants/fundingWorkspaceService.js";

const INPUT_CLASS = "mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-semibold leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function FundingDocumentUploadDialog({
  open,
  requirements = [],
  initialRequirementKey = "",
  busy = false,
  onSubmit,
  onCancel,
}) {
  const fileInputRef = useRef(null);
  const [requirementKey, setRequirementKey] = useState(initialRequirementKey || "");
  const [documentType, setDocumentType] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRequirementKey(initialRequirementKey || requirements[0]?.key || "");
    setDocumentType("");
    setReviewDate("");
    setFile(null);
  }, [initialRequirementKey, open, requirements]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel, open]);

  const selectedRequirement = useMemo(
    () => requirements.find((item) => item.key === requirementKey) || null,
    [requirementKey, requirements]
  );

  if (!open) return null;

  const submit = () => {
    if (!file || !requirementKey) return;
    onSubmit?.({
      requirementKey,
      file,
      documentType: documentType.trim() || selectedRequirement?.title || "Supporting evidence",
      reviewDate,
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Close document upload" onClick={() => !busy && onCancel?.()} className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" />
      <section role="dialog" aria-modal="true" aria-labelledby="funding-upload-title" className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-7">
          <button type="button" aria-label="Close" disabled={busy} onClick={onCancel} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
          <div className="flex items-start gap-4 pr-10">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Upload size={23} strokeWidth={2.4} /></span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Funding evidence</div>
              <h2 id="funding-upload-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">Upload a supporting document</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Link the file to the requirement it supports so the evidence library stays organised and auditable.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-7">
          <Field label="Supports requirement" hint="Choose the checklist item this document helps satisfy.">
            <select className={INPUT_CLASS} value={requirementKey} onChange={(event) => setRequirementKey(event.target.value)} disabled={busy}>
              <option value="">Choose a requirement</option>
              {requirements.map((item) => <option key={item.key} value={item.key}>{item.category} — {item.title}</option>)}
            </select>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Document type" hint="Optional; the requirement title is used if left blank.">
              <input className={INPUT_CLASS} value={documentType} onChange={(event) => setDocumentType(event.target.value)} placeholder="e.g. Constitution, quotation, lease" disabled={busy} />
            </Field>
            <Field label="Review or expiry date" hint="Useful for policies, leases, insurance and time-limited evidence.">
              <input className={INPUT_CLASS} type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} disabled={busy} />
            </Field>
          </div>

          <div className={`rounded-[24px] border-2 border-dashed p-6 text-center ${file ? "border-emerald-300 bg-emerald-50" : "border-slate-300 bg-slate-50"}`}>
            <input ref={fileInputRef} type="file" className="hidden" accept={FUNDING_DOCUMENT_RULES.accept} onChange={(event) => setFile(event.target.files?.[0] || null)} />
            {file ? <FileText size={30} className="mx-auto text-emerald-700" /> : <Upload size={30} className="mx-auto text-slate-400" />}
            <div className="mt-3 text-sm font-black text-slate-950">{file ? file.name : "Choose the document from your device"}</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">PDF, Word, Excel, CSV, text or image · maximum {FUNDING_DOCUMENT_RULES.maxFileSizeLabel}</div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"><Upload size={15} /> {file ? "Choose a different file" : "Choose file"}</button>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
            Uploading evidence moves a missing requirement to <strong>In progress</strong>, not automatically to Ready. A club administrator should still check that the document fully satisfies the funder's requirement.
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={busy} onClick={onCancel} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" disabled={busy || !file || !requirementKey} onClick={submit} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />} {busy ? "Uploading…" : "Upload and link evidence"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
