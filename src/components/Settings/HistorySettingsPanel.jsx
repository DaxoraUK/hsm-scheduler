import React from "react";
import HistoryPanel from "../HistoryPanel.jsx";
import { isSupaConfigured, DB } from "../../lib/supabase.js";

export default function HistorySettingsPanel({
  S,
  club,
  hdrStyle,
  history,
  setHistory,
  setSatScheduled,
  setSatHasRun,
  setDayTab,
}) {
  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(club.primary)}>
        Season History {history.length > 0 ? `(${history.length} weeks)` : ""}
      </div>

      <div style={S.cb}>
        <HistoryPanel
          history={history}
          club={club}
          onLoad={(week) => {
            setSatScheduled(week.scheduled);
            setSatHasRun(true);
            setDayTab("saturday");
          }}
          onDelete={async (id) => {
            setHistory((prev) => prev.filter((h) => h.id !== id));

            if (isSupaConfigured()) {
              await DB.deleteHistory(id);
            }
          }}
        />
      </div>
    </div>
  );
}