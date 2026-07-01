import React from "react";
import StatusChip from "./StatusChip.jsx";

function toneForScore(score = 0) {
  if (score >= 90) return "ready";
  if (score >= 70) return "watch";
  return "danger";
}

export default function HealthIndicator({ score = 0, label = "Health", status, className = "" }) {
  const numericScore = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 0;
  const tone = status || toneForScore(numericScore);
  return (
    <div className={`flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 ${className}`}>
      <div>
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <div className="mt-1 text-3xl font-black text-slate-950">{numericScore}%</div>
      </div>
      <StatusChip status={tone}>{tone === "ready" ? "Ready" : tone === "danger" ? "Action" : "Watch"}</StatusChip>
    </div>
  );
}
