import React from "react";

const STATUS_STYLES = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-amber-200 bg-amber-50 text-amber-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  review: "border-orange-200 bg-orange-50 text-orange-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  red: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  development: "border-orange-200 bg-orange-50 text-orange-700",
};

export default function StatusChip({
  children,
  status,
  variant,
  size = "md",
  className = "",
  title,
}) {
  const resolvedStatus = status || variant || "neutral";
  const sizeClass =
    size === "sm"
      ? "h-7 px-3 text-xs"
      : size === "lg"
      ? "h-10 px-4 text-sm"
      : "h-8 px-3 text-xs";

  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full border font-black shadow-sm ${sizeClass} ${
        STATUS_STYLES[resolvedStatus] || STATUS_STYLES.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
