import React from "react";

function normalise(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdultTeam(team = {}) {
  const explicitType = normalise(team.teamType || team.type || team.category);

  if (["adult", "open-age", "open age", "senior", "seniors", "veteran", "veterans"].includes(explicitType)) {
    return true;
  }

  if (["youth", "junior", "juniors", "mini", "minis"].includes(explicitType)) {
    return false;
  }

  const name = normalise(team.name || team.teamName || team.label);

  if (/\bu\s?\d{1,2}\b/.test(name)) return false;

  return (
    name.includes("1st team") ||
    name.includes("first team") ||
    name.includes("reserves") ||
    name.includes("reserve") ||
    name.includes("sunday 1sts") ||
    name.includes("sunday first") ||
    name.includes("open age") ||
    name.includes("open-age") ||
    name.includes("adult") ||
    name.includes("senior") ||
    name.includes("veteran") ||
    name.includes("vets")
  );
}

function MetricChip({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "#f8fafc", border: "#e2e8f0", label: "#64748b", value: "#0f172a" },
    green: { bg: "#ecfdf5", border: "#bbf7d0", label: "#047857", value: "#065f46" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", label: "#2563eb", value: "#1e3a8a" },
    purple: { bg: "#faf5ff", border: "#e9d5ff", label: "#7e22ce", value: "#581c87" },
    amber: { bg: "#fffbeb", border: "#fde68a", label: "#b45309", value: "#92400e" },
    red: { bg: "#fef2f2", border: "#fecaca", label: "#dc2626", value: "#991b1b" },
    slate: { bg: "#f1f5f9", border: "#cbd5e1", label: "#475569", value: "#0f172a" },
  };

  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        padding: "7px 10px",
        boxShadow: "0 1px 0 rgba(15,23,42,0.03)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          color: t.label,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: t.value, fontSize: 12, fontWeight: 950 }}>{value}</span>
    </span>
  );
}

function StatusBadge({ children, tone = "green" }) {
  const tones = {
    green: { bg: "#ecfdf5", border: "#bbf7d0", colour: "#047857" },
    blue: { bg: "#eff6ff", border: "#bfdbfe", colour: "#2563eb" },
    purple: { bg: "#faf5ff", border: "#e9d5ff", colour: "#7e22ce" },
    amber: { bg: "#fffbeb", border: "#fde68a", colour: "#b45309" },
    slate: { bg: "#f8fafc", border: "#e2e8f0", colour: "#475569" },
  };
  const t = tones[tone] || tones.green;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.colour,
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 950,
        whiteSpace: "nowrap",
        lineHeight: 1,
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  );
}

function SettingsCard({ title, eyebrow, description, status, statusTone, metrics, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        background: "#fff",
        padding: 22,
        cursor: "pointer",
        boxShadow: "0 14px 34px rgba(15,23,42,0.06)",
        transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
        minHeight: 212,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: 18,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 20px 44px rgba(15,23,42,0.10)";
        e.currentTarget.style.borderColor = "#cbd5e1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 14px 34px rgba(15,23,42,0.06)";
        e.currentTarget.style.borderColor = "#e2e8f0";
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 950,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {eyebrow}
            </div>
            <div style={{ color: "#0f172a", fontSize: 22, lineHeight: 1.12, fontWeight: 950 }}>{title}</div>
          </div>
          <StatusBadge tone={statusTone}>{status}</StatusBadge>
        </div>

        <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.52, margin: "16px 0 0" }}>{description}</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{metrics}</div>
    </button>
  );
}

export default function SettingsOverviewPanel({
  S,
  club,
  teamCfg = [],
  pitchCfg = [],
  refs = [],
  productionMode,
  setSettingsTab,
  savedTab,
}) {
  const adultTeams = teamCfg.filter(isAdultTeam).length;
  const youthTeams = Math.max(0, teamCfg.length - adultTeams);
  const closedPitchCount = pitchCfg.filter((pitch) => pitch.closed || pitch.isClosed).length;
  const integrationCount = Object.values(club.integrations || {}).filter((integration) => integration?.enabled).length;
  const siteCount = Array.isArray(club.sites) && club.sites.length ? club.sites.length : 1;
  const weatherLocation = club.weatherPostcode || club.postcode || "Missing";

  return (
    <div className="np" style={{ display: "grid", gap: 22 }}>
      <div
        style={{
          ...S.card,
          padding: 0,
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          boxShadow: "0 18px 48px rgba(15,23,42,0.08)",
        }}
      >
        <div
          style={{
            padding: "26px 28px",
            background: `linear-gradient(135deg, ${club.primary || "#1A5C38"}, #0f172a)`,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 950, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.82 }}>
            Settings Centre
          </div>
          <div style={{ marginTop: 8, fontSize: 32, lineHeight: 1.05, fontWeight: 950 }}>
            Configure Ground Control from one place
          </div>
          <div style={{ marginTop: 12, maxWidth: 850, color: "rgba(255,255,255,0.80)", fontSize: 14, lineHeight: 1.55 }}>
            Club defaults, teams, competition rules, resources, communications, integrations and data settings are grouped around how the platform operates.
          </div>
        </div>

        <div style={{ padding: 18, display: "flex", gap: 9, flexWrap: "wrap" }}>
          <MetricChip label="Teams" value={teamCfg.length} tone="green" />
          <MetricChip label="Youth" value={youthTeams} tone="blue" />
          <MetricChip label="Adult" value={adultTeams} tone="purple" />
          <MetricChip label="Sites" value={siteCount} tone={siteCount > 1 ? "blue" : "green"} />
          <MetricChip label="Weather" value={weatherLocation} tone={weatherLocation === "Missing" ? "red" : "blue"} />
          <MetricChip label="Pitches" value={pitchCfg.length} tone="green" />
          <MetricChip label="Closed" value={closedPitchCount} tone={closedPitchCount ? "red" : "green"} />
          <MetricChip label="Refs" value={refs.length} tone={refs.length ? "amber" : "slate"} />
          <MetricChip label="Integrations" value={integrationCount} tone="slate" />
          <MetricChip label="Mode" value={productionMode ? "Production" : "Development"} tone={productionMode ? "green" : "amber"} />
        </div>
      </div>

      {savedTab && (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${(club.primary || "#1A5C38")}26`,
            background: `${club.primary || "#1A5C38"}0d`,
            color: club.primary || "#1A5C38",
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 850,
          }}
        >
          Saved {savedTab} settings.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: 18,
        }}
      >
        <SettingsCard
          title="Club Defaults"
          eyebrow="Identity"
          status="Core"
          statusTone="green"
          onClick={() => setSettingsTab("club")}
          description="Club name, venues, site postcodes, sport, branding, parking assumptions and production mode."
          metrics={
            <>
              <MetricChip label="Sites" value={siteCount} tone={siteCount > 1 ? "blue" : "green"} />
              <MetricChip label="Weather" value={weatherLocation} tone={weatherLocation === "Missing" ? "red" : "blue"} />
              <MetricChip label="Sport" value={club.sport || "Unset"} tone="blue" />
            </>
          }
        />

        <SettingsCard
          title="Teams & Competition"
          eyebrow="Rules"
          status="Source"
          statusTone="blue"
          onClick={() => setSettingsTab("teams")}
          description="Team type, format, match duration, preferred pitches and competition rules that feed the scheduler and rules engines."
          metrics={
            <>
              <MetricChip label="Youth" value={youthTeams} tone="blue" />
              <MetricChip label="Adult" value={adultTeams} tone="purple" />
            </>
          }
        />

        <SettingsCard
          title="Resources"
          eyebrow="Ground Ops"
          status="Operational"
          statusTone="green"
          onClick={() => setSettingsTab("pitches")}
          description="Pitches, sites, pitch closures, artificial surface rules, referees and physical operating constraints."
          metrics={
            <>
              <MetricChip label="Sites" value={siteCount} tone={siteCount > 1 ? "blue" : "green"} />
              <MetricChip label="Pitches" value={pitchCfg.length} tone="green" />
              <MetricChip label="Closed" value={closedPitchCount} tone={closedPitchCount ? "red" : "green"} />
            </>
          }
        />

        <SettingsCard
          title="Integrations"
          eyebrow="Connections"
          status="Foundation"
          statusTone="slate"
          onClick={() => setSettingsTab("integrations")}
          description="Prepare Full-Time FA, TeamFeePay, Pitchero, Spond and calendar connections without live API calls yet."
          metrics={
            <>
              <MetricChip label="Enabled" value={integrationCount} tone="slate" />
              <MetricChip label="Providers" value="5" tone="purple" />
            </>
          }
        />

        <SettingsCard
          title="Data & Intelligence"
          eyebrow="Platform"
          status="Admin"
          statusTone="amber"
          onClick={() => setSettingsTab("analytics")}
          description="Analytics, history, Supabase, test data and reporting behaviour for the wider product."
          metrics={
            <>
              <MetricChip label="History" value="Ready" tone="amber" />
              <MetricChip label="Database" value="Supabase" tone="green" />
            </>
          }
        />
      </div>
    </div>
  );
}
