import React from "react";
import { AlertTriangle, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { Auth, DB } from "../../lib/supabase.js";
import { clearTenantStorageContext } from "../../lib/storage/tenantStorage.js";
import { createSupportReference } from "../../lib/errors/recovery.js";
import { buildClientEvent, getClientReleaseMetadata, isClientTelemetryEnabled } from "../../lib/monitoring/clientTelemetry.js";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reference: "" };
  }

  static getDerivedStateFromError(error) {
    return { error, reference: createSupportReference() };
  }

  componentDidCatch(error, info) {
    console.error("Daxora workspace application error", {
      error,
      componentStack: info?.componentStack,
      reference: this.state.reference,
    });

    if (isClientTelemetryEnabled() && Auth.getSession()?.access_token) {
      const releaseMetadata = getClientReleaseMetadata();
      DB.recordClientEvent(buildClientEvent({
        level: "error",
        category: "application_crash",
        message: error?.message || "Daxora workspace application crash",
        reference: this.state.reference,
        route: typeof window === "undefined" ? "" : window.location.pathname,
        ...releaseMetadata,
        context: {
          errorName: error?.name || "Error",
          componentStack: info?.componentStack || "",
        },
      })).catch((telemetryError) => {
        console.warn("Ground Control telemetry could not be recorded", telemetryError);
      });
    }
  }

  reload = () => {
    window.location.reload();
  };

  returnToSignIn = () => {
    Auth.clearSession();
    clearTenantStorageContext();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-[#050816] px-5 py-10 text-white sm:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
          <section className="w-full overflow-hidden rounded-[34px] border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/30">
            <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-white/10 bg-gradient-to-br from-rose-500/15 via-slate-950 to-emerald-500/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-950/30">
                  <AlertTriangle size={28} strokeWidth={2.4} />
                </span>
                <div className="mt-7 text-[10px] font-black uppercase tracking-[0.24em] text-rose-300">
                  Safe recovery mode
                </div>
                <h1 className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                  The Daxora workspace hit an unexpected problem.
                </h1>
                <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300">
                  The workspace has been stopped before any further actions could run. Reloading usually restores the session without changing club or league data.
                </p>
              </div>

              <div className="bg-white p-7 text-slate-950 sm:p-10">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={20} />
                  <div>
                    <div className="text-sm font-black text-emerald-950">Your database security remains active</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-emerald-800">
                      This recovery screen does not bypass club or league isolation, roles or Supabase Row Level Security.
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Support reference</div>
                  <div className="mt-2 break-all font-mono text-sm font-black text-slate-900">{this.state.reference}</div>
                  <div className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Keep this reference if the problem repeats. Do not include passwords, access keys or private fixture data in a support message.
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={this.reload}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    <RefreshCw size={17} /> Reload workspace
                  </button>
                  <button
                    type="button"
                    onClick={this.returnToSignIn}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <LogOut size={17} /> Return to sign in
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }
}
