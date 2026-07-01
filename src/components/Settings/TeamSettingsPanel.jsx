import React from "react";
import { sortPitches } from "../../lib/pitches.js";

const FORMATS = [
  "3v3",
  "5v5",
  "7v7",
  "9v9",
  "11v11-youth",
  "11v11-small",
  "11v11",
];

export default function TeamSettingsPanel({
  S,
  RE,
  club,
  hdrStyle,
  thC,
  teamCfg,
  setTeamCfg,
  pitchCfg,
  TEAM_CONFIG_DEFAULT,
  saveTab,
  savedTab,
}) {
  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Team Management</span>

        <button
          style={{
            ...S.btn(club.secondary, club.primary),
            padding: "3px 10px",
            fontSize: 11,
          }}
          onClick={() => setTeamCfg(TEAM_CONFIG_DEFAULT)}
        >
          Reset to Defaults
        </button>
      </div>

      <div style={S.cb}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
          Add, edit or remove teams. Changes apply on next schedule run.
        </div>

        <table style={S.table}>
          <thead>
            <tr>
              {["Name", "Type", "Format", "Default Pitch", "Alt Pitch", "Day", "Mins", ""].map(
                (h, i) => (
                  <th key={i} style={{ ...thC(club.primary), background: club.primary }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {teamCfg.map((team, index) => {
              const updateTeam = (field, value) => {
                setTeamCfg((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, [field]: value || null } : row
                  )
                );
              };

              return (
                <tr key={index}>
                  <td style={S.td(index % 2)}>
                    <input
                      style={S.iinp}
                      value={team.name}
                      onChange={(e) => updateTeam("name", e.target.value)}
                    />
                  </td>

                  <td style={S.td(index % 2)}>
                    <select
                      style={S.isel}
                      value={team.teamType || (String(team.name || "").toLowerCase().match(/\bu\s?\d{1,2}\b/) ? "youth" : "adult")}
                      onChange={(e) => updateTeam("teamType", e.target.value)}
                    >
                      <option value="youth">Youth</option>
                      <option value="adult">Adult / Open Age</option>
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select
                      style={S.isel}
                      value={team.format}
                      onChange={(e) => updateTeam("format", e.target.value)}
                    >
                      {FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select
                      style={S.isel}
                      value={team.defaultPitch || ""}
                      onChange={(e) => updateTeam("defaultPitch", e.target.value)}
                    >
                      {sortPitches(pitchCfg).map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>
                          {pitch.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select
                      style={S.isel}
                      value={team.altPitch || ""}
                      onChange={(e) => updateTeam("altPitch", e.target.value)}
                    >
                      <option value="">None</option>
                      {sortPitches(pitchCfg).map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>
                          {pitch.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select
                      style={S.isel}
                      value={team.day}
                      onChange={(e) => updateTeam("day", e.target.value)}
                    >
                      <option>Saturday</option>
                      <option>Sunday</option>
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <input
                      type="number"
                      min={20}
                      max={120}
                      step={5}
                      style={{ ...S.iinp, width: 55 }}
                      value={team.gameMins}
                      onChange={(e) => updateTeam("gameMins", Number(e.target.value))}
                    />
                  </td>

                  <td style={S.td(index % 2)}>
                    <button
                      onClick={() =>
                        setTeamCfg((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: RE,
                        cursor: "pointer",
                        fontSize: 16,
                        padding: "0 4px",
                      }}
                      title="Remove team"
                    >
                      x
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid #eee",
          }}
        >
          <button
            style={{ ...S.btn(club.primary), marginTop: 0 }}
            onClick={() =>
              setTeamCfg((prev) => [
                ...prev,
                {
                  name: "New Team",
                  teamType: "youth",
                  format: "11v11-youth",
                  defaultPitch: "P4",
                  altPitch: "P2",
                  ageOrder: prev.length + 1,
                  day: "Saturday",
                  gameMins: 70,
                },
              ])
            }
          >
            + Add Team
          </button>

          <button
            style={{ ...S.btn(club.secondary, club.primary) }}
            onClick={() => saveTab("teams")}
          >
            Save Teams
          </button>

          {savedTab === "teams" && (
            <span style={{ fontSize: 12, color: club.primary, fontWeight: 600 }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}