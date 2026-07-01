import React from "react";

export default function PitchClosuresSettingsPanel({
  S,
  G,
  RE,
  hdrStyle,
  pitchCfg,
  closedPitches,
  toggleClosed,
  setClosedPitches,
}) {
  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(closedPitches.length > 0 ? RE : G)}>
        Pitch Closures{" "}
        {closedPitches.length > 0
          ? `- ${closedPitches.length} closed this week`
          : "- all pitches open"}
      </div>

      <div style={S.cb}>
        <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
          Mark pitches unavailable this week - scheduler will exclude them on next run.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pitchCfg
            .filter((pitch) => !pitch.independent)
            .map((pitch) => {
              const isClosed = closedPitches.includes(pitch.id);

              return (
                <label
                  key={pitch.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "1px solid " + (isClosed ? RE : "#ccc"),
                    background: isClosed ? "#fdecea" : "#f9f9f9",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isClosed}
                    onChange={() => toggleClosed(pitch.id)}
                  />
                  {pitch.label}{" "}
                  <span style={{ color: "#888", fontSize: 10 }}>
                    ({pitch.desc})
                  </span>
                </label>
              );
            })}
        </div>

        {closedPitches.length > 0 && (
          <button
            style={{ ...S.btn(RE), marginTop: 12 }}
            onClick={() => setClosedPitches([])}
          >
            Reopen All
          </button>
        )}
      </div>
    </div>
  );
}