import React from "react";

export default function Card({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
  padded = true,
}) {
  const hasHeader = Boolean(eyebrow || title || subtitle || action);

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {hasHeader ? (
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-6">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                {eyebrow}
              </div>
            ) : null}

            {title ? (
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                {title}
              </h2>
            ) : null}

            {subtitle ? (
              <p className="mt-2 text-base font-medium leading-7 text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>

          {action ? <div className="min-w-0 sm:shrink-0">{action}</div> : null}
        </div>
      ) : null}

      <div className={`${padded ? "p-4 sm:p-6" : ""} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
