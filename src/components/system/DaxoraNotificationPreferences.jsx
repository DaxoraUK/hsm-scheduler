import { useEffect, useState } from "react";
import { BellRing, Clock3, Mail, MonitorSmartphone, Save, Send, ShieldCheck } from "lucide-react";

const CATEGORIES = Object.freeze([
  ["system", "System and security"],
  ["fixtures", "Fixtures and publication"],
  ["results", "Results and tables"],
  ["reports", "Analytics and reports"],
  ["discipline", "Discipline and compliance"],
  ["registrations", "Registrations and eligibility"],
]);

function Toggle({ checked, onChange, label, detail, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 rounded-2xl border p-3.5 ${disabled ? "border-slate-100 bg-slate-50 opacity-60" : "border-slate-200 bg-white"}`}>
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 accent-emerald-600" />
      <span className="min-w-0"><span className="block text-xs font-black text-slate-950">{label}</span>{detail ? <span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-500">{detail}</span> : null}</span>
    </label>
  );
}

export default function DaxoraNotificationPreferences({ preferences, pushCapability, pushEnabled, busy, onSave, onEnablePush, onDisablePush, onTestPush }) {
  const [draft, setDraft] = useState(preferences);
  useEffect(() => setDraft(preferences), [preferences]);
  const patch = (next) => setDraft((current) => ({ ...current, ...next }));
  const categoryPatch = (key, value) => setDraft((current) => ({ ...current, categories: { ...current.categories, [key]: value } }));

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 text-emerald-700" /><div><div className="text-xs font-black text-emerald-950">Your notification controls</div><p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-800">Preferences are stored securely against your Daxora account and follow you across devices.</p></div></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><BellRing size={14} /> Delivery</div>
        <Toggle checked={draft.inAppEnabled} onChange={(value) => patch({ inAppEnabled: value })} label="In-app activity centre" detail="Keep action-required updates and warnings inside Daxora." />
        <Toggle checked={draft.emailAlertsEnabled} onChange={(value) => patch({ emailAlertsEnabled: value })} label="Email alerts" detail="Allow Daxora delivery workers and digests to email your account address." />
        <Toggle checked={draft.dailyDigestEnabled} onChange={(value) => patch({ dailyDigestEnabled: value })} label="Daily digest" detail="One concise email for unread Daxora activity." disabled={!draft.emailAlertsEnabled} />
        <Toggle checked={draft.weeklyDigestEnabled} onChange={(value) => patch({ weeklyDigestEnabled: value })} label="Weekly digest" detail="A Monday summary of outstanding actions." disabled={!draft.emailAlertsEnabled} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><MonitorSmartphone size={14} /> Browser and installed app</div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-slate-950">Daxora push notifications</div><div className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{!pushCapability.supported ? "This browser does not support web push." : !pushCapability.configured ? "The VAPID public key is not configured on this deployment." : pushEnabled ? "Enabled on this browser." : "Available on this browser."}</div></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${pushEnabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{pushEnabled ? "Enabled" : "Off"}</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {!pushEnabled ? <button type="button" disabled={busy || !pushCapability.supported || !pushCapability.configured} onClick={onEnablePush} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-50"><BellRing size={14} /> Enable</button> : <button type="button" disabled={busy} onClick={onDisablePush} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700"><MonitorSmartphone size={14} /> Disable</button>}
            {pushEnabled ? <button type="button" disabled={busy} onClick={onTestPush} className="inline-flex h-9 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700"><Send size={14} /> Send test</button> : null}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><Clock3 size={14} /> Quiet hours</div>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">From</span><input type="time" value={draft.quietStart || ""} onChange={(event) => patch({ quietStart: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold" /></label>
          <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Until</span><input type="time" value={draft.quietEnd || ""} onChange={(event) => patch({ quietEnd: event.target.value })} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold" /></label>
          <div className="col-span-2 text-[10px] font-semibold text-slate-500">Timezone: {draft.timezone || "Europe/London"}. Quiet hours suppress disruptive push delivery; activity remains in Daxora.</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500"><Mail size={14} /> Categories</div>
        <div className="grid gap-2 sm:grid-cols-2">{CATEGORIES.map(([key, label]) => <Toggle key={key} checked={draft.categories?.[key] !== false} onChange={(value) => categoryPatch(key, value)} label={label} />)}</div>
      </div>

      <button type="button" disabled={busy} onClick={() => onSave(draft)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50"><Save size={14} /> Save notification preferences</button>
    </div>
  );
}
