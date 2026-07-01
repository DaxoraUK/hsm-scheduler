import React from "react";
import RefManager from "../RefManager.jsx";

export default function RefereeSettingsPanel({
  S,
  club,
  hdrStyle,
  refs,
  setRefs,
  saveTab,
  savedTab,
}) {
  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Referee Bank {refs.length > 0 ? `(${refs.length} saved)` : ""}</span>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {savedTab === "refs" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
              ✓ Saved
            </span>
          )}

          <button
            style={{
              ...S.btn(club.secondary, club.primary),
              padding: "3px 10px",
              fontSize: 11,
            }}
            onClick={() => saveTab("refs")}
          >
            Save Refs
          </button>
        </div>
      </div>

      <div style={S.cb}>
        <RefManager refs={refs} setRefs={setRefs} club={club} />
      </div>
    </div>
  );
}