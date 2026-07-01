import React, { useEffect, useRef, useState } from "react";

export default function DropdownMenu({
  trigger,
  items = [],
  align = "right",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <div onClick={() => setOpen((value) => !value)}>{trigger({ open })}</div>

      {open && (
        <div
          className={`absolute top-full z-50 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 shadow-xl ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key || item.label || index}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Icon && (
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-950">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="block truncate text-xs font-bold text-slate-500">
                      {item.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
