import React from "react";

export default function SectionHeader({ eyebrow, title, description, action, className = "" }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-[0.32em] text-emerald-700">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-2 text-base font-bold leading-7 text-slate-600">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
