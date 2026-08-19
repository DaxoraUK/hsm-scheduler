import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import { GroundControlMark } from "../BrandSplash.jsx";

const TONES = {
  danger: {
    icon: ShieldAlert,
    iconClass: "bg-rose-100 text-rose-700",
    confirmClass: "bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-200",
    eyebrow: "Destructive action",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "bg-amber-100 text-amber-800",
    confirmClass: "bg-amber-500 text-slate-950 hover:bg-amber-400 focus:ring-amber-200",
    eyebrow: "Confirmation required",
  },
  success: {
    icon: CheckCircle2,
    iconClass: "bg-emerald-100 text-emerald-700",
    confirmClass: "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-200",
    eyebrow: "Ready to continue",
  },
  info: {
    icon: Info,
    iconClass: "bg-sky-100 text-sky-700",
    confirmClass: "bg-slate-950 text-white hover:bg-slate-800 focus:ring-slate-200",
    eyebrow: "Daxora confirmation",
  },
};

export default function DaxoraConfirmDialog({ request, onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!request) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    window.setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onCancel, request]);

  if (!request) return null;
  const tone = TONES[request.tone] || TONES.warning;
  const Icon = tone.icon;

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-[#050816]/75 p-3 backdrop-blur-md sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="daxora-confirm-title" aria-describedby="daxora-confirm-description" className="w-full max-w-lg overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_32px_100px_rgba(2,6,23,0.45)]">
        <div className="relative overflow-hidden bg-[#07121f] px-5 py-5 text-white sm:px-6">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GroundControlMark className="h-11 w-11 shrink-0" title="Daxora Ground Control" />
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">{tone.eyebrow}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">Daxora Ground Control</div>
              </div>
            </div>
            <button type="button" aria-label="Cancel and close" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.iconClass}`}><Icon size={23} /></div>
            <div className="min-w-0">
              <h2 id="daxora-confirm-title" className="text-xl font-black tracking-tight text-slate-950">{request.title}</h2>
              <p id="daxora-confirm-description" className="mt-2 text-sm font-semibold leading-6 text-slate-600">{request.description}</p>
            </div>
          </div>

          {request.details?.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {request.details.map((detail, index) => (
                <div key={`${detail.label}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{detail.label}</span>
                  <span className="text-right text-sm font-black text-slate-900">{detail.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {request.warning ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">{request.warning}</div> : null}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={cancelRef} type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100">{request.cancelLabel || "Cancel"}</button>
            <button type="button" onClick={onConfirm} className={`inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-black transition focus:outline-none focus:ring-4 ${tone.confirmClass}`}>{request.confirmLabel || "Confirm"}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
