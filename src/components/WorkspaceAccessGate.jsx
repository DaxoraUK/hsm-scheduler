import React, { useState } from "react";
import { Building2, DatabaseZap, LoaderCircle, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import GroundControlBrand from "./GroundControlBrand.jsx";

export default function WorkspaceAccessGate({
  status = "loading",
  error = "",
  canBootstrap = false,
  defaultClubName = "Ground Control Club",
  onBootstrap,
  onRetry,
  onSignOut,
}) {
  const [clubName, setClubName] = useState(defaultClubName);
  const busy = status === "loading";

  const secureWorkspace = async () => {
    if (busy || !clubName.trim()) return;
    await onBootstrap?.({
      clubName: clubName.trim(),
      organisationName: clubName.trim(),
    });
  };

  return (
    <main className="min-h-screen bg-[#050816] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <div className="flex items-center justify-between gap-4">
          <GroundControlBrand />
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
              <ShieldCheck size={14} /> Secure workspace access
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              Every organisation is verified before a Daxora product opens.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-400 sm:text-lg">
              Your account must have an active club membership. Database policies then enforce the same boundary even if somebody bypasses the interface.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                [LockKeyhole, "Authenticated", "Every database request carries the signed-in user's token."],
                [Building2, "Club scoped", "Reads and writes always include the selected club."],
                [DatabaseZap, "RLS enforced", "Supabase independently rejects cross-club access."],
              ].map(([Icon, title, detail]) => (
                <div key={title} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                  <Icon size={22} className="text-emerald-300" />
                  <div className="mt-4 text-sm font-black text-white">{title}</div>
                  <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">{detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-white p-6 text-slate-950 shadow-[0_35px_100px_rgba(0,0,0,0.35)] sm:p-8">
            {busy ? (
              <div className="py-12 text-center">
                <LoaderCircle size={34} className="mx-auto animate-spin text-emerald-600" />
                <div className="mt-5 text-xl font-black">Verifying club access</div>
                <p className="mt-2 text-sm font-semibold text-slate-500">Checking your memberships and secure data boundary.</p>
              </div>
            ) : canBootstrap ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck size={27} />
                </div>
                <h2 className="mt-5 text-2xl font-black">Secure the existing workspace</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  This is the one-time conversion from the original single-club prototype. Existing database rows will be assigned to this club and your account will become its owner.
                </p>

                <label className="mt-6 block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Club name</span>
                  <input
                    value={clubName}
                    onChange={(event) => setClubName(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </label>

                {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

                <button
                  type="button"
                  onClick={secureWorkspace}
                  disabled={!clubName.trim()}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LockKeyhole size={18} className="text-emerald-300" /> Secure existing workspace
                </button>
                <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">
                  Use this only after running the supplied multi-club migration in Supabase.
                </p>
              </>
            ) : status === "error" ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                  <DatabaseZap size={27} />
                </div>
                <h2 className="mt-5 text-2xl font-black">Club access could not be verified</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Ground Control has kept the workspace closed because the authenticated membership boundary could not be confirmed.
                </p>
                {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                >
                  <RefreshCw size={18} /> Retry secure access check
                </button>
              </>
            ) : status === "bootstrap-locked" ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <LockKeyhole size={27} />
                </div>
                <h2 className="mt-5 text-2xl font-black">Bootstrap authorisation required</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  The database has been upgraded, but no club owns the original workspace yet. For safety, only a specifically authorised account can perform the one-time conversion.
                </p>
                {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
                  Follow the supplied rollout guide to authorise this user ID in Supabase, then check access again. Do not enable public access or weaken Row Level Security.
                </div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                >
                  <RefreshCw size={18} /> Check authorisation again
                </button>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Building2 size={27} />
                </div>
                <h2 className="mt-5 text-2xl font-black">No active product access found</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  Your sign-in is valid, but it is not attached to an active club workspace. If you were invited to Coach Hub, open the latest invitation and sign in with the exact invited email. Otherwise, ask a club owner or administrator to add this account.
                </p>
                {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-800 transition hover:bg-slate-50"
                >
                  <RefreshCw size={18} /> Check access again
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
