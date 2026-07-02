import React from "react";

const ACCENTS = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-sky-50 text-sky-700",
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-700",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "emerald",
  onClick,
  className = "",
}) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition ${
        onClick
          ? "cursor-pointer hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
          : "hover:shadow-md"
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">
            {title}
          </div>

          <div className="mt-3 text-4xl font-black tracking-tight text-slate-950">
            {value}
          </div>

          {subtitle ? <div className="mt-2 text-sm font-medium text-slate-500">{subtitle}</div> : null}
        </div>

        {Icon ? (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${ACCENTS[accent] || ACCENTS.emerald}`}>
            <Icon size={24} strokeWidth={2.5} />
          </div>
        ) : null}
      </div>
    </Wrapper>
  );
}
