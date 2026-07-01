import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  DoorOpen,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Sprout,
} from "lucide-react";

export default function GroundStatusCard({
  pitchCfg = [],
  closedPitches = [],
  parkingStats,
  setMainPage,
  setDayTab,
}) {
  const total = pitchCfg.length;
  const closed = closedPitches.length;
  const open = Math.max(total - closed, 0);
  const allOpen = closed === 0;
  const parkingPct = parkingStats?.pct ?? 0;
  const parkingOk = !parkingStats?.overCapacity;

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-5 border-b border-slate-200 p-6">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
            Ground Status
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {allOpen ? "All pitches open" : `${closed} pitch${closed === 1 ? "" : "es"} closed`}
          </h2>
          <p className="mt-2 max-w-xl text-base font-semibold leading-7 text-slate-500">
            Pitches, parking and venue readiness at a glance.
          </p>
        </div>

        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl ring-1 ${
            allOpen
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-amber-100"
          }`}
        >
          {allOpen ? <CheckCircle2 size={30} /> : <AlertTriangle size={30} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusTile icon={ShieldCheck} label="Pitches" value={`${open}/${total || 0}`} detail="Available" tone={allOpen ? "success" : "warning"} />
          <StatusTile icon={Car} label="Parking" value={parkingStats ? `${parkingPct}%` : "Pending"} detail="Peak use" tone={parkingOk ? "success" : "warning"} />
          <StatusTile icon={MapPin} label="Sites" value="Primary" detail="Venue active" tone="success" />
          <StatusTile icon={DoorOpen} label="Facilities" value="Open" detail="Default status" tone="success" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniStatus label="Surface" value="Playable" />
          <MiniStatus label="Lights" value="Available" />
          <MiniStatus label="Access" value="Open" />
        </div>

        <button
          type="button"
          onClick={() => {
            setMainPage("operations");
            setDayTab("saturday");
          }}
          className="mt-5 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:scale-[0.99]"
        >
          Open ground operations
          <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}

function StatusTile({ icon: Icon, label, value, detail, tone = "success" }) {
  const toneClass =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] opacity-80">
          {label}
        </div>
        <Icon size={20} strokeWidth={2.4} />
      </div>
      <div className="mt-5 text-3xl font-black tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-sm font-black opacity-90">{detail}</div>
    </div>
  );
}

function MiniStatus({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 truncate text-sm font-black text-slate-950">{value}</div>
    </div>
  );
}
