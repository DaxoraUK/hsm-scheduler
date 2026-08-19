import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { GroundControlMark } from "../BrandSplash.jsx";

export default function DaxoraPromptDialog({ request, onCancel, onConfirm }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!request) return undefined;
    setValue(String(request.defaultValue || ""));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onCancel, onConfirm, request]);

  const trimmedLength = value.trim().length;
  const valid = useMemo(() => {
    if (!request) return false;
    if (!request.required && !trimmedLength) return true;
    return trimmedLength >= Number(request.minLength || 0);
  }, [request, trimmedLength]);

  if (!request) return null;
  const Input = request.multiline ? "textarea" : "input";

  return (
    <div className="fixed inset-0 z-[240] flex items-end justify-center bg-[#050816]/75 p-3 backdrop-blur-md sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="daxora-prompt-title" className="w-full max-w-xl overflow-hidden rounded-[30px] border border-white/10 bg-white shadow-[0_32px_100px_rgba(2,6,23,0.45)]">
        <div className="relative overflow-hidden bg-[#07121f] px-5 py-5 text-white sm:px-6">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <GroundControlMark className="h-11 w-11 shrink-0" title="Daxora Ground Control" />
              <div><div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">Daxora guided response</div><div className="mt-1 text-xs font-bold text-slate-400">Captured in the operational workflow</div></div>
            </div>
            <button type="button" aria-label="Cancel and close" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <form className="p-5 sm:p-7" onSubmit={(event) => { event.preventDefault(); if (valid) onConfirm(value); }}>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><MessageSquareText size={23} /></div>
            <div className="min-w-0"><h2 id="daxora-prompt-title" className="text-xl font-black tracking-tight text-slate-950">{request.title}</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{request.description}</p></div>
          </div>

          <label className="mt-6 block">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{request.label || "Details"}</span>
            <Input
              ref={inputRef}
              value={value}
              readOnly={Boolean(request.readOnly)}
              rows={request.multiline ? 5 : undefined}
              onChange={(event) => setValue(event.target.value)}
              placeholder={request.placeholder || ""}
              className={`${request.multiline ? "min-h-32 resize-y py-3" : "h-11"} w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 read-only:bg-slate-50`}
            />
          </label>
          {request.helper ? <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{request.helper}</p> : null}
          {!valid && trimmedLength ? <p className="mt-2 text-xs font-black text-rose-700">Enter at least {request.minLength} characters.</p> : null}

          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">{request.cancelLabel || "Cancel"}</button>
            <button type="submit" disabled={!valid} className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45">{request.confirmLabel || "Continue"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
