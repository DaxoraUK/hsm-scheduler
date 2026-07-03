import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel, open]);

  if (!open) return null;
  const danger = tone === "danger";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Close confirmation" onClick={() => !busy && onCancel?.()} className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" />
      <section role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <button type="button" aria-label="Close" disabled={busy} onClick={onCancel} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
          <X size={18} />
        </button>
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${danger ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
          <AlertTriangle size={23} />
        </span>
        <h2 id="confirm-dialog-title" className="mt-5 pr-10 text-xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={onCancel} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{cancelLabel}</button>
          <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm} className={`h-11 rounded-2xl px-4 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60 ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
