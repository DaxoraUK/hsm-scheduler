import React from "react";
import {
  Building2,
  CalendarCheck2,
  CloudSun,
  MapPin,
  ParkingCircle,
  ShieldCheck,
  UsersRound,
  Waves,
} from "lucide-react";

const TONE = {
  success: {
    card: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    icon: "bg-white text-emerald-700 ring-emerald-200",
    chip: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  warning: {
    card: "border-amber-200 bg-amber-50/80 text-amber-950",
    icon: "bg-white text-amber-700 ring-amber-200",
    chip: "bg-amber-100 text-amber-800 ring-amber-200",
  },
  danger: {
    card: "border-rose-200 bg-rose-50/80 text-rose-950",
    icon: "bg-white text-rose-700 ring-rose-200",
    chip: "bg-rose-100 text-rose-800 ring-rose-200",
  },
};

const DOMAIN_ICONS = {
  configuration: Building2,
  matchday: Waves,
  resources: MapPin,
  parking: ParkingCircle,
  officials: ShieldCheck,
  weather: CloudSun,
  communications: UsersRound,
};

export default function ClubDigitalTwinCard({ twin, onOpenOperations, onOpenSettings }) {
  if (!twin) return null;

  const statusTone = TONE[twin.status] || TONE.success;
  const metrics = twin.metrics || {};

  const liveModel = [
    {
      label: "Sites",
      value: metrics.sites || 0,
      detail: "active",
    },
    {
      label: "Teams playing",
      value: `${metrics.teamsPlaying || 0}/${metrics.teamsConfigured || 0}`,
      detail: "this weekend",
    },
    {
      label: "Fixtures",
      value: metrics.fixturesScheduled || 0,
      detail: "scheduled",
    },
    {
      label: "Pitches",
      value: `${metrics.pitchesAvailable || 0}/${metrics.pitchesConfigured || 0}`,
      detail: "available",
    },
    {
      label: "Officials",
      value: `${metrics.officialsAssigned || 0}/${metrics.officialsRequired || 0}`,
      detail: "confirmed",
    },
    {
      label: "Parking",
      value: metrics.parkingCapacity ? `${metrics.parkingUtilisation || 0}%` : "Set",
      detail: metrics.parkingCapacity
        ? metrics.parkingScope === "weekend-peak"
          ? `${metrics.parkingPeakDay || "Weekend"} peak`
          : `${metrics.parkingPeakCars || 0}/${metrics.parkingCapacity} peak`
        : "capacity needed",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.32em] text-emerald-700">
            Club Digital Twin
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Live club model
          </h2>
          <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-slate-500">
            A single operational view of configuration, matchday activity, resources, parking, officials,
            weather and communications.
          </p>
        </div>

        <div className={`flex items-center gap-4 rounded-[26px] border px-5 py-4 ${statusTone.card}`}>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${statusTone.icon}`}>
            <CalendarCheck2 size={24} strokeWidth={2.6} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] opacity-70">
              Model health
            </div>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-3xl font-black leading-none">{twin.score}%</span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone.chip}`}>
                {twin.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(twin.domains || []).map((domain) => (
            <DomainTile key={domain.id} domain={domain} />
          ))}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                Live model
              </div>
              <div className="mt-1 text-xl font-black text-slate-950">
                Weekend operating state
              </div>
            </div>
            <div className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-slate-500 ring-1 ring-slate-200 sm:block">
              {metrics.weatherLocation || "Weather location needed"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {liveModel.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  {item.label}
                </div>
                <div className="mt-2 text-2xl font-black text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>

          {Array.isArray(metrics.parkingDayBreakdown) && metrics.parkingDayBreakdown.length > 1 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {metrics.parkingDayBreakdown.map((day) => (
                <div
                  key={day.key || day.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      {day.label}
                    </div>
                    <div className="mt-1 text-sm font-black text-slate-950">
                      {day.peakCars || 0}/{day.capacity || 0} spaces at {day.peakTime || "TBC"}
                    </div>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                      day.utilisation > 100
                        ? "bg-rose-50 text-rose-700 ring-rose-200"
                        : day.utilisation >= 85
                          ? "bg-amber-50 text-amber-700 ring-amber-200"
                          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    }`}
                  >
                    {day.utilisation || 0}%
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={onOpenOperations}
            className="group flex items-center justify-between rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
          >
            <span>
              <span className="block text-sm font-black text-slate-950">Open Operations</span>
              <span className="mt-1 block text-sm font-semibold text-slate-500">
                Review fixtures, resources, parking and communications.
              </span>
            </span>
            <span className="text-2xl font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700">
              →
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="group flex items-center justify-between rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50"
          >
            <span>
              <span className="block text-sm font-black text-slate-950">Open Settings Centre</span>
              <span className="mt-1 block text-sm font-semibold text-slate-500">
                Configure teams, venues, pitches and weather defaults.
              </span>
            </span>
            <span className="text-2xl font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-700">
              →
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

function DomainTile({ domain }) {
  const Icon = DOMAIN_ICONS[domain.id] || Building2;
  const tone = TONE[domain.status] || TONE.success;

  return (
    <div className={`min-h-[174px] rounded-[28px] border p-5 ${tone.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.26em] opacity-70">
            {domain.label}
          </div>
          <div className="mt-3 text-3xl font-black text-slate-950">{domain.score}%</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${tone.icon}`}>
          <Icon size={22} strokeWidth={2.4} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-base font-black text-slate-950">
        <span className={`h-2.5 w-2.5 rounded-full ${domain.status === "success" ? "bg-emerald-500" : domain.status === "warning" ? "bg-amber-500" : "bg-rose-500"}`} />
        {domain.summary}
      </div>
      <p className="mt-2 text-sm font-semibold leading-6 opacity-80">{domain.detail}</p>
    </div>
  );
}
