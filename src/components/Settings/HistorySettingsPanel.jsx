import React, { useState } from "react";
import { CalendarDays, History, RotateCcw, Trash2 } from "lucide-react";
import { DB, isSupaConfigured } from "../../lib/supabase.js";
import { buildHistoryRestoreState } from "../../lib/history/historyRestore.js";
import ConfirmDialog from "@/ui/ConfirmDialog.jsx";
import {
  Notice,
  SecondaryButton,
  SettingsPanel,
  SettingsSectionHeader,
  StatTile,
} from "./SettingsPrimitives.jsx";

function historyCounts(week = {}) {
  const restored = buildHistoryRestoreState(week);
  const allFixtures = [
    ...restored.saturday.fixtures,
    ...restored.sunday.fixtures,
    ...restored.midweek.fixtures,
  ];
  return {
    saturday: restored.saturday.fixtures.length,
    sunday: restored.sunday.fixtures.length,
    midweek: restored.midweek.fixtures.length,
    postponed: allFixtures.filter((fixture) => fixture.status === "postponed").length,
    total: allFixtures.length,
  };
}

export default function HistorySettingsPanel({
  history = [],
  setHistory,
  onLoadHistory,
  activeClubId = "",
}) {
  const [deleteError, setDeleteError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const totalFixtures = history.reduce((sum, week) => sum + historyCounts(week).total, 0);
  const latest = history[0] || null;

  const loadWeek = (week) => {
    onLoadHistory?.(week);
  };

  const deleteWeek = async () => {
    const week = pendingDelete;
    if (!week || deleting) return;
    setDeleteError("");
    setDeleting(true);

    try {
      if (isSupaConfigured() && activeClubId) {
        await DB.deleteHistory(activeClubId, week.id);
      }
      setHistory?.((current) => current.filter((entry) => entry.id !== week.id));
      setPendingDelete(null);
    } catch (error) {
      setDeleteError(error?.message || "The saved matchweek could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsPanel>
      <SettingsSectionHeader
        icon={History}
        eyebrow="Operational records"
        title="Matchweek history"
        description="Review saved matchweeks and restore the complete Saturday, Sunday and midweek operational schedule. History is also the evidence base for trends and funding analytics."
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
              {history.map((week) => {
                const counts = historyCounts(week);
                return (
                  <tr key={week.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4"><div className="font-black text-slate-950">{week.dateLabel || "Saved matchweek"}</div><div className="mt-1 text-xs font-semibold text-slate-400">{week.savedAt ? new Date(week.savedAt).toLocaleString("en-GB") : ""}</div></td>
                    <td className="px-4 py-4 text-sm font-black text-slate-700">{counts.saturday}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-700">{counts.sunday}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-700">{counts.midweek}</td>
                    <td className="px-4 py-4 text-sm font-black text-slate-700">{counts.postponed}</td>
                    <td className="px-4 py-4"><div className="flex gap-2"><SecondaryButton icon={RotateCcw} onClick={() => loadWeek(week)}>Load matchweek</SecondaryButton><SecondaryButton icon={Trash2} onClick={() => setPendingDelete(week)}>Delete</SecondaryButton></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5"><Notice tone="warning">Loading a saved matchweek replaces the current Saturday, Sunday and midweek schedules. Use a configuration backup before major changes to club setup.</Notice></div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete saved matchweek?"
        description={`${pendingDelete?.dateLabel || "This matchweek"} will be removed from the club history and cannot be restored from Ground Control.`}
        confirmLabel="Delete matchweek"
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={deleteWeek}
      />
    </SettingsPanel>
  );
}
