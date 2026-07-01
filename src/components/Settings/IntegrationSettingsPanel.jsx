import React from "react";

const PROVIDERS = [
  {
    id: "fullTimeFa",
    name: "Full-Time FA",
    category: "Fixtures",
    description: "Fixture import source for leagues, cups and county competitions.",
    fields: [
      ["sourceUrl", "Fixture source URL"],
      ["clubId", "Club ID"],
    ],
  },
  {
    id: "teamFeePay",
    name: "TeamFeePay",
    category: "Payments & members",
    description: "Future sync for teams, members, payments and subscription status.",
    fields: [
      ["clientId", "Client ID"],
      ["apiKey", "API key / token"],
    ],
  },
  {
    id: "pitchero",
    name: "Pitchero",
    category: "Website & teams",
    description: "Future sync for fixtures, teams, availability and publishing.",
    fields: [
      ["clubSlug", "Club slug"],
      ["apiKey", "API key / token"],
    ],
  },
  {
    id: "spond",
    name: "Spond",
    category: "Team comms",
    description: "Future sync for teams, events, attendance and manager communications.",
    fields: [
      ["groupId", "Group ID"],
      ["apiKey", "API key / token"],
    ],
  },
  {
    id: "googleCalendar",
    name: "Google Calendar",
    category: "Calendar",
    description: "Future publish and sync layer for club, pitch and team calendars.",
    fields: [
      ["calendarId", "Calendar ID"],
      ["syncMode", "Sync mode"],
    ],
  },
];

function providerStatus(provider) {
  if (!provider?.enabled) return { label: "Off", colour: "#64748b", bg: "#f1f5f9" };
  if (provider?.status === "connected") return { label: "Ready", colour: "#1A5C38", bg: "#E8F5EE" };
  return { label: "Configured", colour: "#E67E22", bg: "#fff7ed" };
}

export default function IntegrationSettingsPanel({ S, club, setClub, hdrStyle, saveTab, savedTab }) {
  const integrations = club.integrations || {};

  const updateProvider = (providerId, patch) => {
    setClub((prev) => ({
      ...prev,
      integrations: {
        ...(prev.integrations || {}),
        [providerId]: {
          ...((prev.integrations || {})[providerId] || {}),
          ...patch,
        },
      },
    }));
  };

  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Integration Settings</span>
        <button
          style={{ ...S.btn(club.secondary, club.primary), padding: "3px 10px", fontSize: 11 }}
          onClick={() =>
            setClub((prev) => ({
              ...prev,
              integrations: {},
            }))
          }
        >
          Reset Integrations
        </button>
      </div>

      <div style={S.cb}>
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 16 }}>
          These are safe foundations only. They store provider configuration ready for the Integration Engine, but they do not make live API calls yet.
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {PROVIDERS.map((provider) => {
            const value = integrations[provider.id] || {};
            const status = providerStatus(value);

            return (
              <div
                key={provider.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 18,
                  background: value.enabled ? "#fff" : "#f8fafc",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 16, fontWeight: 950, color: "#0f172a" }}>{provider.name}</div>
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "4px 8px",
                          background: status.bg,
                          color: status.colour,
                          fontSize: 10,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>
                      {provider.category}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 7, lineHeight: 1.45 }}>
                      {provider.description}
                    </div>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 900, color: "#334155" }}>
                    <input
                      type="checkbox"
                      checked={!!value.enabled}
                      onChange={(e) => updateProvider(provider.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                {value.enabled && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 12,
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid #e2e8f0",
                    }}
                  >
                    {provider.fields.map(([field, label]) => (
                      <div key={field}>
                        <label style={S.lbl}>{label}</label>
                        <input
                          style={S.inp}
                          value={value[field] || ""}
                          type={field.toLowerCase().includes("key") || field.toLowerCase().includes("token") ? "password" : "text"}
                          onChange={(e) => updateProvider(provider.id, { [field]: e.target.value })}
                          placeholder={label}
                        />
                      </div>
                    ))}

                    <div>
                      <label style={S.lbl}>Mode</label>
                      <select
                        style={S.sel}
                        value={value.mode || "manual"}
                        onChange={(e) => updateProvider(provider.id, { mode: e.target.value })}
                      >
                        <option value="manual">Manual preparation</option>
                        <option value="import">Import only</option>
                        <option value="publish">Publish only</option>
                        <option value="sync">Two-way sync</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid #e2e8f0" }}>
          <button style={S.btn(club.primary)} onClick={() => saveTab("integrations")}>
            Save Integrations
          </button>
          {savedTab === "integrations" && <span style={{ color: club.primary, fontSize: 12, fontWeight: 800 }}>Saved</span>}
        </div>
      </div>
    </div>
  );
}
