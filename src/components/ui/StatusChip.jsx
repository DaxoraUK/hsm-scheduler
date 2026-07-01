import React from "react";

const styles = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800",

  warning:
    "border-amber-200 bg-amber-50 text-amber-800",

  danger:
    "border-red-200 bg-red-50 text-red-800",

  info:
    "border-sky-200 bg-sky-50 text-sky-800",

  neutral:
    "border-slate-200 bg-slate-100 text-slate-700",
};

export default function StatusChip({
  children,
  variant = "neutral",
  className = "",
}) {
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm ${
        styles[variant] || styles.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}