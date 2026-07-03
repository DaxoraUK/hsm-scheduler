import React, { useState } from "react";
import { CheckCircle2, Database, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { DB, isSupaConfigured, SUPA_URL } from "../../lib/supabase.js";

export default function SupabaseSettingsPanel({
  club = {},
  dbStatus = "disabled",
  setDbStatus,
  activeClubId = "",
  activeMembership = null,
}) {
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const configured = isSupaConfigured();

  const testConnection = async () => {
    setChecking(true);
    setMessage("");
    setDbStatus?.("loading");
    try {
      const workspace = await DB.ping(activeClubId);
      setDbStatus?.("connected");
      setMessage(`Secure connection confirmed for ${workspace?.name || club.name || "this club"}.`);
    } catch (error) {
      setDbStatus?.("error");
      setMessage(error?.message || "The secure workspace connection failed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
            <ShieldCheck size={14} /> Tenant-secure database
          </div>
          <h2 className="mt-4 text-2xl font-black text-slate-950">Supabase workspace security</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
            The application connection is supplied by the deployment environment. Club users never enter API keys. Every database request carries the signed-in user token and is restricted by club membership and Row Level Security.
          </p>
        </div>
        <button
          type="button"
          onClick={testConnection}
          disabled={!configured || !activeClubId || checking}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? <LoaderCircle size={17} className="animate-spin" /> : <Database size={17} />}
          Verify secure connection
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <StatusTile label="Application configuration" value={configured ? "Configured" : "Missing"} good={configured} />
        <StatusTile label="Cloud status" value={dbStatus === "connected" ? "Connected" : dbStatus} good={dbStatus === "connected"} />
        <StatusTile label="Your club role" value={activeMembership?.role || "Unknown"} good={Boolean(activeMembership)} />
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Project endpoint</div>
        <div className="mt-2 break-all font-mono text-xs font-bold text-slate-700">{SUPA_URL}</div>
      </div>

      {message ? (
        <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${dbStatus === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {dbStatus === "connected" ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
          <span>{message}</span>
        </div>
      ) : null}
    </section>
  );
}

function StatusTile({ label, value, good }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className={`mt-2 text-sm font-black capitalize ${good ? "text-emerald-700" : "text-amber-700"}`}>{value}</div>
    </div>
  );
}
