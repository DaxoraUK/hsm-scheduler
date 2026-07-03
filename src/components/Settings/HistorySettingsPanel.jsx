import React, { useState } from "react";
import { CalendarDays, History, RotateCcw, Trash2 } from "lucide-react";
import { DB, isSupaConfigured } from "../../lib/supabase.js";
import {
  Notice,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
} from "./SettingsPrimitives.jsx";

function countFixtures(week = {}) {
  return (week.scheduled || []).length + (week.sunScheduled || []).length + (week.midweekScheduled || []).length;
}

export default function HistorySettingsPanel({
  history = [],
  setHistory,
  setSatScheduled,
  setSatHasRun,
  setDayTab,
  activeClubId = "",
}) {
  const [deleteError, setDeleteError] = useState("");
  const totalFixtures = history.reduce((sum, week) => sum + countFixtures(week), 0);
  const latest = history[0] || null;

  const loadWeek = (week) => {
    setSatScheduled?.(week.scheduled || []);
    setSatHasRun?.(true);
    setDayTab?.("saturday");
  };

  const deleteWeek = async (week) => {
    const confirmed = window.confirm(`Delete ${week.dateLabel || "this saved matchweek"}?`);
    if (!confirmed) return;
    setDeleteError("");

    try {
      if (isSupaConfigured() && activeClubId) {
        await DB.deleteHistory(activeClubId, week.id);
      }
      setHistory?.((current) => current.filter((entry) => entry.id !== week.id));
    } catch (error) {
      setDeleteError(error?.message || "The saved matchweek could not be deleted.");
    }
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={History}
        eyebrow="Operational records"
        title="Matchweek history"
        description="Review saved matchweeks and reopen a previous Saturday schedule. History is also the evidence base for trends and funding analytics."
      />

      {deleteError ? <div className="mt-5"><Notice tone="danger">{deleteError}</Notice></div> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Saved matchweeks" value={history.length} tone="green" />
        <StatTile label="Recorded fixtures" value={totalFixtures} tone="blue" />
        <StatTile label="Latest save" value={latest?.savedAt ? new Date(latest.savedAt).toLocaleDateString("en-GB") : "None"} tone="slate" />
      </div>

      {!history.length ? (
        <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 p-10 text-center">
          <CalendarDays size={30} className="mx-auto text-slate-300" />
          <div className="mt-3 text-lg font-black text-slate-950">No saved matchweeks yet</div>
          <p className="mt-1 text-sm font-semibold text-slate-500">Saved Operations schedules will appear here and begin building the club’s evidence history.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[22px] border border-slate-200">
          <table className="min-w-[840px] w-full border-collapse text-left">
            <thead className="bg-slate-950 text-white">
              <tr>{['Matchweek', 'Saturday', 'Sunday', 'Midweek', 'Postponed', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em]">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {history.map((week) => (
                <tr key={week.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4"><div className="font-black text-slate-950">{week.dateLabel || "Saved matchweek"}</div><div className="mt-1 text-xs font-semibold text-slate-400">{week.savedAt ? new Date(week.savedAt).toLocaleString("en-GB") : ""}</div></td>
                  <td className="px-4 py-4 text-sm font-black text-slate-700">{(week.scheduled || []).length}</td>
                  <td className="px-4 py-4 text-sm font-black text-slate-700">{(week.sunScheduled || []).length}</td>
                  <td className="px-4 py-4 text-sm font-black text-slate-700">{(week.midweekScheduled || []).length}</td>
                  <td className="px-4 py-4 text-sm font-black text-slate-700">{(week.postponedGames || []).length || week.postponed || 0}</td>
                  <td className="px-4 py-4"><div className="flex gap-2"><SecondaryButton icon={RotateCcw} onClick={() => loadWeek(week)}>Load Saturday</SecondaryButton><SecondaryButton icon={Trash2} onClick={() => deleteWeek(week)}>Delete</SecondaryButton></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5"><Notice tone="warning">Loading a saved matchweek replaces the current Saturday schedule. Use a configuration backup before major changes to club setup.</Notice></div>
    </SettingsPanel>
  );
}
