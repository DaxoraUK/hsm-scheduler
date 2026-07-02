import React from "react";

export default function PageHeader({ eyebrow, title, subtitle, action, className = "" }) {
  return (
    <header className={`flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            {eyebrow}
          </div>
        ) : null}

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
          {title}
        </h1>

        {subtitle ? (
          <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
