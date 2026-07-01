import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ActionMenu({
  label = "Actions",
  actions = [],
  align = "right",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        {label}
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          className={`absolute z-50 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-xl ${
            align === "left" ? "left-0 top-full" : "right-0 top-full"
          }`}
        >
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id || action.label || index}
                type="button"
                disabled={action.disabled}
                onClick={() => {
                  if (action.disabled) return;
                  action.onClick?.();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Icon ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </span>
                ) : null}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-950">
                    {action.label}
                  </span>
                  {action.description ? (
                    <span className="block truncate text-xs font-bold text-slate-500">
                      {action.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
