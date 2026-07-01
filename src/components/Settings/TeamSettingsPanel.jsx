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

const TEAM_TYPES = [
  ["youth", "Youth"],
  ["adult", "Adult"],
  ["veterans", "Veterans"],
  ["girls", "Girls"],
  ["women", "Women"],
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

function pitchSiteId(pitch, primarySiteId) {
  return pitch?.siteId || primarySiteId || "main-ground";
}

function classifyFallback(team = {}) {
  if (team.teamType) return team.teamType;

  const name = String(team.name || "").toLowerCase();
  if (/(1st|first|reserves|open age|sunday 1st|seniors|senior)/i.test(name)) return "adult";
  if (/vets|veterans/.test(name)) return "veterans";
  if (/women|ladies/.test(name)) return "women";
  if (/girls|lionesses/.test(name)) return "girls";

  return "youth";
}

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
  const sites = getSites(club);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0];
  const sortedPitches = sortPitches(pitchCfg);

  const teamCounts = teamCfg.reduce(
    (acc, team) => {
      const type = classifyFallback(team);
      acc[type] = (acc[type] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0 }
  );

  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Team Management</span>

        <button
          style={{ ...S.btn(club.secondary, club.primary), padding: "3px 10px", fontSize: 11 }}
          onClick={() => setTeamCfg(TEAM_CONFIG_DEFAULT)}
        >
          Reset to Defaults
        </button>
      </div>

      <div style={S.cb}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {[
            ["Teams", teamCounts.total, "#ecfdf5", "#047857"],
            ["Youth", teamCounts.youth || 0, "#eff6ff", "#1d4ed8"],
            ["Adult", teamCounts.adult || 0, "#f5f3ff", "#6d28d9"],
            ["Girls/Women", (teamCounts.girls || 0) + (teamCounts.women || 0), "#fdf2f8", "#be185d"],
            ["Veterans", teamCounts.veterans || 0, "#f8fafc", "#475569"],
          ].map(([label, value, bg, colour]) => (
            <div key={label} style={{ border: "1px solid #e2e8f0", borderRadius: 16, background: bg, padding: "12px 14px" }}>
              <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase" }}>{label}</div>
              <div style={{ color: colour, fontSize: 22, fontWeight: 950, marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>

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
          Team type now feeds the rules engine. Adult/open-age sides are not judged against youth
          cut-off times, while youth teams still follow youth timing windows and pitch-format rules.
        </div>

        <table style={S.table}>
          <thead>
            <tr>
              {["Name", "Type", "Format", "Home Site", "Default Pitch", "Alt Pitch", "Day", "Mins", ""].map((h, i) => (
                <th key={i} style={{ ...thC(club.primary), background: club.primary }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {teamCfg.map((team, index) => {
              const updateTeam = (field, value) => {
                setTeamCfg((prev) =>
                  prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value || null } : row))
                );
              };

              const homeSiteId = team.siteId || primarySite?.id || "";
              const sitePitches = sortedPitches.filter((pitch) => pitchSiteId(pitch, primarySite?.id) === homeSiteId);
              const pitchOptions = sitePitches.length ? sitePitches : sortedPitches;

              return (
                <tr key={index}>
                  <td style={S.td(index % 2)}>
                    <input style={{ ...S.iinp, width: 145 }} value={team.name} onChange={(e) => updateTeam("name", e.target.value)} />
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 95 }} value={classifyFallback(team)} onChange={(e) => updateTeam("teamType", e.target.value)}>
                      {TEAM_TYPES.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 105 }} value={team.format} onChange={(e) => updateTeam("format", e.target.value)}>
                      {FORMATS.map((format) => (
                        <option key={format} value={format}>{format}</option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 120 }} value={homeSiteId} onChange={(e) => updateTeam("siteId", e.target.value)}>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>{site.name}{site.isPrimary ? " ★" : ""}</option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 115 }} value={team.defaultPitch || ""} onChange={(e) => updateTeam("defaultPitch", e.target.value)}>
                      {pitchOptions.map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>{pitch.label}</option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 115 }} value={team.altPitch || ""} onChange={(e) => updateTeam("altPitch", e.target.value)}>
                      <option value="">None</option>
                      {pitchOptions.map((pitch) => (
                        <option key={pitch.id} value={pitch.id}>{pitch.label}</option>
                      ))}
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <select style={{ ...S.isel, width: 95 }} value={team.day} onChange={(e) => updateTeam("day", e.target.value)}>
                      <option>Saturday</option>
                      <option>Sunday</option>
                    </select>
                  </td>

                  <td style={S.td(index % 2)}>
                    <input type="number" min={20} max={120} step={5} style={{ ...S.iinp, width: 55 }} value={team.gameMins} onChange={(e) => updateTeam("gameMins", Number(e.target.value))} />
                  </td>

                  <td style={S.td(index % 2)}>
                    <button
                      onClick={() => setTeamCfg((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                      style={{ background: "none", border: "none", color: RE, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                      title="Remove team"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <button
            style={{ ...S.btn(club.primary), marginTop: 0 }}
            onClick={() =>
              setTeamCfg((prev) => [
                ...prev,
                {
                  name: "New Team",
                  teamType: "youth",
                  format: "11v11-youth",
                  siteId: primarySite?.id || null,
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

          <button style={{ ...S.btn(club.secondary, club.primary) }} onClick={() => saveTab("teams")}>
            Save Teams
          </button>

          {savedTab === "teams" && <span style={{ fontSize: 12, color: club.primary, fontWeight: 600 }}>✓ Saved successfully</span>}
        </div>
      </div>
    </div>
  );
}
