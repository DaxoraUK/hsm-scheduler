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

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || `site-${index + 1}`,
      name: site.name || site.venue || `Site ${index + 1}`,
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
    }));
  }

  return [
    {
      id: club.primarySiteId || "main-ground",
      name: club.venue || "Main Ground",
      isPrimary: true,
    },
  ];
}

function siteLabel(sites, siteId) {
  return sites.find((site) => site.id === siteId)?.name || "Primary";
}

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
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];

  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.secondary), justifyContent: "space-between" }}>
        <span>Pitch Management</span>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {savedTab === "pitches" && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>✓ Saved</span>
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
                  siteId: pitch.siteId || primarySite?.id || null,
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
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 18,
            padding: 14,
            background: "#f8fafc",
            color: "#475569",
            fontSize: 13,
            lineHeight: 1.55,
            marginBottom: 14,
          }}
        >
          Assign every pitch to a venue/site. Ground Control can then calculate parking,
          weather risk and multi-site operations correctly instead of treating every pitch
          as if it belongs to the same ground.
        </div>

        <table style={S.table}>
          <thead>
            <tr>
              {["ID", "Name", "Site", "Format", "Surface", "Inside", "Independent", ""].map(
                (h, i) => (
                  <th key={i} style={thC(club.primary)}>
                    {h}
                  </th>
                )
              )}
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
                      onChange={(e) => updatePitch("id", e.target.value.replace(/ /g, ""))}
                      placeholder="P1"
                    />
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <input
                      style={{ ...S.iinp, width: 100 }}
                      value={pitch.label}
                      onChange={(e) => updatePitch("label", e.target.value)}
                      placeholder="Pitch 1"
                    />
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <select
                      style={{ ...S.isel, width: 120 }}
                      value={pitch.siteId || primarySite?.id || ""}
                      onChange={(e) => updatePitch("siteId", e.target.value || null)}
                      title={`Current site: ${siteLabel(sites, pitch.siteId || primarySite?.id)}`}
                    >
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}{site.isPrimary ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(rowIndex % 2)}>
                    <select
                      style={{ ...S.isel, width: 105 }}
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
                      onClick={() => setPitchCfg((prev) => prev.filter((_, index) => index !== realIdx))}
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
                siteId: primarySite?.id || null,
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
          <strong>Tip:</strong> Site controls venue, postcode, weather and car park capacity.
          Surface controls grass, Astro, 3G, 4G or indoor. Independent only means games on that
          pitch do not count toward the concurrent game limit.
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
