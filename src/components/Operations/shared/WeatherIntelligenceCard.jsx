import React from "react";
import { CloudSun, MapPin, RadioTower, ShieldCheck, TriangleAlert } from "lucide-react";
import StatusChip from "../../ui/StatusChip.jsx";

function CheckIcon({ status }) {
  const danger = status === "warn";
  const Icon = danger ? TriangleAlert : ShieldCheck;

  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
  );
}

export default function WeatherIntelligenceCard({ weather }) {
  const statusVariant = weather?.status === "warning" ? "warning" : "success";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
            <CloudSun size={28} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
              Weather Intelligence
            </div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {weather?.location || "Location not set"}
            </h3>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-500">
              Foundation only. This prepares Ground Control for live forecast, pitch-risk and postponement intelligence using the club venue postcode and future site-specific locations.
            </p>
          </div>
        </div>
        <StatusChip variant={statusVariant}>{weather?.label || "Ready"}</StatusChip>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            <MapPin size={14} strokeWidth={2.5} /> Location
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">{weather?.location || "—"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            <RadioTower size={14} strokeWidth={2.5} /> Provider
          </div>
          <div className="mt-2 text-2xl font-black text-slate-950">{weather?.provider || "Foundation"}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Readiness</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{weather?.score ?? 0}%</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {(weather?.checks || []).map((check) => (
          <div key={check.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <CheckIcon status={check.status} />
              <div>
                <div className="text-sm font-black text-slate-950">{check.label}</div>
                <p className="mt-1 text-sm font-bold leading-5 text-slate-500">{check.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-sky-100 bg-sky-50 p-5 text-sky-950">
        <div className="text-xs font-black uppercase tracking-[0.22em] text-sky-600">Next weather sprint</div>
        <ul className="mt-3 space-y-2 text-sm font-bold leading-6 text-sky-900">
          {(weather?.nextSteps || []).map((step) => (
            <li key={step}>• {step}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
