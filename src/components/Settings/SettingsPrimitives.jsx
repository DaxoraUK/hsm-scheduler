import React from "react";
import { CheckCircle2, Info, Save } from "lucide-react";

export const inputClass =
  "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100";

export const selectClass = `${inputClass} pr-9`;

export function SettingsPanel({ children, className = "" }) {
  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7 ${className}`}>
      {children}
    </section>
  );
}

export function SettingsSectionHeader({ icon: Icon, eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300">
            <Icon size={21} strokeWidth={2.4} />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{eyebrow}</div>
          ) : null}
          <h2 className={`${eyebrow ? "mt-1.5" : ""} text-xl font-black tracking-tight text-slate-950 sm:text-2xl`}>
            {title}
          </h2>
          {description ? <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <div className="mt-2.5">{children}</div>
      {hint ? <span className="mt-2.5 block text-xs font-semibold leading-5 text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function StatTile({ label, value, detail, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    blue: "border-blue-200 bg-blue-50 text-blue-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    rose: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return (
    <div className={`rounded-[22px] border p-5 ${tones[tone] || tones.slate}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {detail ? <div className="mt-1.5 text-xs font-bold leading-5 opacity-65">{detail}</div> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  return (
    <div className={`flex items-center justify-between gap-5 rounded-[22px] border border-slate-200 p-5 ${disabled ? "bg-slate-50 opacity-60" : "bg-white"}`}>
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-950">{label}</div>
        {description ? <div className="mt-1.5 text-sm font-semibold leading-5 text-slate-500">{description}</div> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-300"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

export function Notice({ children, tone = "info", className = "" }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div className={`flex items-start gap-3.5 rounded-[22px] border px-5 py-4 text-sm font-semibold leading-6 ${tones[tone] || tones.info} ${className}`}>
      <Info size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled = false, type = "button", icon: Icon, className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {Icon ? <Icon size={17} className="text-emerald-300" /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled = false, type = "button", icon: Icon, className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
}

export function SaveBar({ onSave, saved, label = "Save changes", children }) {
  return (
    <div className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-h-10 flex-wrap items-center gap-2 text-sm font-semibold leading-6 text-slate-500">{children}</div>
      <div className="flex shrink-0 items-center gap-3">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-700">
            <CheckCircle2 size={16} /> Saved
          </span>
        ) : null}
        <PrimaryButton onClick={onSave} icon={Save}>{label}</PrimaryButton>
      </div>
    </div>
  );
}
