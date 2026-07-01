import React from "react";

function slugifySiteId(value, fallback = "site") {
  const clean = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return clean || fallback;
}

function getClubSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];

  if (sites.length) {
    return sites.map((site, index) => ({
      id: site.id || slugifySiteId(site.name || site.venue || `site-${index + 1}`, `site-${index + 1}`),
      name: site.name || site.venue || `Site ${index + 1}`,
      venue: site.venue || site.name || "",
      postcode: site.postcode || "",
      isPrimary: !!site.isPrimary || site.id === club.primarySiteId || (!club.primarySiteId && index === 0),
      carParkSpaces: site.carParkSpaces ?? club.carParkSpaces ?? 0,
      notes: site.notes || "",
    }));
  }

  return [
    {
      id: club.primarySiteId || "main-ground",
      name: club.venue || "Main Ground",
      venue: club.venue || "",
      postcode: club.postcode || club.weatherPostcode || "",
      isPrimary: true,
      carParkSpaces: club.carParkSpaces ?? 0,
      notes: "Primary matchday site",
    },
  ];
}

function normaliseSitesForSave(sites = [], club = {}) {
  const cleaned = sites.map((site, index) => {
    const name = site.name || site.venue || `Site ${index + 1}`;
    return {
      id: site.id || slugifySiteId(name, `site-${index + 1}`),
      name,
      venue: site.venue || name,
      postcode: String(site.postcode || "").trim().toUpperCase(),
      isPrimary: !!site.isPrimary,
      carParkSpaces: Number(site.carParkSpaces) || 0,
      notes: site.notes || "",
    };
  });

  if (!cleaned.some((site) => site.isPrimary) && cleaned[0]) {
    cleaned[0] = { ...cleaned[0], isPrimary: true };
  }

  const primary = cleaned.find((site) => site.isPrimary) || cleaned[0] || null;

  return primary
    ? {
        sites: cleaned,
        primarySiteId: primary.id,
        venue: primary.venue,
        postcode: primary.postcode,
        weatherPostcode: primary.postcode || club.weatherPostcode || "",
        carParkSpaces: primary.carParkSpaces || club.carParkSpaces || 0,
      }
    : { sites: cleaned };
}

export default function ClubSettingsPanel({
  S,
  RE,
  AVG_CARS,
  DEFAULT_CLUB,
  club,
  setClub,
  hdrStyle,
  productionMode,
  setProductionMode,
  setMode,
  saveTab,
  savedTab,
}) {
  return (
    <div style={S.card} className="np">
      <div style={{ ...hdrStyle(club.primary), justifyContent: "space-between" }}>
        <span>Club Settings</span>
        <button
          style={{
            ...S.btn(club.secondary, club.primary),
            padding: "3px 10px",
            fontSize: 11,
          }}
          onClick={() => setClub(DEFAULT_CLUB)}
        >
          Reset to Defaults
        </button>
      </div>

      <div style={S.cb}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={S.lbl}>Club Name</label>
            <input
              style={S.inp}
              value={club.name}
              onChange={(e) => setClub((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label style={S.lbl}>Ground / Venue</label>
            <input
              style={S.inp}
              value={club.venue}
              onChange={(e) =>
                setClub((p) => {
                  const sites = getClubSites(p);
                  const primaryIndex = Math.max(0, sites.findIndex((site) => site.isPrimary));
                  const nextSites = sites.map((site, index) =>
                    index === primaryIndex ? { ...site, venue: e.target.value, name: site.name || e.target.value } : site
                  );
                  return { ...p, ...normaliseSitesForSave(nextSites, p), venue: e.target.value };
                })
              }
            />
          </div>

          <div>
            <label style={S.lbl}>Ground Postcode</label>
            <input
              style={S.inp}
              value={club.postcode || club.weatherPostcode || ""}
              onChange={(e) =>
                setClub((p) => {
                  const value = e.target.value.toUpperCase();
                  const sites = getClubSites(p);
                  const primaryIndex = Math.max(0, sites.findIndex((site) => site.isPrimary));
                  const nextSites = sites.map((site, index) =>
                    index === primaryIndex ? { ...site, postcode: value } : site
                  );
                  return { ...p, ...normaliseSitesForSave(nextSites, p), postcode: value, weatherPostcode: value };
                })
              }
              placeholder="e.g. BL6 7QE"
            />
          </div>

          <div>
            <label style={S.lbl}>Weather Location</label>
            <input
              style={S.inp}
              value={club.weatherPostcode || club.postcode || ""}
              onChange={(e) =>
                setClub((p) => ({ ...p, weatherPostcode: e.target.value.toUpperCase() }))
              }
              placeholder="Usually the primary site postcode"
            />
          </div>

          <div>
            <label style={S.lbl}>Sport</label>
            <select
              style={S.sel}
              value={club.sport}
              onChange={(e) => setClub((p) => ({ ...p, sport: e.target.value }))}
            >
              <option>Football</option>
              <option>Rugby Union</option>
              <option>Rugby League</option>
              <option>Cricket</option>
              <option>Hockey</option>
              <option>Netball</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label style={S.lbl}>Car Park Spaces</label>
            <input
              type="number"
              min={1}
              max={500}
              style={S.inp}
              value={club.carParkSpaces != null ? club.carParkSpaces : ""}
              onChange={(e) =>
                setClub((p) => ({
                  ...p,
                  carParkSpaces: e.target.value === "" ? 0 : Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <div style={{ paddingTop: 16, borderTop: "1px solid #eee", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={S.lbl}>Sites / Venues</label>
              <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>
                Postcodes will feed the future Weather Intelligence engine. Add extra sites for multi-ground clubs.
              </div>
            </div>

            <button
              style={{ ...S.btn(club.primary), padding: "5px 10px", fontSize: 11 }}
              onClick={() =>
                setClub((p) => {
                  const sites = getClubSites(p);
                  const nextNumber = sites.length + 1;
                  const nextSites = [
                    ...sites,
                    {
                      id: `site-${nextNumber}`,
                      name: `Site ${nextNumber}`,
                      venue: "",
                      postcode: "",
                      isPrimary: false,
                      carParkSpaces: 0,
                      notes: "",
                    },
                  ];
                  return { ...p, ...normaliseSitesForSave(nextSites, p) };
                })
              }
            >
              + Add Site
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {getClubSites(club).map((site, index, sites) => {
              const updateSite = (field, value) => {
                setClub((p) => {
                  const current = getClubSites(p);
                  const nextSites = current.map((row, rowIndex) => {
                    if (rowIndex !== index) {
                      return field === "isPrimary" && value ? { ...row, isPrimary: false } : row;
                    }

                    const updated = { ...row, [field]: value };
                    if (field === "name" && (!row.id || row.id.startsWith("site-"))) {
                      updated.id = slugifySiteId(value, row.id || `site-${rowIndex + 1}`);
                    }
                    if (field === "isPrimary" && value) updated.isPrimary = true;
                    return updated;
                  });
                  return { ...p, ...normaliseSitesForSave(nextSites, p) };
                });
              };

              return (
                <div
                  key={`${site.id}_${index}`}
                  style={{
                    border: `1px solid ${site.isPrimary ? `${club.primary}55` : "#e2e8f0"}`,
                    background: site.isPrimary ? `${club.primary}0d` : "#fff",
                    borderRadius: 14,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "minmax(130px,1fr) minmax(180px,1.4fr) 120px 110px 96px 34px",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={{ ...S.lbl, fontSize: 10 }}>Site Name</label>
                    <input style={S.inp} value={site.name} onChange={(e) => updateSite("name", e.target.value)} />
                  </div>

                  <div>
                    <label style={{ ...S.lbl, fontSize: 10 }}>Venue / Address</label>
                    <input style={S.inp} value={site.venue} onChange={(e) => updateSite("venue", e.target.value)} />
                  </div>

                  <div>
                    <label style={{ ...S.lbl, fontSize: 10 }}>Postcode</label>
                    <input
                      style={S.inp}
                      value={site.postcode || ""}
                      onChange={(e) => updateSite("postcode", e.target.value.toUpperCase())}
                      placeholder="BL6 7QE"
                    />
                  </div>

                  <div>
                    <label style={{ ...S.lbl, fontSize: 10 }}>Parking</label>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      style={S.inp}
                      value={site.carParkSpaces ?? 0}
                      onChange={(e) => updateSite("carParkSpaces", Number(e.target.value) || 0)}
                    />
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 800,
                      color: club.primary,
                      paddingBottom: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input type="radio" name="primary-site" checked={!!site.isPrimary} onChange={() => updateSite("isPrimary", true)} />
                    Primary
                  </label>

                  <button
                    type="button"
                    disabled={sites.length <= 1 || site.isPrimary}
                    onClick={() =>
                      setClub((p) => {
                        const nextSites = getClubSites(p).filter((_, rowIndex) => rowIndex !== index);
                        return { ...p, ...normaliseSitesForSave(nextSites, p) };
                      })
                    }
                    title={site.isPrimary ? "Set another site as primary before removing this one" : "Remove site"}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: sites.length <= 1 || site.isPrimary ? "#f8fafc" : "#fff",
                      color: sites.length <= 1 || site.isPrimary ? "#cbd5e1" : RE,
                      cursor: sites.length <= 1 || site.isPrimary ? "not-allowed" : "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ paddingTop: 16, borderTop: "1px solid #eee", marginBottom: 16 }}>
          <label style={S.lbl}>Estimated cars per game (by format)</label>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>
            Used to estimate car park demand across the day. Tune these to match your club average attendance per game type.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
              gap: 10,
            }}
          >
            {[
              ["3v3", "3v3"],
              ["5v5", "5v5"],
              ["7v7", "7v7"],
              ["9v9", "9v9"],
              ["11v11-youth", "11v11 Youth"],
              ["11v11-small", "11v11 Small"],
              ["11v11", "11v11 Full"],
            ].map(([fmt, lbl]) => (
              <div key={fmt}>
                <label
                  style={{
                    fontSize: 11,
                    color: "#666",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  {lbl}
                </label>
                <input
                  type="number"
                  min={0}
                  max={200}
                  style={{ ...S.inp, width: "100%" }}
                  value={
                    club.avgCars && club.avgCars[fmt] != null
                      ? club.avgCars[fmt]
                      : AVG_CARS[fmt] || 0
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    setClub((p) => ({
                      ...p,
                      avgCars: { ...(p.avgCars || AVG_CARS), [fmt]: v },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
            gap: 16,
            marginBottom: 16,
            paddingTop: 16,
            borderTop: "1px solid #eee",
          }}
        >
          <ColourPicker
            label="Primary Colour"
            value={club.primary}
            colours={["#1A5C38", "#C0392B", "#1565C0", "#6A1B9A", "#00796B", "#E65100", "#212121", "#1A237E"]}
            onChange={(value) => setClub((p) => ({ ...p, primary: value }))}
            S={S}
          />

          <ColourPicker
            label="Secondary Colour"
            value={club.secondary}
            colours={["#C9A84C", "#F39C12", "#FFFFFF", "#E0E0E0", "#FF6F00", "#00BCD4", "#8BC34A", "#F44336"]}
            onChange={(value) => setClub((p) => ({ ...p, secondary: value }))}
            S={S}
          />
        </div>

        <div style={{ paddingTop: 16, borderTop: "1px solid #eee", marginBottom: 16 }}>
          <label style={S.lbl}>Club Logo</label>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LogoPreview club={club} size={60} />

            <div>
              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif"
                style={{ fontSize: 12, marginBottom: 6 }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.onload = (ev) =>
                    setClub((p) => ({ ...p, logo: ev.target?.result }));
                  reader.readAsDataURL(file);
                }}
              />

              <div style={{ fontSize: 11, color: "#888" }}>
                PNG, JPG or SVG. Displayed in header and print sheets.
              </div>

              {club.logo && (
                <button
                  style={{
                    ...S.btn(RE),
                    padding: "3px 10px",
                    fontSize: 11,
                    marginTop: 6,
                  }}
                  onClick={() => {
                    setClub((p) => ({ ...p, logo: "" }));
                    const inp = document.getElementById("logo-upload");
                    if (inp) inp.value = "";
                  }}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 16, borderTop: "1px solid #eee" }}>
          <label style={S.lbl}>Preview</label>

          <div
            style={{
              background: club.primary,
              borderRadius: 8,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <LogoPreview club={club} size={40} />

            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>
                {club.name} - Ground Control
              </div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
                {club.venue} {club.postcode ? `(${club.postcode})` : ""} - {club.sport}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #eee" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: club.primary, marginBottom: 8 }}>
            Go Live
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              padding: "10px 12px",
              background: productionMode ? "#FEF2F2" : "#F0FDF4",
              border: "1px solid " + (productionMode ? "#FECACA" : "#BBF7D0"),
              borderRadius: 8,
            }}
          >
            <input
              type="checkbox"
              checked={productionMode}
              onChange={(e) => {
                const on = e.target.checked;
                setProductionMode(on);
                try {
                  localStorage.setItem("hsm_production", on ? "1" : "0");
                } catch (err) {}
                if (on) setMode("live");
              }}
            />

            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {productionMode
                  ? "Production Mode ON - test features hidden"
                  : "Enable Production Mode"}
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>
                Hides the Test toggle and Test Data tab, and locks the app to Live mode.
                Turn this on before handing the app to club staff.
              </div>
            </div>
          </label>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingTop: 16,
            borderTop: "1px solid #eee",
            marginTop: 16,
          }}
        >
          <button style={S.btn(club.primary)} onClick={() => saveTab("club")}>
            Save Club Settings
          </button>

          {savedTab === "club" && (
            <span style={{ fontSize: 12, color: club.primary, fontWeight: 600 }}>
              ✓ Saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ColourPicker({ label, value, colours, onChange, S }) {
  return (
    <div>
      <label style={S.lbl}>{label}</label>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 44,
            height: 36,
            borderRadius: 4,
            border: "1px solid #ccc",
            cursor: "pointer",
            padding: 2,
          }}
        />

        <input
          style={{ ...S.inp, fontFamily: "monospace", width: 100 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {colours.map((c) => (
          <div
            key={c}
            onClick={() => onChange(c)}
            style={{
              width: 24,
              height: 24,
              background: c,
              borderRadius: 4,
              cursor: "pointer",
              border: value === c ? "3px solid #000" : "2px solid transparent",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LogoPreview({ club, size }) {
  const initials = club.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 3);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: club.secondary,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: size >= 60 ? "2px solid " + club.primary : "none",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {club.logo ? (
        <img
          src={club.logo}
          alt="logo"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <span
          style={{
            fontSize: size >= 60 ? 16 : 13,
            fontWeight: 900,
            color: club.primary,
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}