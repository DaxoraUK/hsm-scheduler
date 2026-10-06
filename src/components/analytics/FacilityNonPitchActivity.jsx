import React from "react";

export default function FacilityNonPitchActivity({ rows = [] }) {
  if (!rows.length) return null;
  const scopeLabels = { away: "Away fixture", external: "External site", unallocated: "No configured pitch" };
  return <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm print:break-before-page print:rounded-none print:shadow-none">
    <div className="p-5 sm:p-6">
      <h2 className="text-xl font-black text-slate-950">Away / external / unallocated activity</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">These {rows.length} records are retained for reference but excluded from club-pitch usage. No local capacity percentage is calculated.</p>
    </div>
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm print:min-w-0 print:text-xs">
        <thead><tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {["Date", "Team / activity", "Venue / allocation", "Status", "Recorded hours", "Use"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100 print:break-inside-avoid">
          <td className="px-4 py-4 whitespace-nowrap">{row.date}</td>
          <td className="px-4 py-4"><div className="font-bold text-slate-950">{row.teamName}</div><div className="mt-1 text-xs text-slate-500">{row.usageLabel}</div></td>
          <td className="px-4 py-4"><div>{row.pitchName}</div><div className="mt-1 text-xs text-slate-500">{scopeLabels[row.facilityScope] || "Not club-pitch usage"}</div></td>
          <td className="px-4 py-4">{row.statusLabel}</td>
          <td className="px-4 py-4">{Math.round(row.durationHours * 10) / 10}h</td>
          <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">N/A</span></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
