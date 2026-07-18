import { useMemo, useState } from "react";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, ClipboardCopy, Clock3, Filter, MapPin, Plus, ShieldAlert } from "lucide-react";
import {
  buildCoachCalendarEvents,
  buildCoachMonthCalendar,
  calendarEventIdentity,
  calendarEventLabel,
  calendarEventTone,
  COACH_CALENDAR_LEGEND,
  eventOccursOnDate,
} from "../../lib/coach/sharedCalendarEngine.js";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "").slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value, options = { weekday: "long", day: "numeric", month: "long" }) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", options).format(date);
}

function time(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function weekDateKeys(selectedDate) {
  const selected = new Date(`${selectedDate}T12:00:00`);
  const day = selected.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selected);
    date.setDate(selected.getDate() + mondayOffset + index);
    return dateKey(date);
  });
}

function EventDetail({ event }) {
  const unavailable = ["blackout", "pitch_closure"].includes(event.kind);
  return (
    <article className={`rounded-2xl border p-4 ${calendarEventTone(event)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{calendarEventLabel(event)}</span>
            {event.status ? <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-black uppercase tracking-wide">{String(event.status).replaceAll("_", " ")}</span> : null}
          </div>
          <h3 className="mt-2 text-sm font-black">{event.title}</h3>
          {event.teamName ? <div className="mt-1 text-xs font-bold opacity-75">{event.teamName}</div> : null}
          {event.pitchAreaName ? <div className="mt-2 inline-flex rounded-full border border-current/20 bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide">{event.pitchAreaName}</div> : null}
        </div>
        {unavailable ? <Ban size={18} className="shrink-0" /> : <CalendarDays size={18} className="shrink-0" />}
      </div>
      <div className="mt-3 space-y-1.5 text-xs font-bold opacity-80">
        <div className="flex items-center gap-2"><Clock3 size={14} /> {event.startTime || time(event.startAt)}{event.endTime || event.endAt ? `–${event.endTime || time(event.endAt)}` : ""}</div>
        <div className="flex items-center gap-2"><MapPin size={14} /> {[event.venueName, event.pitchName, event.pitchAreaName].filter(Boolean).join(" · ") || (unavailable ? "Club facilities" : "Venue TBC")}</div>
      </div>
      {event.publicNote ? <p className="mt-3 text-xs font-semibold leading-5 opacity-80">{event.publicNote}</p> : null}
      {event.affectedBookingCount ? <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-black"><ShieldAlert size={14} /> {event.affectedBookingCount} affected booking{event.affectedBookingCount === 1 ? "" : "s"}</div> : null}
    </article>
  );
}

export default function CoachSharedCalendar({ workspace, assignments = [], onCreateFeed, onRequestSlot, busy }) {
  const now = new Date();
  const [view, setView] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(dateKey(now));
  const [teamFilter, setTeamFilter] = useState("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showUnavailable, setShowUnavailable] = useState(true);
  const [showPending, setShowPending] = useState(true);

  const allEvents = useMemo(() => buildCoachCalendarEvents(workspace), [workspace]);
  const events = useMemo(() => allEvents.filter((event) => {
    if (!showUnavailable && ["blackout", "pitch_closure"].includes(event.kind)) return false;
    if (!showPending && event.kind === "request") return false;
    if (teamFilter !== "all" && event.teamKey && event.teamKey !== teamFilter) return false;
    if (facilityFilter !== "all" && String(event.pitchId || event.siteSlotId || event.venueName || "") !== facilityFilter) return false;
    if (statusFilter !== "all" && String(event.status || event.kind || "") !== statusFilter) return false;
    return true;
  }), [allEvents, facilityFilter, showPending, showUnavailable, statusFilter, teamFilter]);
  const cells = useMemo(() => buildCoachMonthCalendar(year, month, events), [events, month, year]);
  const selectedEvents = useMemo(() => events.filter((event) => eventOccursOnDate(event, selectedDate)), [events, selectedDate]);
  const agenda = useMemo(() => events.filter((event) => new Date(event.endAt || event.startAt || `${event.endDate || event.startDate}T23:59:59`).getTime() >= Date.now()).slice(0, 80), [events]);
  const facilityOptions = useMemo(() => {
    const map = new Map();
    allEvents.forEach((event) => {
      const value = String(event.pitchId || event.siteSlotId || event.venueName || "");
      if (!value) return;
      map.set(value, [event.venueName, event.pitchName, event.pitchAreaName].filter(Boolean).join(" · ") || value);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [allEvents]);
  const statusOptions = useMemo(() => [...new Set(allEvents.map((event) => String(event.status || event.kind || "")).filter(Boolean))].sort(), [allEvents]);
  const weekKeys = useMemo(() => weekDateKeys(selectedDate), [selectedDate]);

  const moveMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[30px] bg-gradient-to-br from-sky-700 to-slate-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">Shared club calendar</div><h1 className="mt-2 text-3xl font-black">My calendar</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-sky-100/80">Blackouts and pitch closures are visible before you request a slot, alongside bookings and pending requests.</p></div>
          <button disabled={busy} type="button" onClick={() => onCreateFeed(null)} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950"><ClipboardCopy size={17} /> Copy calendar feed</button>
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setView("month")} className={`h-10 rounded-xl px-4 text-xs font-black ${view === "month" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Month</button>
            <button type="button" onClick={() => setView("week")} className={`h-10 rounded-xl px-4 text-xs font-black ${view === "week" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Week</button>
            <button type="button" onClick={() => setView("agenda")} className={`h-10 rounded-xl px-4 text-xs font-black ${view === "agenda" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>Agenda</button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="relative"><Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-black"><option value="all">All my teams</option>{assignments.map((row) => <option key={row.id} value={row.teamKey}>{row.teamName}</option>)}</select></label>
            <select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)} className="h-10 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="all">All facilities</option>{facilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-black"><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600"><input type="checkbox" checked={showPending} onChange={(event) => setShowPending(event.target.checked)} /> Pending</label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600"><input type="checkbox" checked={showUnavailable} onChange={(event) => setShowUnavailable(event.target.checked)} /> Closures</label>
          </div>
        </div>
      </section>

      {view === "month" ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-sky-700">{year}</div><h2 className="mt-1 text-xl font-black">{MONTHS[month]}</h2></div><div className="flex gap-2"><button type="button" onClick={() => moveMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><ChevronLeft size={18} /></button><button type="button" onClick={() => { const today = new Date(); setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDate(dateKey(today)); }} className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-black">Today</button><button type="button" onClick={() => moveMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><ChevronRight size={18} /></button></div></div>
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map((day) => <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-wide text-slate-500">{day}</div>)}</div>
          <div className="grid grid-cols-7">{cells.map((cell) => <button type="button" key={cell.dateKey} onClick={() => setSelectedDate(cell.dateKey)} className={`min-h-[104px] border-b border-r border-slate-100 p-2 text-left ${cell.inMonth ? "bg-white" : "bg-slate-50/70"} ${selectedDate === cell.dateKey ? "ring-2 ring-inset ring-sky-400" : ""}`}><div className="flex items-center justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${cell.today ? "bg-sky-600 text-white" : "text-slate-700"}`}>{cell.date.getDate()}</span>{cell.events.length > 3 ? <span className="text-[9px] font-black text-slate-400">+{cell.events.length - 3}</span> : null}</div><div className="mt-2 space-y-1">{cell.events.slice(0, 3).map((event) => <span key={calendarEventIdentity(event)} className={`block truncate rounded-md border px-1.5 py-1 text-[9px] font-black ${calendarEventTone(event)}`}>{event.kind === "blackout" || event.kind === "pitch_closure" ? "Closed" : event.startTime || time(event.startAt)} {event.teamName || event.title}{event.pitchAreaName ? ` · ${event.pitchAreaName}` : ""}</span>)}</div></button>)}</div>
        </section>
        <aside className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Selected day</div><h2 className="mt-1 text-lg font-black">{formatDate(`${selectedDate}T12:00:00`)}</h2></div><button type="button" onClick={() => onRequestSlot?.(selectedDate)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950" aria-label="Request this date"><Plus size={18} /></button></div><div className="mt-5 space-y-3">{selectedEvents.length ? selectedEvents.map((event) => <EventDetail key={calendarEventIdentity(event)} event={event} />) : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center text-sm font-semibold text-slate-500">No visible activity. Use + to request this date.</div>}</div></aside>
      </div> : view === "week" ? <div className="grid gap-3 lg:grid-cols-7">{weekKeys.map((key) => { const dayEvents = events.filter((event) => eventOccursOnDate(event, key)); return <section key={key} className={`rounded-[22px] border bg-white p-3 shadow-sm ${key === selectedDate ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"}`}><button type="button" onClick={() => setSelectedDate(key)} className="w-full text-left"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{formatDate(`${key}T12:00:00`, { weekday: "short" })}</div><div className="mt-1 text-lg font-black text-slate-950">{formatDate(`${key}T12:00:00`, { day: "numeric", month: "short" })}</div></button><div className="mt-3 space-y-2">{dayEvents.length ? dayEvents.map((event) => <EventDetail key={calendarEventIdentity(event)} event={event} />) : <button type="button" onClick={() => onRequestSlot?.(key)} className="w-full rounded-xl border border-dashed border-slate-300 p-3 text-xs font-black text-slate-500 hover:border-emerald-400 hover:text-emerald-700">Request this day</button>}</div></section>; })}</div> : <div className="space-y-3">{agenda.length ? agenda.map((event) => <div key={calendarEventIdentity(event)} className="grid gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[100px_minmax(0,1fr)]"><div><div className="text-lg font-black">{new Date(event.startAt || `${event.startDate}T12:00:00`).getDate()}</div><div className="text-[10px] font-black uppercase text-slate-400">{formatDate(event.startAt || `${event.startDate}T12:00:00`, { weekday: "short", month: "short" })}</div></div><EventDetail event={event} /></div>) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">No upcoming calendar activity.</div>}</div>}

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Calendar key</div>
        <div className="mt-3 flex flex-wrap gap-2">{COACH_CALENDAR_LEGEND.map((item) => <span key={item.key} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${item.tone}`}><span className={`h-2.5 w-2.5 rounded-full ${item.swatch}`} />{item.label}</span>)}</div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{assignments.map((assignment) => <button disabled={busy} type="button" key={assignment.id} onClick={() => onCreateFeed(assignment)} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"><span><span className="block text-sm font-black">{assignment.teamName}</span><span className="mt-1 block text-xs font-semibold text-slate-500">Copy team-only calendar feed</span></span><ClipboardCopy size={17} className="text-sky-700" /></button>)}</section>
    </div>
  );
}
