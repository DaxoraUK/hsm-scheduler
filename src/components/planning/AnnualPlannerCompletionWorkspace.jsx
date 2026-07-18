import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileSpreadsheet,
    RadioTower,
  Send,
  ShieldCheck,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  BULK_COMMAND_TYPES,
  buildAnnualPlannerFeedUrl,
  buildAnnualPlannerGrantEvidenceCsv,
  buildAnnualPlannerReadiness,
  buildBulkCommandPreview,
  normalisePlannerCalendarFeed,
  normaliseWaitlistOffer,
  plannerCalendarFeedToPayload,
  waitlistOfferToPayload,
} from "../../lib/planning/annualPlannerCompletionEngine.js";
import { normaliseWaitlistEntry } from "../../lib/planning/seasonalResourceEngine.js";
import { FULL_PITCH_AREA_ID, pitchAreaOptions } from "../../lib/planning/annualPlannerEngine.js";

function Field({ label, children, wide = false }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>;
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function downloadText(filename, content, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function blankOffer(waitlist = [], pitches = []) {
  const entry = waitlist.find((row) => row.status === "waiting") || waitlist[0] || {};
  const pitch = pitches[0] || {};
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + (Number(entry.requiredDurationMinutes || entry.required_duration_minutes) || 90) * 60000);
  return {
    waitlistEntryId: entry.id || "",
    startAt: start.toISOString().slice(0, 16),
    endAt: end.toISOString().slice(0, 16),
    pitchId: pitch.id || "",
    pitchName: pitch.label || pitch.name || "",
    pitchAreaId: "",
    pitchAreaName: "",
    message: "A suitable training slot is available. Please accept or decline this offer.",
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  };
}

export default function AnnualPlannerCompletionWorkspace({
  bookings = [],
  teams = [],
  pitches = [],
  winterSites = [],
  waitlist = [],
  waitlistOffers = [],
  calendarFeeds = [],
  analytics = null,
  canManage = false,
  saving = false,
  onCreateWaitlistOffer,
  onApplyBulkCommand,
  onCreateCalendarFeed,
  onRevokeCalendarFeed,
}) {
  const safeWaitlist = useMemo(() => waitlist.map(normaliseWaitlistEntry), [waitlist]);
  const safeOffers = useMemo(() => waitlistOffers.map(normaliseWaitlistOffer), [waitlistOffers]);
  const safeFeeds = useMemo(() => calendarFeeds.map(normalisePlannerCalendarFeed), [calendarFeeds]);
  const [offer, setOffer] = useState(() => blankOffer(safeWaitlist, pitches));
  const [bulk, setBulk] = useState({ commandType: "change_status", bookingIds: [], status: "confirmed", pitchId: "", pitchName: "", pitchAreaId: "", pitchAreaName: "", shiftDays: 7, reason: "" });
  const [feed, setFeed] = useState({ label: "Club Annual Planner", scopeType: "club", scopeKey: "", seasonPhase: "all" });
  const offerEntry = safeWaitlist.find((row) => row.id === offer.waitlistEntryId) || null;
  const selectedPitch = pitches.find((row) => String(row.id) === String(offer.pitchId)) || null;
  const offerAreaOptions = selectedPitch ? pitchAreaOptions(selectedPitch, { includeFullPitch: true }) : [];
  const bulkPreview = useMemo(() => buildBulkCommandPreview(bulk, bookings), [bulk, bookings]);
  const readiness = useMemo(() => buildAnnualPlannerReadiness({ bookings, waitlist: safeWaitlist, waitlistOffers: safeOffers, calendarFeeds: safeFeeds, analytics, teams, pitches, winterSites }), [analytics, bookings, pitches, safeFeeds, safeOffers, safeWaitlist, teams, winterSites]);

  const toggleBooking = (bookingId) => setBulk((current) => ({ ...current, bookingIds: current.bookingIds.includes(bookingId) ? current.bookingIds.filter((id) => id !== bookingId) : [...current.bookingIds, bookingId] }));

  return <div className="space-y-6">
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700"><Send size={15} /> Waiting-list offers</div><h2 className="mt-2 text-2xl font-black text-slate-950">Offer a real slot and let the coach respond</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">An offer does not create a confirmed booking until the assigned coach accepts it. Capacity is checked again at acceptance.</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black text-amber-900">{safeWaitlist.filter((row) => row.status === "waiting").length} teams waiting</div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Waiting team"><select className="input" value={offer.waitlistEntryId} onChange={(event) => setOffer((current) => ({ ...current, waitlistEntryId: event.target.value }))}><option value="">Choose team</option>{safeWaitlist.filter((row) => ["waiting", "offered"].includes(row.status)).map((row) => <option key={row.id} value={row.id}>{row.teamName} · {row.seasonPhase}</option>)}</select></Field>
        <Field label="Start"><input type="datetime-local" className="input" value={offer.startAt || ""} onChange={(event) => setOffer((current) => ({ ...current, startAt: event.target.value }))} /></Field>
        <Field label="End"><input type="datetime-local" className="input" value={offer.endAt || ""} onChange={(event) => setOffer((current) => ({ ...current, endAt: event.target.value }))} /></Field>
        <Field label="Expires"><input type="datetime-local" className="input" value={offer.expiresAt || ""} onChange={(event) => setOffer((current) => ({ ...current, expiresAt: event.target.value }))} /></Field>
        <Field label="Pitch"><select className="input" value={offer.pitchId || ""} onChange={(event) => { const pitch = pitches.find((row) => String(row.id) === event.target.value); setOffer((current) => ({ ...current, pitchId: event.target.value, pitchName: pitch?.label || pitch?.name || "", pitchAreaId: "", pitchAreaName: "" })); }}><option value="">Choose pitch</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.name || pitch.id}</option>)}</select></Field>
        <Field label="Pitch area"><select className="input" value={offer.pitchAreaId || ""} onChange={(event) => { const area = offerAreaOptions.find((row) => String(row.id) === event.target.value); setOffer((current) => ({ ...current, pitchAreaId: event.target.value, pitchAreaName: area?.label || (event.target.value === FULL_PITCH_AREA_ID ? "Full Pitch" : "") })); }}><option value="">Choose area</option>{offerAreaOptions.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></Field>
        <Field label="Coach message" wide><textarea className="input min-h-24 py-3" value={offer.message || ""} onChange={(event) => setOffer((current) => ({ ...current, message: event.target.value }))} /></Field>
      </div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs font-bold text-slate-600">{offerEntry ? `${offerEntry.teamName} · ${offerEntry.requiredDurationMinutes} minutes · priority ${offerEntry.priority}` : "Choose a waiting team to prepare an offer."}</div><button type="button" disabled={!canManage || saving || !offerEntry || !offer.startAt || !offer.endAt || !offer.pitchId} onClick={() => onCreateWaitlistOffer?.(waitlistOfferToPayload(offer))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-40"><Send size={16} /> Send slot offer</button></div>
      {safeOffers.length ? <div className="mt-5 grid gap-3 lg:grid-cols-2">{safeOffers.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-950">{row.teamName}</div><div className="mt-1 text-xs font-bold text-slate-500">{formatDateTime(row.startAt)} · {[row.pitchName, row.pitchAreaName].filter(Boolean).join(" · ")}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${row.status === "accepted" ? "bg-emerald-100 text-emerald-800" : row.status === "declined" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{row.status}</span></div>{row.coachResponse ? <p className="mt-3 text-xs font-semibold text-slate-600">Coach: {row.coachResponse}</p> : null}</div>)}</div> : null}
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-violet-700"><WandSparkles size={15} /> Bulk operational commands</div><h2 className="mt-2 text-2xl font-black text-slate-950">Change selected bookings in one controlled transaction</h2><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">The preview shows the affected teams before any status, pitch or date change is applied.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{bookings.filter((row) => !["cancelled", "rejected"].includes(row.status)).map((booking) => <label key={booking.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${bulk.bookingIds.includes(booking.id) ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"}`}><input type="checkbox" checked={bulk.bookingIds.includes(booking.id)} onChange={() => toggleBooking(booking.id)} /><span><span className="block text-sm font-black text-slate-900">{booking.teamName || booking.title}</span><span className="mt-1 block text-xs font-bold text-slate-500">{booking.startDate} · {booking.startTime} · {[booking.pitchName, booking.pitchAreaName].filter(Boolean).join(" · ") || "Facility TBC"}</span></span></label>)}</div>
        <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <Field label="Command"><select className="input" value={bulk.commandType} onChange={(event) => setBulk((current) => ({ ...current, commandType: event.target.value }))}>{BULK_COMMAND_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          {bulk.commandType === "change_status" ? <Field label="New status"><select className="input" value={bulk.status} onChange={(event) => setBulk((current) => ({ ...current, status: event.target.value }))}><option value="confirmed">Confirmed</option><option value="provisional">Provisional</option><option value="postponed">Postponed</option><option value="cancelled">Cancelled</option></select></Field> : null}
          {bulk.commandType === "move_pitch" ? <><Field label="New pitch"><select className="input" value={bulk.pitchId} onChange={(event) => { const pitch = pitches.find((row) => String(row.id) === event.target.value); setBulk((current) => ({ ...current, pitchId: event.target.value, pitchName: pitch?.label || pitch?.name || "", pitchAreaId: "", pitchAreaName: "" })); }}><option value="">Choose pitch</option>{pitches.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.name || pitch.id}</option>)}</select></Field><Field label="New area"><select className="input" value={bulk.pitchAreaId} onChange={(event) => { const pitch = pitches.find((row) => String(row.id) === String(bulk.pitchId)); const area = pitchAreaOptions(pitch || {}, { includeFullPitch: true }).find((row) => String(row.id) === event.target.value); setBulk((current) => ({ ...current, pitchAreaId: event.target.value, pitchAreaName: area?.label || "" })); }}><option value="">Choose area</option>{pitchAreaOptions(pitches.find((row) => String(row.id) === String(bulk.pitchId)) || {}, { includeFullPitch: true }).map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></Field></> : null}
          {bulk.commandType === "shift_dates" ? <Field label="Shift by days"><input type="number" min="-365" max="365" className="input" value={bulk.shiftDays} onChange={(event) => setBulk((current) => ({ ...current, shiftDays: Number(event.target.value) }))} /></Field> : null}
          <Field label="Reason"><textarea className="input min-h-20 py-3" value={bulk.reason} onChange={(event) => setBulk((current) => ({ ...current, reason: event.target.value }))} placeholder="Shown in the audit trail" /></Field>
          <div className="rounded-xl bg-white p-3 text-xs font-bold text-slate-600"><div>{bulkPreview.count} booking{bulkPreview.count === 1 ? "" : "s"} selected</div><div className="mt-1">{bulkPreview.affectedTeams.length} affected team{bulkPreview.affectedTeams.length === 1 ? "" : "s"}</div>{bulkPreview.errors.length ? <div className="mt-2 text-rose-700">{bulkPreview.errors[0]}</div> : null}</div>
          <button type="button" disabled={!canManage || saving || !bulkPreview.ready} onClick={() => onApplyBulkCommand?.(bulkPreview.payload)} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40"><ArrowRight size={16} /> Apply command</button>
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-sky-700"><RadioTower size={15} /> External calendar feeds</div><h2 className="mt-2 text-2xl font-black text-slate-950">Publish private live calendars</h2><p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Create revocable subscription links for the whole club, one team or one season.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Feed label" wide><input className="input" value={feed.label} onChange={(event) => setFeed((current) => ({ ...current, label: event.target.value }))} /></Field><Field label="Scope"><select className="input" value={feed.scopeType} onChange={(event) => setFeed((current) => ({ ...current, scopeType: event.target.value, scopeKey: "" }))}><option value="club">Whole club</option><option value="team">One team</option><option value="season">One season</option></select></Field>{feed.scopeType === "team" ? <Field label="Team"><select className="input" value={feed.scopeKey} onChange={(event) => setFeed((current) => ({ ...current, scopeKey: event.target.value }))}><option value="">Choose team</option>{teams.map((team) => <option key={team.id || team.key || team.name} value={team.id || team.key || team.name}>{team.name}</option>)}</select></Field> : null}{feed.scopeType === "season" ? <Field label="Season"><select className="input" value={feed.seasonPhase} onChange={(event) => setFeed((current) => ({ ...current, seasonPhase: event.target.value }))}><option value="preseason">Pre-season</option><option value="regular">Regular season</option><option value="winter">Winter training</option></select></Field> : null}</div><button type="button" disabled={!canManage || saving || (feed.scopeType === "team" && !feed.scopeKey)} onClick={() => onCreateCalendarFeed?.(plannerCalendarFeedToPayload(feed))} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-5 text-sm font-black text-white disabled:opacity-40"><CalendarPlus size={16} /> Create private feed</button><div className="mt-5 space-y-3">{safeFeeds.filter((row) => !row.revokedAt).map((row) => { const url = buildAnnualPlannerFeedUrl(row.token, typeof window === "undefined" ? "" : window.location.origin); return <div key={row.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><CalendarClock size={18} className="mt-0.5 text-sky-600" /><div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-950">{row.label}</div><div className="mt-1 text-xs font-bold text-slate-500">{row.scopeType} · {row.seasonPhase}</div><div className="mt-3 flex gap-2"><button type="button" onClick={async () => navigator.clipboard.writeText(url)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white"><ClipboardCopy size={14} /> Copy link</button><button type="button" disabled={!canManage || saving} onClick={() => onRevokeCalendarFeed?.(row.id)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700"><Trash2 size={14} /> Revoke</button></div></div></div></div>; })}{!safeFeeds.filter((row) => !row.revokedAt).length ? <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">No active operator feeds.</div> : null}</div></div>
      <div className="space-y-6"><section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300"><ShieldCheck size={15} /> Module acceptance</div><div className="mt-3 text-4xl font-black">{readiness.percent}%</div><div className="mt-1 text-sm font-semibold text-slate-300">{readiness.passed} of {readiness.total} operational checks complete</div><div className="mt-5 space-y-2">{readiness.checks.map((check) => <div key={check.key} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-xs font-bold"><CheckCircle2 size={15} className={check.passed ? "text-emerald-300" : "text-slate-500"} /><span className={check.passed ? "text-white" : "text-slate-400"}>{check.label}</span></div>)}</div></section><section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700"><FileSpreadsheet size={15} /> Grant evidence export</div><h2 className="mt-2 text-xl font-black text-emerald-950">One consistent evidence pack</h2><p className="mt-2 text-sm font-semibold leading-6 text-emerald-900/75">Export the same totals used by Annual Planner Insights and main Analytics.</p><button type="button" disabled={!analytics?.hasData} onClick={() => downloadText(`annual-planner-grant-evidence-${analytics?.year || new Date().getFullYear()}.csv`, buildAnnualPlannerGrantEvidenceCsv(analytics))} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white disabled:opacity-40"><ExternalLink size={16} /> Export grant evidence</button></section></div>
    </section>
  </div>;
}
