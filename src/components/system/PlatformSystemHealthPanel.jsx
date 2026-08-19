import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import {
  buildBrowserDiagnostics,
  buildSupportDiagnosticsPack,
  normaliseSystemHealth,
  systemHealthHeadline,
} from "../../lib/monitoring/systemHealth.js";

const buttonPrimary = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const buttonSecondary = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value) {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function stateStyle(state) {
  if (state === "ready") return { Icon: CheckCircle2, badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "bg-emerald-50 text-emerald-700" };
  if (state === "blocked") return { Icon: XCircle, badge: "bg-rose-50 text-rose-700 border-rose-200", icon: "bg-rose-50 text-rose-700" };
  if (state === "conditional") return { Icon: AlertTriangle, badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "bg-amber-50 text-amber-700" };
  return { Icon: Activity, badge: "bg-slate-50 text-slate-600 border-slate-200", icon: "bg-slate-100 text-slate-600" };
}

function HealthCheck({ item }) {
  const style = stateStyle(item.state);
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}><style.Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black text-slate-950">{item.label}</div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${style.badge}`}>{item.state.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{item.detail}</p>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
            <span>{item.category}</span>{item.critical ? <span className="text-rose-500">Critical</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlatformSystemHealthPanel({ platformContext }) {
  const [healthPayload, setHealthPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const browser = useMemo(() => buildBrowserDiagnostics(), []);
  const health = useMemo(() => normaliseSystemHealth(healthPayload || {}), [healthPayload]);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/health", { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && !payload?.checks) throw new Error(payload?.error || "Platform health could not be checked.");
      setHealthPayload(payload);
    } catch (nextError) {
      setError(nextError?.message || "Platform health could not be checked.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const supportPack = useMemo(() => buildSupportDiagnosticsPack({
    health: healthPayload,
    browser,
    context: {
      operatorRole: platformContext?.roleLabel || "Platform operator",
      platformAccess: platformContext?.isPlatformAdmin ? "administrator" : "support",
    },
  }), [browser, healthPayload, platformContext?.isPlatformAdmin, platformContext?.roleLabel]);

  const downloadPack = () => {
    const blob = new Blob([JSON.stringify(supportPack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `daxora-support-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Support diagnostics downloaded", { description: "The pack excludes passwords, access tokens and operational records." });
  };

  const copySummary = async () => {
    const blocked = health.checks.filter((item) => item.state === "blocked").map((item) => item.label).join(", ") || "none";
    const conditional = health.checks.filter((item) => item.state === "conditional").map((item) => item.label).join(", ") || "none";
    const summary = [
      `Daxora health: ${health.status}`,
      `Release: ${health.release}`,
      `Environment: ${health.environment}`,
      `Checked: ${formatDate(health.generatedAt)}`,
      `Blocked: ${blocked}`,
      `Warnings: ${conditional}`,
      `Browser online: ${browser.online ? "yes" : "no"}`,
    ].join("\n");
    await navigator.clipboard.writeText(summary);
    toast.success("Health summary copied");
  };

  const headlineStyle = health.status === "ready"
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : health.status === "degraded"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-rose-200 bg-rose-50 text-rose-950";

  return (
    <section className="space-y-6" aria-labelledby="platform-health-title">
      <div className={`rounded-[30px] border p-6 shadow-sm ${headlineStyle}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 shadow-sm"><ShieldCheck size={23} /></span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Pilot confidence</div>
              <h2 id="platform-health-title" className="mt-1 text-2xl font-black">{loading ? "Checking platform services…" : systemHealthHeadline(healthPayload)}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 opacity-75">Configuration status is sanitised. Secret values, player data, fixture content and private documents are never returned by this screen.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadHealth} disabled={loading} className={buttonSecondary}><RefreshCw className={loading ? "animate-spin" : ""} size={16} /> Recheck</button>
            <button type="button" onClick={copySummary} disabled={!health.checks.length} className={buttonSecondary}><ClipboardCopy size={16} /> Copy summary</button>
            <button type="button" onClick={downloadPack} className={buttonPrimary}><Download size={16} /> Download support pack</button>
          </div>
        </div>
        {error ? <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-white p-4 text-sm font-bold text-rose-800">{error}</div> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Ready", health.summary.ready, "bg-emerald-50 text-emerald-700"],
          ["Warnings", health.summary.conditional, "bg-amber-50 text-amber-700"],
          ["Blocked", health.summary.blocked, "bg-rose-50 text-rose-700"],
          ["Release", health.release, "bg-sky-50 text-sky-700"],
          ["Last check", formatDate(health.generatedAt), "bg-slate-100 text-slate-700"],
        ].map(([label, value, tone]) => <div key={label} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className={`inline-flex rounded-xl px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tone}`}>{label}</div><div className="mt-3 break-words text-lg font-black text-slate-950">{value}</div></div>)}
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {health.checks.map((item) => <HealthCheck key={item.code} item={item} />)}
        {!loading && !health.checks.length ? <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">No health checks were returned. Recheck the deployment or review the Desktop installer log.</div> : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Monitor className="text-sky-600" size={21} /><div><h3 className="text-lg font-black text-slate-950">Browser readiness</h3><p className="text-xs font-semibold text-slate-500">Useful when reproducing a pilot issue on a particular device.</p></div></div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["Connection", browser.online ? "Online" : "Offline"],
              ["Viewport", `${browser.viewport.width} × ${browser.viewport.height}`],
              ["Timezone", browser.timezone],
              ["Service worker", browser.capabilities.serviceWorker ? "Supported" : "Unavailable"],
              ["Push", browser.capabilities.pushManager ? "Supported" : "Unavailable"],
              ["Clipboard", browser.capabilities.clipboard ? "Supported" : "Unavailable"],
            ].map(([label, value]) => <div key={label} className="rounded-2xl bg-slate-50 p-4"><dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-black text-slate-800">{value}</dd></div>)}
          </dl>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Wifi className="text-emerald-600" size={21} /><div><h3 className="text-lg font-black text-slate-950">Support-pack boundaries</h3><p className="text-xs font-semibold text-slate-500">Safe operational evidence without leaking customer data.</p></div></div>
          <ul className="mt-5 space-y-3 text-sm font-semibold leading-6 text-slate-600">
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} /> Includes release, environment, browser capability and provider configuration state.</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} /> Excludes passwords, tokens, cookies, player data, fixtures and private documents.</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} /> Can be attached to an internal support case or release evidence record.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
