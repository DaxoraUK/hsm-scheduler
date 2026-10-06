import React from "react";
import RecordCollection from "../lists/RecordCollection.jsx";
import SortableTableHeader from "../lists/SortableTableHeader.jsx";

export default function FacilityNonPitchActivity({ rows = [], interactive = true }) {
  if (!rows.length) return null;
  const scopeLabels = { away: "Away fixture", external: "External site", unallocated: "No configured pitch" };
  return <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm print:break-before-page print:rounded-none print:shadow-none">
    <div className="p-5 sm:p-6">
      <h2 className="text-xl font-black text-slate-950">Away / external / unallocated activity</h2>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">These {rows.length} records are retained for reference but excluded from club-pitch usage. No local capacity percentage is calculated.</p>
    </div>
    <RecordCollection label="Reference activity" rows={rows} interactive={interactive} columns={[{ key: "date", label: "Date", type: "date", value: row => row.date }, { key: "team", label: "Team / activity", type: "team", value: row => ({ name: row.teamName }) }, { key: "venue", label: "Venue / allocation", type: "text", value: row => row.pitchName }, { key: "status", label: "Status", type: "text", value: row => row.statusLabel }, { key: "hours", label: "Recorded hours", type: "number", value: row => row.durationHours }]} filterFields={[{ key: "scope", label: "Scope", value: row => row.facilityScope }, { key: "status", label: "Status", value: row => row.statusLabel }]}>{(displayRows, list) => <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm print:min-w-0 print:text-xs">
        <thead><tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
          {interactive ? <SortableTableHeader columnKey="date" label="Date" sort={list.sort} onSort={list.toggleSort} className="px-4 py-3" /> : <th className="px-4 py-3">Date</th>}
{interactive ? <SortableTableHeader columnKey="team" label="Team / activity" sort={list.sort} onSort={list.toggleSort} className="px-4 py-3" /> : <th className="px-4 py-3">Team / activity</th>}
{interactive ? <SortableTableHeader columnKey="venue" label="Venue / allocation" sort={list.sort} onSort={list.toggleSort} className="px-4 py-3" /> : <th className="px-4 py-3">Venue / allocation</th>}
{interactive ? <SortableTableHeader columnKey="status" label="Status" sort={list.sort} onSort={list.toggleSort} className="px-4 py-3" /> : <th className="px-4 py-3">Status</th>}
{interactive ? <SortableTableHeader columnKey="hours" label="Recorded hours" sort={list.sort} onSort={list.toggleSort} className="px-4 py-3" /> : <th className="px-4 py-3">Recorded hours</th>}<th className="px-4 py-3">Use</th>
        </tr></thead>
        <tbody>{displayRows.map((row) => <tr key={row.id} className="border-b border-slate-100 print:break-inside-avoid">
          <td className="px-4 py-4 whitespace-nowrap">{row.date}</td>
          <td className="px-4 py-4"><div className="font-bold text-slate-950">{row.teamName}</div><div className="mt-1 text-xs text-slate-500">{row.usageLabel}</div></td>
          <td className="px-4 py-4"><div>{row.pitchName}</div><div className="mt-1 text-xs text-slate-500">{scopeLabels[row.facilityScope] || "Not club-pitch usage"}</div></td>
          <td className="px-4 py-4">{row.statusLabel}</td>
          <td className="px-4 py-4">{Math.round(row.durationHours * 10) / 10}h</td>
          <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">N/A</span></td>
        </tr>)}</tbody>
      </table>
    </div>}</RecordCollection>
  </section>;
}
