import React from "react";
import PitchStats from "../PitchStats.jsx";

export default function StatsSettingsPanel({ S, club, hdrStyle, history }) {
  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(club.secondary)}>Pitch Usage Stats</div>

      <div style={S.cb}>
        <PitchStats history={history} club={club} />
      </div>
    </div>
  );
}