import React from "react";

export default function Card({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(eyebrow || title || subtitle || action) && (
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-6">
          <div>
            {eyebrow && (
              <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                {eyebrow}
              </div>
            )}

            {title && (
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {title}
              </h2>
            )}

            {subtitle && (
              <p className="mt-2 text-base font-medium text-slate-500">
                {subtitle}
              </p>
            )}
          </div>

          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}

      <div className="p-6">
        {children}
      </div>
    </section>
  );
}