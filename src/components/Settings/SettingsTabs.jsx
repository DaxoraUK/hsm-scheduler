import React from "react";

const TAB_GROUPS = [
  {
    label: "Centre",
    tabs: [["overview", "Overview"]],
  },
  {
    label: "Club",
    tabs: [
      ["club", "Club"],
      ["teams", "Teams"],
      ["timing", "Timing"],
    ],
  },
  {
    label: "Resources",
    tabs: [
      ["pitches", "Pitches"],
      ["refs", "Referees"],
      ["closures", "Closures"],
    ],
  },
  {
    label: "Platform",
    tabs: [
      ["integrations", "Integrations"],
      ["history", "History"],
      ["stats", "Stats"],
      ["analytics", "Analytics"],
      ["sheets", "Supabase"],
      ["testdata", "Test Data"],
    ],
  },
];

export default function SettingsTabs({ club, WH, settingsTab, setSettingsTab, productionMode }) {
  const groups = TAB_GROUPS.map((group) => ({
    ...group,
    tabs: group.tabs.filter(([key]) => !(productionMode && key === "testdata")),
  })).filter((group) => group.tabs.length);

  return (
    <div
      className="np"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 22,
        background: "#fff",
        padding: 12,
        marginBottom: 14,
        boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 10,
        }}
      >
        {groups.map((group) => (
          <div key={group.label}>
            <div
              style={{
                color: "#94a3b8",
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                margin: "0 0 7px 4px",
              }}
            >
              {group.label}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {group.tabs.map(([key, label]) => {
                const active = settingsTab === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSettingsTab(key)}
                    style={{
                      background: active ? club.primary : "#f8fafc",
                      color: active ? WH : "#475569",
                      border: active ? `1px solid ${club.primary}` : "1px solid #e2e8f0",
                      borderRadius: 999,
                      padding: "7px 12px",
                      fontSize: 11,
                      cursor: "pointer",
                      fontWeight: active ? 900 : 750,
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
