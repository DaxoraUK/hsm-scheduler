import React from "react";
import { isSupaConfigured, DB } from "../../lib/supabase.js";

export default function SupabaseStatusBar({
  S,
  RE,
  AM,
  club,
  dbStatus,
  setDbStatus,
  setHistory,
}) {
  return (
    <div style={{ ...S.card, marginBottom: 14 }} className="np">
      <div style={S.cb}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background:
                  dbStatus === "connected"
                    ? club.primary
                    : dbStatus === "error"
                    ? RE
                    : dbStatus === "disabled"
                    ? "#aaa"
                    : AM,
                flexShrink: 0,
              }}
            />

            <span style={{ fontSize: 12, fontWeight: 600 }}>
              Supabase:{" "}
              {dbStatus === "connected"
                ? "Connected"
                : dbStatus === "error"
                ? "Error - check key in Settings"
                : dbStatus === "disabled"
                ? "Not configured - paste key in Settings"
                : dbStatus === "saving"
                ? "Saving..."
                : "Connecting..."}
            </span>
          </div>

          {dbStatus === "disabled" && (
            <span style={{ fontSize: 11, color: "#888" }}>
              Paste your Supabase anon key in Settings - Supabase DB to sync across devices
            </span>
          )}

          {dbStatus === "connected" && (
            <span style={{ fontSize: 11, color: club.primary }}>
              History, refs and team config synced across all devices
            </span>
          )}

          {dbStatus === "error" && (
            <span style={{ fontSize: 11, color: RE }}>
              Using local storage - check anon key in Settings - Supabase DB
            </span>
          )}

          <button
            style={{
              ...S.btn(club.primary),
              padding: "4px 12px",
              fontSize: 11,
              marginLeft: "auto",
            }}
            onClick={async () => {
              if (!isSupaConfigured()) {
                alert("Supabase not configured - update SUPA_KEY in the code.");
                return;
              }

              setDbStatus("loading");
              const data = await DB.loadHistory();

              if (data) {
                setHistory(data);
                setDbStatus("connected");
              } else {
                setDbStatus("error");
              }
            }}
          >
            Refresh from Supabase
          </button>
        </div>
      </div>
    </div>
  );
}