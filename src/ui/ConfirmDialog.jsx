import React, { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, Sparkles, X } from "lucide-react";

const TONES = {
  danger: {
    icon: AlertTriangle,
    iconClass: "bg-rose-50 text-rose-700",
    buttonClass: "bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-200",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-amber-50 text-amber-700",
    buttonClass: "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-200",
  },
  success: {
    icon: Sparkles,
    iconClass: "bg-emerald-50 text-emerald-700",
    buttonClass: "bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-200",
  },
  info: {
    icon: Info,
    iconClass: "bg-sky-50 text-sky-700",
    buttonClass: "bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-200",
  },
};

export default function ConfirmDialog({
  open,
  eyebrow = "Please confirm",
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  busy = false,
  initialFocus = "confirm",
  children,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => {
      const target = initialFocus === "cancel" ? cancelRef.current : confirmRef.current;
      target?.focus();
    }, 0);

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, initialFocus, onCancel, open]);

  if (!open) return null;

  const toneConfig = TONES[tone] || TONES.warning;
  const ToneIcon = toneConfig.icon;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close confirmation"
        onClick={() => !busy && onCancel?.()}
        className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
      />

      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? "confirm-dialog-description" : undefined}
        className="relative w-full max-w-lg overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-5 sm:px-7">
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onCancel}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-4 pr-10">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneConfig.iconClass}`}>
              <ToneIcon size={23} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 pt-0.5">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                {eyebrow}
              </div>
              <h2 id="confirm-dialog-title" className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {title}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          {description ? (
            <p id="confirm-dialog-description" className="text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
          ) : null}

          {children ? <div className="mt-4">{children}</div> : null}

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              ref={cancelRef}
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className={`h-11 rounded-2xl px-4 text-sm font-black text-white transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-60 ${toneConfig.buttonClass}`}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400">
            <CheckCircle2 size={13} /> Escape or outside click cancels
          </div>
        </div>
      </section>
    </div>
  );
}
