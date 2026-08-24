import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, Send, Siren, X } from "lucide-react";
import { toast } from "../../lib/notifications/daxoraNotifications.js";
import { DB } from "../../lib/supabase.js";

function supportReference() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12);
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 6).toUpperCase() : Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PILOT-${stamp}-${suffix}`;
}

export default function PilotIncidentReporter({ clubId = "", page = "", role = "viewer", workspaceName = "Ground Control" }) {
  const [open, setOpen] = useState(false);
  const [severity, setSeverity] = useState("warning");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape" && !busy) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, open]);
  const submit = async () => {
    if (summary.trim().length < 8) return;
    const reference = supportReference();
    setBusy(true);
    try {
      await DB.recordClientEvent({ clubId: clubId || null, level: severity, category: "manual_report", message: `${summary.trim()}${steps.trim() ? ` | Steps: ${steps.trim()}` : ""}`, reference, route: typeof window === "undefined" ? page : `${window.location.pathname}${window.location.hash}`, release: import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_RELEASE || "web", environment: import.meta.env.MODE || "production", context: { page, role, workspace_name: workspaceName, viewport: typeof window === "undefined" ? "" : `${window.innerWidth}x${window.innerHeight}`, online: typeof navigator === "undefined" ? true : navigator.onLine, user_agent: typeof navigator === "undefined" ? "" : navigator.userAgent.slice(0, 300) } });
      toast.success("Incident reported", { description: `Keep reference ${reference}. Daxora support can now track it.`, persist: true, category: "system", dedupeKey: reference });
      setSummary(""); setSteps(""); setSeverity("warning"); setOpen(false);
    } catch (error) {
      toast.error("Incident could not be submitted", { description: `${error?.message || "Copy the details and contact Daxora support."} Your draft has been kept.` });
    } finally { setBusy(false); }
  };
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Report a pilot incident" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"><Siren size={19} /></button>
    {open ? <div className="fixed inset-0 z-[190] flex items-end justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="pilot-incident-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-slate-950 p-5 text-white sm:p-6"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300"><AlertTriangle size={15} /> Pilot support</div><h2 id="pilot-incident-title" className="mt-2 text-2xl font-black">Report a problem</h2><p className="mt-2 text-sm font-semibold text-slate-300">Send a sanitised technical report to Daxora without including names, contact details or private fixture information.</p></div><button type="button" aria-label="Close incident report" disabled={busy} onClick={() => setOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10"><X size={17} /></button></div>
        <div className="space-y-4 p-5 sm:p-6">
          <label className="block text-xs font-black text-slate-700">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-emerald-500"><option value="warning">Problem - work can continue</option><option value="error">Critical - core workflow is blocked</option></select></label>
          <label className="block text-xs font-black text-slate-700">What happened?<textarea autoFocus value={summary} maxLength={320} onChange={(event) => setSummary(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" placeholder="Describe the behaviour without adding personal information or fixture details." /></label>
          <label className="block text-xs font-black text-slate-700">What were you trying to do? <span className="font-semibold text-slate-400">(optional)</span><textarea value={steps} maxLength={160} onChange={(event) => setSteps(event.target.value)} className="mt-2 min-h-20 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-emerald-500" placeholder="Example: opened Operations, reviewed the schedule, then selected Lock." /></label>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-semibold leading-5 text-sky-900">Ground Control adds the current page, application release, screen size and connection state. Passwords, tokens, emails, contacts, teams and fixture records are not included.</div>
          <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-600">Cancel</button><button type="button" disabled={busy || summary.trim().length < 8} onClick={submit} className="inline-flex h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white disabled:opacity-50">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />} Submit report</button></div>
        </div>
      </section>
    </div> : null}
  </>;
}
