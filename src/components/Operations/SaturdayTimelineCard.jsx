import React from "react";
import Timeline from "../Timeline.jsx";

export default function SaturdayTimelineCard({
  S,
  club,
  hdrStyle,
  satHasRun,
  satTab,
  satFinal,
  pitchCfg,
}) {
  if (!satHasRun || satTab !== "timeline") return null;

  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(club.primary)}>Timeline</div>

      <div style={S.cb}>
        <Timeline
          games={satFinal}
          club={club}
          pitchList={pitchCfg}
        />
      </div>
    </div>
  );
}