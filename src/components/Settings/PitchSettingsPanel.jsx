import React from "react";
import { sortPitches } from "../../lib/pitches.js";

const FORMATS = [
  ["", "Any"],
  ["3v3", "3v3"],
  ["5v5", "5v5"],
  ["7v7", "7v7"],
  ["9v9", "9v9"],
  ["11v11-youth", "11v11 Youth"],
  ["11v11-small", "11v11 Small"],
  ["11v11", "11v11 Full"],
];

const SURFACES = [
  ["grass", "Grass"],
  ["astro", "Astro"],
  ["3g", "3G"],
  ["4g", "4G"],
  ["indoor", "Indoor"],
];

export default function PitchSettingsPanel({
  S,
  RE,
  club,
  hdrStyle,
  thC,
  pitchCfg,
  setPitchCfg,
  PITCHES,
  saveTab,
  savedTab,
}) {
  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.secondary), justifyContent: "space-between" }}>
        <span>Pitch Management</span>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {savedTab === "pitches" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
              ✓ Saved
            </span>
          )}

          <button
            style={{ ...S.btn(club.primary), padding: "3px 10px", fontSize: 11 }}
            onClick={() => saveTab("pitches")}
          >
            Save Pitches
          </button>

          <button
            style={{ ...S.btn(RE), padding: "3px 10px", fontSize: 11 }}
            onClick={() =>
              setPitchCfg(
                PITCHES.map((pitch) => ({
                  ...pitch,
                  surface: pitch.surface || inferSurface(pitch),
                }))
              )
            }
          >
            Reset
          </button>
        </div>
      </div>

      <div style={S.cb}>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
          Add, edit or remove pitches. The ID must be unique with no spaces. Set
          the Format so games of that type can be placed here. Use Inside Pitch
          if this pitch sits within a larger one. Set Surface to identify grass,
          Astro, 3G, 4G or indoor pitches. Tick Independent if games here do not
          count toward the concurrent game limit.
        </div>

        <table style={S.table}>
          <thead>
            <tr>
              {[
                "ID",
                "Name",
                "Format",
                "Surface",
                "Inside Pitch",
                "Independent",
                "",
              ].map((h, i) => (
                <th key={i} style={thC(club.primary)}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortPitches(pitchCfg).map((pitch) => {
              const realIdx = pitchCfg.findIndex((x) => x === pitch);
              const rowIndex = realIdx;

              const updatePitch = (field, value) => {
                setPitchCfg((prev) =>
                  prev.map((row, index) => {
                    if (index !== realIdx) return row;

                    const next = { ...row, [field]: value };

                    delete next.astroOnly;
                    delete next.toggleOnly;

                    return next;
                  })
                );
              };

              return (
                <tr key={`${pitch.id}_${rowIndex}`}>
                  <td style={S.td(rowIndex % 2)}>
                    <input
                      style={{ ...S.iinp, width: 60, fontFamily: "monospace" }}
                      value={pitch.id}
                      onChange={(e) =>
                        updatePitch("id", e.target.value.replace(/ /g, ""))
                      }
                      placeholder="P1"
                    />
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <input
                      style={{ ...S.iinp, width: 90 }}
                      value={pitch.label}
                      onChange={(e) => updatePitch("label", e.target.value)}
                      placeholder="Pitch 1"
                    />
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <select
                      style={{ ...S.isel, width: 95 }}
                      value={pitch.format || ""}
                      onChange={(e) => updatePitch("format", e.target.value)}
                    >
                      {FORMATS.map(([value, label]) => (
                        <option key={value || "any"} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <select
                      style={{ ...S.isel, width: 90 }}
                      value={pitch.surface || inferSurface(pitch)}
                      onChange={(e) => updatePitch("surface", e.target.value)}
                    >
                      {SURFACES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <select
                      style={{ ...S.isel, width: 90 }}
                      value={pitch.innerOf || ""}
                      onChange={(e) => updatePitch("innerOf", e.target.value || null)}
                    >
                      <option value="">None</option>
                      {pitchCfg
                        .filter((other) => other.id !== pitch.id && !other.innerOf)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.id}
                          </option>
                        ))}
                    </select>
                  </td>

                  <td style={{ ...S.td(rowIndex % 2), textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={!!pitch.independent}
                      onChange={(e) => updatePitch("independent", e.target.checked)}
                      title="Does not count toward concurrent game limit"
                    />
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <button
                      onClick={() =>
                        setPitchCfg((prev) =>
                          prev.filter((_, index) => index !== realIdx)
                        )
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: RE,
                        cursor: "pointer",
                        fontSize: 16,
                        padding: "0 4px",
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          style={{ ...S.btn(club.primary), marginTop: 16 }}
          onClick={() =>
            setPitchCfg((prev) => [
              ...prev,
              {
                id: "P" + (prev.length + 1),
                label: "Pitch " + (prev.length + 1),
                desc: "",
                format: "",
                surface: "grass",
                innerOf: null,
                independent: false,
              },
            ])
          }
        >
          + Add Pitch
        </button>

        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid #f0f0f0",
            fontSize: 11,
            color: "#888",
          }}
        >
          <strong>Tip:</strong> Surface controls whether a pitch is grass,
          Astro, 3G, 4G or indoor. Independent only means games on that pitch do
          not count toward the concurrent game limit.
        </div>
      </div>
    </div>
  );
}

function inferSurface(pitch) {
  const text = `${pitch?.id || ""} ${pitch?.label || ""} ${pitch?.name || ""} ${
    pitch?.desc || ""
  } ${pitch?.type || ""}`.toLowerCase();

  if (pitch?.surface) return pitch.surface;
  if (text.includes("astro")) return "astro";
  if (text.includes("3g")) return "3g";
  if (text.includes("4g")) return "4g";
  if (text.includes("indoor")) return "indoor";

  return "grass";
}