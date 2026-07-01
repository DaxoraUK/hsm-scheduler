import React from "react";

export default function LoadingState({ label = "Loading", rows = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label={label}>
      <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}
