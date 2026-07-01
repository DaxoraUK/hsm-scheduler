import React from "react";
import { isSupaConfigured, DB } from "../../lib/supabase.js";

export default function SupabaseSettingsPanel({
  S,
  club,
  dbStatus,
  setDbStatus,
  setHistory,
  supaKey,
  setSupaKeyState,
  updateSupaKey,
}) {
  return (
    <div style={S.card} className="np">
      <div style={headerStyle(club.primary)}>Supabase Database Integration</div>

      <div style={S.cb}>
        <div style={{ ...S.ok, marginBottom: 16 }}>
          <strong>Status:</strong>{" "}
          {isSupaConfigured()
            ? "Supabase configured - " + dbStatus
            : "Anon key not set - paste it below"}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={S.lbl}>Supabase Anon Key</label>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              style={{ ...S.inp, fontFamily: "monospace", fontSize: 11 }}
              placeholder="Paste your anon key here (eyJ...)"
              value={supaKey}
              onChange={(e) => setSupaKeyState(e.target.value)}
              onBlur={(e) => updateSupaKey(e.target.value)}
            />

            <button
              style={{ ...S.btn(club.primary), whiteSpace: "nowrap" }}
              onClick={async () => {
                const key = supaKey.trim();

                if (key.length < 20) {
                  alert("Please paste your Supabase anon key first.");
                  return;
                }

                updateSupaKey(key);
                setDbStatus("loading");

                const data = await DB.loadHistory();

                if (data !== null) {
                  setHistory(data);
                  setDbStatus("connected");
                  alert("Connected! " + data.length + " weeks in history.");
                } else {
                  setDbStatus("error");
                  alert("Connection failed - check the key is correct.");
                }
              }}
            >
              Test Connection
            </button>
          </div>

          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            Find this in Supabase - Settings - API - Project API keys - anon/public.
            Saved to this browser only.
          </div>

          {isSupaConfigured() && (
            <div
              style={{
                fontSize: 11,
                color: club.primary,
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              Key saved - status: {dbStatus}
            </div>
          )}
        </div>

        <InfoBox club={club} title="Project URL">
          https://keanexqompimqafhuiow.supabase.co
        </InfoBox>

        <div
          style={{
            marginBottom: 16,
            padding: 12,
            background: "#f9f9f9",
            border: "1px solid #e0e0e0",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 8,
              color: club.primary,
            }}
          >
            Database Tables Required
          </div>

          <div style={{ fontSize: 11, marginBottom: 8 }}>
            Run this in Supabase SQL Editor if not already done:
          </div>

          <pre
            style={{
              fontSize: 10,
              background: "#1e1e1e",
              color: "#d4d4d4",
              padding: 10,
              borderRadius: 4,
              overflowX: "auto",
            }}
          >
{`create table history (id text primary key, data jsonb, saved_at timestamptz default now());
create table refs (id text primary key, data jsonb);
create table team_config (id text primary key, data jsonb);
create table club_config (id text primary key, data jsonb);
create table pitches (id text primary key, data jsonb);
create table audit_log (id text primary key, data jsonb, created_at timestamptz default now());

alter table history enable row level security;
alter table refs enable row level security;
alter table team_config enable row level security;
alter table club_config enable row level security;
alter table pitches enable row level security;
alter table audit_log enable row level security;

create policy "Allow all" on history for all using (true) with check (true);
create policy "Allow all" on refs for all using (true) with check (true);
create policy "Allow all" on team_config for all using (true) with check (true);
create policy "Allow all" on club_config for all using (true) with check (true);
create policy "Allow all" on pitches for all using (true) with check (true);
create policy "Allow all" on audit_log for all using (true) with check (true);`}
          </pre>
        </div>

        <button
          style={S.btn(club.primary)}
          onClick={async () => {
            setDbStatus("loading");

            const data = await DB.loadHistory();

            if (data) {
              setHistory(data);
              setDbStatus("connected");
              alert("Connected! " + data.length + " weeks loaded.");
            } else {
              setDbStatus("error");
              alert("Connection failed - check your key in the source code.");
            }
          }}
        >
          Test Supabase Connection
        </button>
      </div>
    </div>
  );
}

function headerStyle(bg) {
  return {
    background: bg,
    color: "#fff",
    padding: "10px 16px",
    fontWeight: 600,
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
}

function InfoBox({ club, title, children }) {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: 12,
        background: "#f9f9f9",
        border: "1px solid #e0e0e0",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 12,
          marginBottom: 4,
          color: club.primary,
        }}
      >
        {title}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555" }}>
        {children}
      </div>
    </div>
  );
}