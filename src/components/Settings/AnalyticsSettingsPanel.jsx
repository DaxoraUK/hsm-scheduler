import React from "react";
import Analytics from "../Analytics.jsx";

export default function AnalyticsSettingsPanel({
  S,
  club,
  hdrStyle,
  history,
}) {
  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(club.secondary)}>
        Analytics Dashboard
      </div>

      <div style={S.cb}>
        <Analytics
          history={history}
          club={club}
        />
      </div>
    </div>
  );
}