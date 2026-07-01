import React from "react";

export default function SettingsTabs({
  club,
  WH,
  settingsTab,
  setSettingsTab,
  productionMode,
}) {
  const tabs = [
    ["club", "Club"],
    ["teams", "Teams"],
    ["timing", "Timing"],
    ["pitches", "Pitches"],
    ["refs", "Referees"],
    ["testdata", "Test Data"],
    ["closures", "Pitch Closures"],
    ["history", "History"],
    ["stats", "Stats"],
    ["analytics", "Analytics"],
    ["sheets", "Supabase DB"],
  ].filter(([k]) => !(productionMode && k === "testdata"));

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        marginBottom: 14,
        flexWrap: "wrap",
      }}
      className="np"
    >
      {tabs.map(([k, l]) => (
        <button
          key={k}
          onClick={() => setSettingsTab(k)}
          style={{
            background: settingsTab === k ? club.primary : "#f0f0f0",
            color: settingsTab === k ? WH : "#555",
            border: "none",
            borderRadius: 50,
            padding: "6px 16px",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: settingsTab === k ? 600 : 400,
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}