import React from "react";
import { Activity, CalendarClock, Gauge, MapPinned, UsersRound, Wrench } from "lucide-react";

function Metric({ icon: Icon, label, value, detail }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 print:break-inside-avoid print:bg-white"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 print:hidden"><Icon size={19} strokeWidth={2.5} /></div></div></div>;
}

function hours(value) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
}

export default function UnifiedFacilityReportDocument({ model, club = {} }) {
  const metrics = model?.metrics || {};
  return <article className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
    <header className="border-b border-slate-200 pb-5"><div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">Unified facility evidence</div><h2 className="mt-1 text-2xl font-black text-slate-950">{club.name || "Club"} facility utilisation</h2><p className="mt-2 text-sm font-semibold text-slate-500">{model.filters.startDate} to {model.filters.endDate} · Fixtures, training, friendlies, events, winter provision, closures and unused capacity.</p></header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6 print:grid-cols-3">
      <Metric icon={Gauge} label="Utilisation" value={`${metrics.utilisationPct || 0}%`} detail={`${hours(metrics.facilityHours)} of ${hours(metrics.usableFacilityHours)} usable`} />
      <Metric icon={Activity} label="Team-hours" value={hours(metrics.teamHours)} detail={`${metrics.records || 0} booking and fixture records`} />
      <Metric icon={CalendarClock} label="Delivered" value={hours(metrics.deliveredHours)} detail={`${hours(metrics.scheduledHours)} scheduled or awaiting delivery`} />
      <Metric icon={Wrench} label="Downtime" value={hours(metrics.closureHours)} detail="Weather, maintenance and closures" />
      <Metric icon={MapPinned} label="Unused" value={hours(metrics.unusedHours)} detail="Configured usable capacity not occupied" />
      <Metric icon={UsersRound} label="Teams served" value={metrics.teams || 0} detail={`${metrics.waitingTeams || 0} waiting · £${Number(metrics.costPerDeliveredTeamHour || 0).toFixed(2)} per delivered hour`} />
    </section>

    <section className="print:break-inside-avoid"><div className="mb-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Usage mix</div><h3 className="mt-1 text-lg font-black text-slate-950">What used the facilities</h3></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">{model.usage.map((row) => <div key={row.type} className="rounded-2xl border border-slate-200 p-4"><div className="text-xs font-black text-slate-900">{row.label}</div><div className="mt-2 text-xl font-black text-slate-950">{hours(row.hours)}</div><div className="mt-1 text-xs font-semibold text-slate-500">{hours(row.facilityHours)} pitch-equivalent · {row.bookings} records</div></div>)}</div></section>

    <section className="print:break-before-page"><div className="mb-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Pitch and site evidence</div><h3 className="mt-1 text-lg font-black text-slate-950">Combined operational use</h3></div><div className="overflow-x-auto rounded-2xl border border-slate-200 print:overflow-visible print:rounded-none"><table className="w-full min-w-[980px] border-collapse text-left text-xs print:min-w-0"><thead><tr className="bg-slate-950 text-white print:bg-slate-100 print:text-slate-950"><th className="px-3 py-3">Facility</th><th className="px-3 py-3">Records</th><th className="px-3 py-3">Team-hours</th><th className="px-3 py-3">Pitch hours</th><th className="px-3 py-3">Fixtures</th><th className="px-3 py-3">Training</th><th className="px-3 py-3">Other</th><th className="px-3 py-3">Downtime</th><th className="px-3 py-3">Unused</th><th className="px-3 py-3">Use</th></tr></thead><tbody>{model.facilities.map((row) => <tr key={row.id} className="border-t border-slate-200 even:bg-slate-50 print:break-inside-avoid"><td className="px-3 py-3"><div className="font-black text-slate-950">{row.pitchName}</div><div className="text-[10px] font-semibold text-slate-500">{row.siteName}</div></td><td className="px-3 py-3 font-semibold">{row.bookings}</td><td className="px-3 py-3 font-semibold">{hours(row.teamHours)}</td><td className="px-3 py-3 font-semibold">{hours(row.facilityHours)}</td><td className="px-3 py-3 font-semibold">{hours(row.fixtureHours)}</td><td className="px-3 py-3 font-semibold">{hours(row.trainingHours)}</td><td className="px-3 py-3 font-semibold">{hours(row.friendlyHours + row.eventHours + row.hireHours + row.winterHours + row.otherHours)}</td><td className="px-3 py-3 font-semibold text-rose-700">{hours(row.closureHours)}</td><td className="px-3 py-3 font-semibold">{hours(row.unusedHours)}</td><td className="px-3 py-3 font-black">{row.utilisationPct}%</td></tr>)}</tbody></table></div></section>

    <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr] print:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 print:bg-white"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">Grant and investment narrative</div><ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-emerald-950">{model.grantNarratives.map((row) => <li key={row}>• {row}</li>)}</ul></div><div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 print:bg-white"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-800">Methodology</div><p className="mt-3 text-sm font-semibold leading-6 text-sky-950">{model.methodology}</p></div></section>
  </article>;
}
