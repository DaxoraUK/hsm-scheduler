import React from "react";

const TONES = {
  info: "border-sky-200 bg-sky-50 text-sky-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-900",
};

export default function InfoBanner({ tone = "info", title, children, icon: Icon, action, className = "" }) {
  return (
    <div className={`flex gap-4 rounded-3xl border p-4 ${TONES[tone] || TONES.info} ${className}`}>
      {Icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <div className="text-sm font-black">{title}</div> : null}
        {children ? <div className="mt-1 text-sm font-semibold opacity-80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
