import React from "react";

export default function SaturdayEmptyState({
  S,
  RE,
  club,
  TEAM_CONFIG_DEFAULT,
  PITCHES,
  satHasRun,
  satTab,
  satFinal,
  satUnresolved,
  setTeamCfg,
  setPitchCfg,
}) {
  if (
    !satHasRun ||
    satFinal.length !== 0 ||
    satUnresolved.length !== 0
  ) {
    return null;
  }

  const hdrStyle = (bg) => ({
    background: bg || club.primary,
    color: "#fff",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  });

  return (
    <div style={S.card} className="np">
      <div style={hdrStyle(RE)}>No Fixtures Scheduled</div>
      <div style={S.cb}>
        <div style={S.warn}>
          <strong>The schedule came back empty.</strong> This usually means your
          saved team names do not match the fixtures.
        </div>

        <div style={{ fontSize: 12, color: "#555", marginTop: 10 }}>
          Try this: go to <strong>Settings - Teams</strong> and click{" "}
          <strong>Reset to Defaults</strong>, then go to{" "}
          <strong>Settings - Pitches</strong> and click <strong>Reset</strong>.
          Then run the test schedule again.
        </div>

        <button
          style={{ ...S.btn(club.primary), marginTop: 14 }}
          onClick={() => {
            setTeamCfg(TEAM_CONFIG_DEFAULT);
            setPitchCfg(PITCHES);
            alert("Teams and pitches reset to defaults. Run the test schedule again.");
          }}
        >
          Reset Teams and Pitches Now
        </button>
      </div>
    </div>
  );
}