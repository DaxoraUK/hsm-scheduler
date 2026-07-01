import React from "react";

function slugifySiteId(value, fallback = "site") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || fallback;
}

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];

  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || slugifySiteId(site.name || site.venue || `site-${index + 1}`, `site-${index + 1}`),
      name: site.name || site.venue || `Site ${index + 1}`,
      venue: site.venue || site.name || "",
      postcode: String(site.postcode || "").toUpperCase(),
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
      carParkSpaces: Number(site.carParkSpaces ?? club.carParkSpaces ?? 0),
      weatherEnabled: site.weatherEnabled !== false,
      notes: site.notes || "",
    }));
  }

  return [
    {
      id: club.primarySiteId || "main-ground",
      name: club.venue || "Main Ground",
      venue: club.venue || "",
      postcode: String(club.postcode || club.weatherPostcode || "").toUpperCase(),
      isPrimary: true,
      carParkSpaces: Number(club.carParkSpaces || 0),
      weatherEnabled: true,
      notes: "Primary matchday site",
    },
  ];
}

function normaliseSites(sites, club = {}) {
  const cleaned = sites.map((site, index) => {
    const name = site.name || site.venue || `Site ${index + 1}`;

    return {
      id: site.id || slugifySiteId(name, `site-${index + 1}`),
      name,
      venue: site.venue || name,
      postcode: String(site.postcode || "").trim().toUpperCase(),
      isPrimary: !!site.isPrimary,
      carParkSpaces: Number(site.carParkSpaces) || 0,
      weatherEnabled: site.weatherEnabled !== false,
      notes: site.notes || "",
    };
  });

  if (!cleaned.some((site) => site.isPrimary) && cleaned[0]) {
    cleaned[0] = { ...cleaned[0], isPrimary: true };
  }

  const primary = cleaned.find((site) => site.isPrimary) || cleaned[0];
  const weatherSite = cleaned.find((site) => site.weatherEnabled && site.postcode) || primary;

  return {
    sites: cleaned,
    primarySiteId: primary?.id || club.primarySiteId || "main-ground",
    venue: primary?.venue || club.venue || "",
    postcode: primary?.postcode || club.postcode || "",
    weatherPostcode: weatherSite?.postcode || primary?.postcode || club.weatherPostcode || "",
    carParkSpaces: primary?.carParkSpaces || club.carParkSpaces || 0,
  };
}

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span
        style={{
          color: "#94a3b8",
          fontSize: 10,
          fontWeight: 950,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone = "green" }) {
  const tones = {
    green: { bg: "#ecfdf5", border: "#bbf7d0", colour: "#047857" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", colour: "#0369a1" },
    amber: { bg: "#fffbeb", border: "#fde68a", colour: "#b45309" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", colour: "#475569" },
  };
  const t = tones[tone] || tones.green;

  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: t.bg,
        borderRadius: 18,
        padding: "14px 16px",
      }}
    >
      <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 950, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 6, color: t.colour, fontSize: 22, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

export default function VenueSettingsPanel({ S, club, setClub, hdrStyle, saveTab, savedTab }) {
  const sites = getSites(club);
  const primary = sites.find((site) => site.isPrimary) || sites[0];
  const totalParking = sites.reduce((sum, site) => sum + (Number(site.carParkSpaces) || 0), 0);
  const weatherPostcode = club.weatherPostcode || primary?.postcode || "Missing";

  const updateSites = (nextSites) => {
    const next = normaliseSites(nextSites, club);
    setClub((prev) => ({ ...prev, ...next }));
  };

  const updateSite = (index, field, value) => {
    const nextSites = sites.map((site, rowIndex) => {
      if (rowIndex !== index) return site;
      const next = { ...site, [field]: value };
      if (field === "name") next.id = slugifySiteId(value, site.id || `site-${index + 1}`);
      return next;
    });
    updateSites(nextSites);
  };

  const makePrimary = (index) => {
    updateSites(sites.map((site, rowIndex) => ({ ...site, isPrimary: rowIndex === index })));
  };

  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Venue & Site Settings</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {savedTab === "venues" && <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>✓ Saved</span>}
          <button style={{ ...S.btn(club.secondary, club.primary), padding: "3px 10px", fontSize: 11 }} onClick={() => saveTab("venues")}>
            Save Venues
          </button>
        </div>
      </div>

      <div style={S.cb}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <Stat label="Sites" value={sites.length} />
          <Stat label="Primary" value={primary?.name || "Unset"} tone="blue" />
          <Stat label="Weather" value={weatherPostcode} tone={weatherPostcode === "Missing" ? "amber" : "blue"} />
          <Stat label="Parking" value={`${totalParking} spaces`} tone="slate" />
        </div>

        <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>
          Configure every club venue once. Pitches can then be assigned to a site, and weather intelligence can use the correct postcode for the ground being used.
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {sites.map((site, index) => (
            <div
              key={`${site.id}_${index}`}
              style={{
                border: `1px solid ${site.isPrimary ? `${club.primary}55` : "#e2e8f0"}`,
                background: site.isPrimary ? `${club.primary}0d` : "#fff",
                borderRadius: 22,
                padding: 16,
                boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 10, fontWeight: 950, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                    {site.isPrimary ? "Primary site" : `Site ${index + 1}`}
                  </div>
                  <div style={{ marginTop: 4, color: "#0f172a", fontSize: 20, fontWeight: 950 }}>{site.name || `Site ${index + 1}`}</div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!site.isPrimary && (
                    <button type="button" style={{ ...S.btn(club.primary), marginTop: 0, padding: "7px 10px", fontSize: 11 }} onClick={() => makePrimary(index)}>
                      Make Primary
                    </button>
                  )}
                  {sites.length > 1 && (
                    <button type="button" style={{ ...S.btn("#dc2626"), marginTop: 0, padding: "7px 10px", fontSize: 11 }} onClick={() => updateSites(sites.filter((_, rowIndex) => rowIndex !== index))}>
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
                <Field label="Site name">
                  <input style={S.inp} value={site.name} onChange={(e) => updateSite(index, "name", e.target.value)} />
                </Field>
                <Field label="Venue / address">
                  <input style={S.inp} value={site.venue} onChange={(e) => updateSite(index, "venue", e.target.value)} />
                </Field>
                <Field label="Postcode">
                  <input style={S.inp} value={site.postcode} onChange={(e) => updateSite(index, "postcode", e.target.value.toUpperCase())} placeholder="BL6 7QE" />
                </Field>
                <Field label="Parking spaces">
                  <input type="number" min={0} style={S.inp} value={site.carParkSpaces} onChange={(e) => updateSite(index, "carParkSpaces", Number(e.target.value))} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,1fr) auto", gap: 12, alignItems: "end", marginTop: 12 }}>
                <Field label="Notes">
                  <input style={S.inp} value={site.notes} onChange={(e) => updateSite(index, "notes", e.target.value)} placeholder="Primary matchday site" />
                </Field>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 12px", border: "1px solid #e2e8f0", borderRadius: 14, background: "#f8fafc", fontSize: 12, fontWeight: 850, color: "#334155" }}>
                  <input type="checkbox" checked={site.weatherEnabled !== false} onChange={(e) => updateSite(index, "weatherEnabled", e.target.checked)} />
                  Weather enabled
                </label>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button
            type="button"
            style={{ ...S.btn(club.primary), marginTop: 0 }}
            onClick={() =>
              updateSites([
                ...sites,
                {
                  id: `site-${sites.length + 1}`,
                  name: `Site ${sites.length + 1}`,
                  venue: "",
                  postcode: "",
                  carParkSpaces: 0,
                  isPrimary: false,
                  weatherEnabled: true,
                  notes: "",
                },
              ])
            }
          >
            + Add Site
          </button>
          <button type="button" style={{ ...S.btn(club.secondary, club.primary), marginTop: 0 }} onClick={() => setClub((prev) => ({ ...prev, weatherPostcode: primary?.postcode || prev.weatherPostcode || "" }))}>
            Use Primary Site for Weather
          </button>
        </div>
      </div>
    </div>
  );
}
