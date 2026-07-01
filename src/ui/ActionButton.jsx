import React from "react";

const variants = {
  primary: "border-slate-950 bg-slate-950 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
  amber: "border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300",
  ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
  danger: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
};

export default function ActionButton({
  children,
  onClick,
  type = "button",
  variant = "secondary",
  disabled = false,
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-black shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
        variants[variant] || variants.secondary
      } ${className}`}
    >
      {children}
    </button>
  );
}
