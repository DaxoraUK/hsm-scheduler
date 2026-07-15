import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  ListChecks,
  MapPin,
  MoreHorizontal,
  Plus,
  PoundSterling,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import DaxoraConfirmDialog from "../components/system/DaxoraConfirmDialog.jsx";
import CoachRequestReviewDialog from "../components/coach/CoachRequestReviewDialog.jsx";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import {
  ANNUAL_BOOKING_STATUSES,
  ANNUAL_BOOKING_TYPES,
  RECURRENCE_OPTIONS,
  annualBookingToPayload,
  buildAnnualPlannerCsv,
  buildAnnualPlannerSnapshot,
  buildMonthCalendar,
  detectAnnualPlannerConflicts,
  expandRecurringBookingDraft,
  findAnnualPlannerSuggestions,
  localDateTime,
  matchdayFixtureToAnnualBooking,
  normaliseAnnualBooking,
  normaliseAnnualBlackout,
  normaliseDateKey,
  normaliseTime,
} from "../lib/planning/annualPlannerEngine.js";
import { normaliseCoachRequest, requestStatusLabel } from "../lib/coach/coachHubEngine.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TYPE_TONES = {
  training: "border-sky-200 bg-sky-50 text-sky-800",
  friendly: "border-emerald-200 bg-emerald-50 text-emerald-800",
  camp: "border-violet-200 bg-violet-50 text-violet-800",
  tournament: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  maintenance: "border-amber-200 bg-amber-50 text-amber-900",
  meeting: "border-slate-200 bg-slate-100 text-slate-700",
  external_hire: "border-cyan-200 bg-cyan-50 text-cyan-800",
  match: "border-rose-200 bg-rose-50 text-rose-800",
};

function money(pence) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((Number(pence) || 0) / 100);
}

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-GB", options).format(date);
}

function localKey(clubId) {
  return `daxora_annual_planner_${String(clubId || "local")}`;
}

function readLocalWorkspace(clubId) {
  try {
    return JSON.parse(localStorage.getItem(localKey(clubId)) || "{}") || {};
  } catch {
    return {};
  }
}

function writeLocalWorkspace(clubId, workspace) {
  localStorage.setItem(localKey(clubId), JSON.stringify(workspace));
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

function dateRangeForYear(year) {
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

function blankBooking({ year, month, pitchCfg, settings, canManage = false } = {}) {
  const today = new Date();
  const date = Number(year) === today.getFullYear() && Number(month) === today.getMonth()
    ? normaliseDateKey(today)
    : `${year}-${String(Number(month) + 1).padStart(2, "0")}-01`;
  const duration = Number(settings?.default_training_duration_minutes || settings?.defaultTrainingDurationMinutes || 90);
  const endMinutes = 18 * 60 + duration;
  return {
    title: "Training session",
    bookingType: "training",
    status: (settings?.require_approval || settings?.requireApproval) && !canManage
      ? "requested"
      : settings?.default_status || settings?.defaultStatus || "provisional",
    teamKey: "",
    teamName: "",
    opponentName: "",
    venueId: pitchCfg?.[0]?.siteId || "",
    venueName: pitchCfg?.[0]?.siteLabel || "",
    pitchId: pitchCfg?.[0]?.id || "",
    pitchName: pitchCfg?.[0]?.label || "",
    startDate: date,
    startTime: "18:00",
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    recurrence: "none",
    recurrenceUntil: date,
    costPence: 0,
    supplierReference: "",
    bookingReference: "",
    contactName: "",
    contactEmail: "",
    notes: "",
  };
}

export default function AnnualPlannerPage({
  club = {},
  pitchCfg = [],
  teamCfg = [],
  workspaceAccess = {},
  satFinal = [],
  sunFinal = [],
  midweekFinal = [],
  satDate = "",
  sunDate = "",
  midweekDate = "",
  midweekEnabled = true,
}) {
  const clubId = club.id || "";
  const canOperate = Boolean(workspaceAccess.canOperate);
  const canManage = Boolean(workspaceAccess.canManageSettings || workspaceAccess.role === "owner" || workspaceAccess.role === "admin");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState("calendar");
  const [workspace, setWorkspace] = useState({ settings: {}, bookings: [], blackouts: [] });
  const [coachRequests, setCoachRequests] = useState([]);
  const [coachReview, setCoachReview] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(normaliseDateKey(today));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editor, setEditor] = useState(null);
  const [blackoutEditor, setBlackoutEditor] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const approvalRequired = Boolean(workspace.settings?.require_approval ?? workspace.settings?.requireApproval);
  const canViewCosts = canManage || (workspace.settings?.show_costs_to_schedulers ?? workspace.settings?.showCostsToSchedulers ?? true) !== false;

  const matchdayBookings = useMemo(() => [
    ...satFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: satDate, pitchCfg })).filter(Boolean),
    ...sunFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: sunDate, pitchCfg })).filter(Boolean),
    ...(midweekEnabled ? midweekFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: midweekDate, pitchCfg })).filter(Boolean) : []),
  ], [midweekDate, midweekEnabled, midweekFinal, pitchCfg, satDate, satFinal, sunDate, sunFinal]);

  const loadWorkspace = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus("loading");
    setError("");
    try {
      let result;
      let coachPayload = { requests: [] };
      if (isSupaConfigured() && clubId) {
        [result, coachPayload] = await Promise.all([
          DB.listAnnualPlannerWorkspace(clubId, dateRangeForYear(year)),
          canOperate ? DB.listCoachHubRequestQueue(clubId) : Promise.resolve({ requests: [] }),
        ]);
      } else {
        result = readLocalWorkspace(clubId);
      }
      setWorkspace({
        settings: result?.settings || {},
        bookings: Array.isArray(result?.bookings) ? result.bookings.map(normaliseAnnualBooking) : [],
        blackouts: Array.isArray(result?.blackouts) ? result.blackouts.map(normaliseAnnualBlackout) : [],
      });
      setCoachRequests(
        (Array.isArray(coachPayload?.requests) ? coachPayload.requests : [])
          .map(normaliseCoachRequest)
          .filter((request) => ["submitted", "needs_information", "alternative_offered"].includes(request.status)),
      );
      setStatus("ready");
    } catch (loadError) {
      setError(loadError?.message || "The annual planner could not be loaded.");
      setStatus("error");
    }
  }, [canOperate, clubId, year]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const refresh = (event) => {
      const changedClubId = String(event?.detail?.clubId || "");
      if (changedClubId && changedClubId !== String(clubId)) return;
      loadWorkspace({ quiet: true });
    };
    window.addEventListener("daxora-annual-planner-updated", refresh);
    return () => window.removeEventListener("daxora-annual-planner-updated", refresh);
  }, [clubId, loadWorkspace]);

  const snapshot = useMemo(() => buildAnnualPlannerSnapshot({ bookings: workspace.bookings, blackouts: workspace.blackouts, year }), [workspace, year]);
  const allCalendarBookings = useMemo(() => [...snapshot.bookings, ...matchdayBookings.filter((booking) => Number(booking.startDate.slice(0, 4)) === year)], [matchdayBookings, snapshot.bookings, year]);
  const calendar = useMemo(() => buildMonthCalendar(year, month, allCalendarBookings), [allCalendarBookings, month, year]);
  const selectedDayBookings = useMemo(() => allCalendarBookings.filter((booking) => booking.startDate === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [allCalendarBookings, selectedDate]);
  const filteredBookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.bookings
      .filter((booking) => typeFilter === "all" || booking.bookingType === typeFilter)
      .filter((booking) => !needle || [booking.title, booking.teamName, booking.opponentName, booking.pitchName, booking.venueName, booking.bookingReference].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  }, [query, snapshot.bookings, typeFilter]);
  const requestQueue = useMemo(() => snapshot.bookings.filter((booking) => booking.status === "requested"), [snapshot.bookings]);
  const totalRequests = requestQueue.length + coachRequests.length;

  async function decideCoachRequest(decision, data = {}) {
    if (!coachReview) return;
    setSaving(true);
    try {
      await DB.reviewCoachHubRequest(clubId, coachReview.id, decision, data);
      setCoachReview(null);
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(decision === "approve" ? "Coach request approved" : decision === "alternative" ? "Alternative sent to coach" : "Coach request updated");
    } catch (decisionError) {
      toast.error("Coach request could not be updated", { description: decisionError?.message });
    } finally {
      setSaving(false);
    }
  }

  function announceUpdate() {
    window.dispatchEvent(new CustomEvent("daxora-annual-planner-updated", { detail: { clubId } }));
  }

  async function persistBookingDraft(draft) {
    const effectiveDraft = approvalRequired && !canManage
      ? { ...draft, status: "requested" }
      : draft;
    const occurrences = expandRecurringBookingDraft(effectiveDraft);
    if (!occurrences.length) throw new Error("Choose a valid booking date and time.");
    const accepted = [];
    for (const occurrence of occurrences) {
      const conflicts = detectAnnualPlannerConflicts(occurrence, {
        bookings: [...workspace.bookings, ...accepted],
        blackouts: workspace.blackouts,
        matchdayBookings,
        ignoreId: effectiveDraft.id || "",
      });
      if (conflicts.length) {
        const failure = new Error(conflicts[0].message);
        failure.conflicts = conflicts;
        throw failure;
      }
      accepted.push(occurrence);
    }

    if (isSupaConfigured() && clubId) {
      if (effectiveDraft.id || accepted.length === 1) {
        await DB.saveAnnualPlannerBooking(clubId, annualBookingToPayload({ ...accepted[0], id: effectiveDraft.id || "" }));
      } else {
        await DB.saveAnnualPlannerBookingSeries(clubId, accepted.map(annualBookingToPayload));
      }
    } else {
      const current = readLocalWorkspace(clubId);
      const rows = Array.isArray(current.bookings) ? current.bookings.map(normaliseAnnualBooking) : [];
      const next = effectiveDraft.id
        ? rows.map((row) => row.id === effectiveDraft.id ? normaliseAnnualBooking({ ...accepted[0], id: effectiveDraft.id }) : row)
        : [...rows, ...accepted.map((row) => normaliseAnnualBooking({ ...row, id: crypto.randomUUID() }))];
      writeLocalWorkspace(clubId, { ...current, settings: workspace.settings, bookings: next, blackouts: workspace.blackouts });
    }
  }

  async function saveBooking(draft) {
    setSaving(true);
    try {
      await persistBookingDraft(draft);
      setEditor(null);
      setSelectedBooking(null);
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(draft.id ? "Booking updated" : "Booking added to the annual planner", {
        description: draft.recurrence && draft.recurrence !== "none" ? "The complete recurring series has been checked for conflicts." : `${draft.startDate} · ${draft.startTime}`,
      });
    } catch (saveError) {
      toast.error("Booking could not be saved", { description: saveError?.message || "Review the booking and try again." });
      throw saveError;
    } finally {
      setSaving(false);
    }
  }

  async function updateBookingStatus(booking, nextStatus) {
    setSaving(true);
    try {
      await persistBookingDraft({ ...booking, status: nextStatus, recurrence: "none" });
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(nextStatus === "confirmed" ? "Booking approved" : "Booking status updated");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBooking({ booking, deleteSeries }) {
    setSaving(true);
    try {
      if (isSupaConfigured() && clubId) {
        await DB.deleteAnnualPlannerBooking(clubId, booking.id, { deleteSeries });
      } else {
        const current = readLocalWorkspace(clubId);
        const rows = (current.bookings || []).map(normaliseAnnualBooking).filter((row) => deleteSeries && booking.seriesId ? row.seriesId !== booking.seriesId : row.id !== booking.id);
        writeLocalWorkspace(clubId, { ...current, bookings: rows });
      }
      setSelectedBooking(null);
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(deleteSeries ? "Booking series removed" : "Booking removed");
    } finally {
      setSaving(false);
      setConfirmRequest(null);
    }
  }

  async function saveBlackout(draft) {
    const start = localDateTime(draft.startDate, draft.startTime);
    let end = localDateTime(draft.endDate || draft.startDate, draft.endTime);
    if (!start || !end || end <= start) throw new Error("Choose a valid blackout period.");
    const payload = {
      blackout_id: draft.id || null,
      title: draft.title,
      venue_id: draft.venueId || null,
      pitch_id: draft.pitchId || null,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: draft.reason || null,
    };
    setSaving(true);
    try {
      if (isSupaConfigured() && clubId) await DB.saveAnnualPlannerBlackout(clubId, payload);
      else {
        const current = readLocalWorkspace(clubId);
        const next = [...(current.blackouts || []), normaliseAnnualBlackout({ ...payload, id: crypto.randomUUID() })];
        writeLocalWorkspace(clubId, { ...current, blackouts: next });
      }
      setBlackoutEditor(null);
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success("Facility blackout saved");
    } finally {
      setSaving(false);
    }
  }

  function openCreateBooking(date = selectedDate) {
    setEditor({ ...blankBooking({ year, month, pitchCfg, settings: workspace.settings, canManage }), startDate: date || normaliseDateKey(new Date()) });
  }

  function exportYear() {
    downloadText(`daxora-annual-planner-${year}.csv`, buildAnnualPlannerCsv(snapshot.bookings, { includeCosts: canViewCosts }));
    toast.success("Annual planner export created");
  }

  if (status === "loading") return <PlannerLoading />;

  return (
    <div className="space-y-6 pb-14">
      <style>{`.input{height:44px;width:100%;border-radius:12px;border:1px solid rgb(226 232 240);background:white;padding:0 12px;font-size:14px;font-weight:700;color:rgb(15 23 42);outline:none}.input:focus{border-color:rgb(52 211 153);box-shadow:0 0 0 3px rgb(209 250 229)}`}</style>
      <section className="overflow-hidden rounded-[32px] bg-[#07121f] text-white shadow-xl">
        <div className="relative p-6 sm:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300"><CalendarRange size={15} /> Annual facility command</div>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Pitch Booking, Training & Friendlies</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-300">Plan the whole calendar year, protect shared facilities and keep training, friendlies and matchdays in one conflict-aware workspace.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportYear} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black text-white hover:bg-white/10"><Download size={17} /> Export year</button>
              {canOperate ? <button type="button" onClick={() => openCreateBooking()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950 hover:bg-emerald-300"><Plus size={18} /> Add booking</button> : null}
            </div>
          </div>
          <div className={`relative mt-7 grid gap-3 sm:grid-cols-2 ${canViewCosts ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
            <Metric icon={CalendarDays} label="Active bookings" value={snapshot.metrics.active} detail={`${snapshot.metrics.confirmed} confirmed`} />
            <Metric icon={Clock3} label="Facility hours" value={snapshot.metrics.hours} detail="Across the selected year" />
            <Metric icon={Sparkles} label="Friendlies" value={snapshot.metrics.friendlies} detail="Internal and external" />
            <Metric icon={ListChecks} label="Requests" value={totalRequests} detail={totalRequests ? "Awaiting approval" : "Queue clear"} tone={totalRequests ? "warning" : "ready"} />
            {canViewCosts ? <Metric icon={PoundSterling} label="Planned cost" value={money(snapshot.metrics.costPence)} detail="Confirmed and provisional" /> : null}
          </div>
        </div>
      </section>

      {error ? <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><div className="font-black">Annual planner needs attention</div><div className="mt-1 text-sm font-semibold">{error}</div></div><button type="button" onClick={() => loadWorkspace()} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm"><RefreshCw size={14} /> Retry</button></div> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["calendar", "Calendar", CalendarDays, "Full year and monthly planning"],
            ["bookings", "Bookings", ListChecks, "Search and manage every booking"],
            ["requests", "Requests", ShieldCheck, "Approvals and provisional demand"],
            ["availability", "Availability", Ban, "Closures, blackouts and controls"],
          ].map(([key, label, Icon, detail]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${tab === key ? "bg-slate-950 text-white shadow-md" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tab === key ? "bg-white/10 text-emerald-300" : "bg-white text-slate-500 shadow-sm"}`}><Icon size={19} /></span>
              <span><span className="block text-sm font-black">{label}</span><span className={`mt-0.5 block text-[11px] font-semibold ${tab === key ? "text-slate-400" : "text-slate-500"}`}>{detail}</span></span>
            </button>
          ))}
        </div>
      </section>

      {tab === "calendar" ? (
        <CalendarWorkspace
          year={year} month={month} setYear={setYear} setMonth={setMonth}
          cells={calendar} selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          selectedDayBookings={selectedDayBookings} onSelectBooking={setSelectedBooking}
          onCreate={canOperate ? openCreateBooking : null} matchdayBookings={matchdayBookings}
        />
      ) : null}

      {tab === "bookings" ? (
        <BookingsWorkspace
          bookings={filteredBookings} query={query} setQuery={setQuery} typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          onSelect={setSelectedBooking} onCreate={canOperate ? () => openCreateBooking() : null}
        />
      ) : null}

      {tab === "requests" ? (
        <RequestsWorkspace
          bookings={requestQueue}
          coachRequests={coachRequests}
          canOperate={canManage}
          saving={saving}
          onSelect={setSelectedBooking}
          onSelectCoachRequest={setCoachReview}
          onApprove={(booking) => updateBookingStatus(booking, "confirmed")}
          onReject={(booking) => updateBookingStatus(booking, "rejected")}
        />
      ) : null}

      {tab === "availability" ? (
        <AvailabilityWorkspace
          blackouts={workspace.blackouts} pitchCfg={pitchCfg} canOperate={canOperate} canManage={canManage}
          onCreate={() => setBlackoutEditor({ title: "Pitch unavailable", startDate: normaliseDateKey(new Date()), endDate: normaliseDateKey(new Date()), startTime: "08:00", endTime: "22:00", venueId: "", pitchId: "", reason: "" })}
          settings={workspace.settings}
        />
      ) : null}

      <BookingDrawer
        booking={selectedBooking}
        canOperate={canOperate}
        canApprove={canManage}
        canViewCosts={canViewCosts}
        saving={saving}
        onClose={() => setSelectedBooking(null)}
        onEdit={(booking) => setEditor({ ...booking, status: approvalRequired && !canManage ? "requested" : booking.status, recurrence: "none", recurrenceUntil: booking.startDate })}
        onApprove={(booking) => canManage ? updateBookingStatus(booking, "confirmed") : undefined}
        onDelete={(booking) => setConfirmRequest({
          tone: "danger",
          title: booking.seriesId ? "Remove this booking or the whole series?" : "Remove this booking?",
          description: `${booking.title} on ${formatDate(booking.startAt)} will be removed from the annual facility plan.`,
          confirmLabel: booking.seriesId ? "Remove series" : "Remove booking",
          cancelLabel: "Keep booking",
          booking,
          deleteSeries: Boolean(booking.seriesId),
        })}
      />

      <BookingEditor
        draft={editor}
        setDraft={setEditor}
        saving={saving}
        pitchCfg={pitchCfg}
        teamCfg={teamCfg}
        bookings={workspace.bookings}
        blackouts={workspace.blackouts}
        matchdayBookings={matchdayBookings}
        canViewCosts={canViewCosts}
        approvalRequired={approvalRequired}
        canManage={canManage}
        onSave={saveBooking}
      />

      <BlackoutEditor draft={blackoutEditor} setDraft={setBlackoutEditor} pitchCfg={pitchCfg} saving={saving} onSave={saveBlackout} />

      {coachReview ? <CoachRequestReviewDialog request={coachReview} busy={saving} onClose={() => setCoachReview(null)} onDecision={decideCoachRequest} /> : null}

      <DaxoraConfirmDialog
        request={confirmRequest}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => confirmRequest?.booking ? deleteBooking(confirmRequest) : setConfirmRequest(null)}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const toneClass = tone === "warning" ? "bg-amber-400/15 text-amber-300" : tone === "ready" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.07] text-slate-300";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClass}`}><Icon size={16} /></span></div><div className="mt-3 text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}

function CalendarWorkspace({ year, month, setYear, setMonth, cells, selectedDate, setSelectedDate, selectedDayBookings, onSelectBooking, onCreate, matchdayBookings }) {
  const moveMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Calendar year {year}</div><h2 className="mt-1 text-xl font-black text-slate-950">{MONTHS[month]}</h2></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => moveMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={18} /></button><button type="button" onClick={() => { const now = new Date(); setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDate(normaliseDateKey(now)); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">Today</button><button type="button" onClick={() => moveMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={18} /></button></div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map((day) => <div key={day} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{day}</div>)}</div>
      <div className="grid grid-cols-7">{cells.map((cell) => <button type="button" key={cell.dateKey} onClick={() => setSelectedDate(cell.dateKey)} className={`min-h-[112px] border-b border-r border-slate-100 p-2 text-left align-top transition hover:bg-slate-50 ${!cell.inMonth ? "bg-slate-50/60 text-slate-400" : "bg-white"} ${selectedDate === cell.dateKey ? "ring-2 ring-inset ring-emerald-400" : ""}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${cell.today ? "bg-emerald-500 text-white" : "text-slate-700"}`}>{cell.date.getDate()}</span>{cell.bookings.length > 3 ? <span className="text-[10px] font-black text-slate-400">+{cell.bookings.length - 3}</span> : null}</div><div className="mt-2 space-y-1">{cell.bookings.slice(0, 3).map((booking) => <span key={booking.id} className={`block truncate rounded-md border px-1.5 py-1 text-[10px] font-black ${TYPE_TONES[booking.bookingType] || TYPE_TONES.meeting}`}>{booking.startTime} {booking.teamName || booking.title}</span>)}</div></button>)}</div>
    </section>
    <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Selected day</div><h3 className="mt-1 text-lg font-black text-slate-950">{formatDate(`${selectedDate}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })}</h3></div>{onCreate ? <button type="button" onClick={() => onCreate(selectedDate)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Plus size={18} /></button> : null}</div>
      <div className="mt-5 space-y-3">{selectedDayBookings.length ? selectedDayBookings.map((booking) => <BookingMiniCard key={booking.id} booking={booking} onClick={() => booking.sourceType === "matchday" ? null : onSelectBooking(booking)} readOnly={booking.sourceType === "matchday"} />) : <Empty icon={CalendarDays} title="No facility use planned" description="Add training, a friendly or another booking for this day." />}</div>
      {matchdayBookings.length ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-900"><ShieldCheck className="mb-2" size={18} />Ground Control fixtures are shown as protected facility bookings and are included in every conflict check.</div> : null}
    </aside>
  </div>;
}

function BookingsWorkspace({ bookings, query, setQuery, typeFilter, setTypeFilter, onSelect, onCreate }) {
  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Booking register</div><h2 className="mt-1 text-xl font-black text-slate-950">All training, friendlies and facility use</h2></div>{onCreate ? <button type="button" onClick={onCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={17} /> New booking</button> : null}</div>
    <div className="mt-5 flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team, opponent, pitch or reference" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-bold outline-none focus:border-emerald-400" /></label><label className="relative min-w-[220px]"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-black text-slate-700"><option value="all">All booking types</option>{ANNUAL_BOOKING_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="hidden grid-cols-[110px_90px_minmax(180px,1fr)_minmax(150px,0.8fr)_120px_44px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 lg:grid"><span>Date</span><span>Time</span><span>Booking</span><span>Pitch</span><span>Status</span><span /></div>{bookings.length ? bookings.map((booking) => <button key={booking.id} type="button" onClick={() => onSelect(booking)} className="grid w-full gap-2 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-slate-50 lg:grid-cols-[110px_90px_minmax(180px,1fr)_minmax(150px,0.8fr)_120px_44px] lg:items-center"><span className="text-xs font-black text-slate-600">{formatDate(booking.startAt, { day: "2-digit", month: "short", year: "2-digit" })}</span><span className="text-xs font-black text-slate-900">{booking.startTime}</span><span><span className="block text-sm font-black text-slate-950">{booking.title}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{booking.teamName || "Club-wide"}{booking.opponentName ? ` · v ${booking.opponentName}` : ""}</span></span><span className="text-xs font-bold text-slate-600">{booking.pitchName || "Facility TBC"}</span><StatusBadge status={booking.status} /><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><MoreHorizontal size={17} /></span></button>) : <Empty icon={Search} title="No bookings match" description="Change the filters or add a new booking." />}</div>
  </section>;
}

function RequestsWorkspace({ bookings, coachRequests = [], canOperate, saving, onSelect, onSelectCoachRequest, onApprove, onReject }) {
  const total = bookings.length + coachRequests.length;
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Approval queue</div>
        <h2 className="mt-1 text-xl font-black text-slate-950">Facility requests awaiting a decision</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Coach Hub requests and administrator-created provisional bookings share one queue.</p>
      </div>
      <div className="mt-6 space-y-3">
        {coachRequests.map((request) => (
          <button key={`coach-${request.id}`} type="button" onClick={() => onSelectCoachRequest?.(request)} className="flex w-full flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-emerald-950">{request.title}</span><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">Coach Hub</span></div>
              <div className="mt-1 text-xs font-bold text-emerald-900/70">{request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime} · {request.preferredPitchName || "Pitch requested"}</div>
              <div className="mt-1 text-xs font-semibold text-emerald-900/70">{request.teamName} · {requestStatusLabel(request.status)}</div>
            </div>
            {canOperate ? <span className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white">Review request</span> : null}
          </button>
        ))}
        {bookings.map((booking) => (
          <div key={booking.id} className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <button type="button" onClick={() => onSelect(booking)} className="min-w-0 text-left">
              <div className="text-sm font-black text-amber-950">{booking.title}</div>
              <div className="mt-1 text-xs font-bold text-amber-900/70">{formatDate(booking.startAt)} · {booking.startTime}–{booking.endTime} · {booking.pitchName || "Pitch TBC"}</div>
              <div className="mt-1 text-xs font-semibold text-amber-900/70">{booking.teamName || "Club-wide request"}</div>
            </button>
            {canOperate ? <div className="flex gap-2"><button disabled={saving} type="button" onClick={() => onReject(booking)} className="h-10 rounded-xl border border-amber-300 bg-white px-4 text-xs font-black text-amber-900">Reject</button><button disabled={saving} type="button" onClick={() => onApprove(booking)} className="h-10 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white">Approve</button></div> : null}
          </div>
        ))}
        {!total ? <Empty icon={CheckCircle2} title="Request queue clear" description="No teams are waiting for pitch-booking approval." /> : null}
      </div>
    </section>
  );
}

function AvailabilityWorkspace({ blackouts, pitchCfg, canOperate, canManage, onCreate, settings }) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Protected availability</div><h2 className="mt-1 text-xl font-black text-slate-950">Blackouts and unavailable periods</h2><p className="mt-2 text-sm font-semibold text-slate-500">Block maintenance, external hires, council closures and seasonal shutdowns.</p></div>{canOperate ? <button type="button" onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={17} /> Add blackout</button> : null}</div><div className="mt-6 space-y-3">{blackouts.length ? blackouts.map((blackout) => <div key={blackout.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm"><Ban size={18} /></span><div><div className="text-sm font-black text-rose-950">{blackout.title}</div><div className="mt-1 text-xs font-bold text-rose-900/70">{formatDate(blackout.startAt)} to {formatDate(blackout.endAt)}</div><div className="mt-1 text-xs font-semibold text-rose-900/70">{pitchCfg.find((pitch) => pitch.id === blackout.pitchId)?.label || (blackout.pitchId ? blackout.pitchId : "All relevant facilities")}</div>{blackout.reason ? <div className="mt-2 text-xs font-semibold leading-5 text-rose-900/80">{blackout.reason}</div> : null}</div></div></div>) : <Empty icon={Ban} title="No annual blackouts" description="Existing matchday pitch closures remain separate and continue to protect each fixture day." />}</div></section><aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Settings2 size={20} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Planner policy</div><h3 className="text-lg font-black text-slate-950">Booking defaults</h3></div></div><dl className="mt-5 space-y-3"><Policy label="Default status" value={settings.default_status || "Provisional"} /><Policy label="Training duration" value={`${settings.default_training_duration_minutes || 90} minutes`} /><Policy label="Friendly duration" value={`${settings.default_friendly_duration_minutes || 150} minutes`} /><Policy label="Approval required" value={settings.require_approval ? "Yes" : "No"} /><Policy label="Cost visibility" value={settings.show_costs_to_schedulers === false ? "Owners/admins" : "Schedulers"} /></dl>{canManage ? <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-bold leading-5 text-sky-900">Detailed planner policy controls are stored securely and can be expanded during the controlled pilot without changing the booking model.</div> : null}</aside></div>;
}

function BookingMiniCard({ booking, onClick, readOnly }) {
  return <button type="button" disabled={readOnly} onClick={onClick} className={`w-full rounded-2xl border p-4 text-left ${TYPE_TONES[booking.bookingType] || TYPE_TONES.meeting} ${readOnly ? "cursor-default" : "hover:shadow-sm"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-black uppercase tracking-wide opacity-70">{booking.startTime}–{booking.endTime}</div><div className="mt-1 truncate text-sm font-black">{booking.title}</div><div className="mt-1 text-xs font-semibold opacity-80">{booking.pitchName || "Pitch TBC"}{booking.teamName ? ` · ${booking.teamName}` : ""}</div></div>{readOnly ? <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-black uppercase">Matchday</span> : <StatusBadge status={booking.status} />}</div></button>;
}

function BookingDrawer({ booking, canOperate, canApprove, canViewCosts, saving, onClose, onEdit, onApprove, onDelete }) {
  if (!booking) return null;
  return <div className="fixed inset-0 z-[220] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Annual planner booking</div><h2 className="mt-1 text-xl font-black text-slate-950">{booking.title}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button></div><div className="space-y-5 p-5"><div className={`rounded-2xl border p-4 ${TYPE_TONES[booking.bookingType] || TYPE_TONES.meeting}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide">{ANNUAL_BOOKING_TYPES.find((type) => type.value === booking.bookingType)?.label || booking.bookingType}</span><StatusBadge status={booking.status} /></div><div className="mt-4 text-lg font-black">{formatDate(booking.startAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div><div className="mt-1 text-sm font-bold">{booking.startTime}–{booking.endTime}</div></div><Detail icon={Users} label="Team" value={booking.teamName || "Club-wide booking"} /><Detail icon={MapPin} label="Facility" value={[booking.venueName, booking.pitchName].filter(Boolean).join(" · ") || "To be allocated"} />{booking.opponentName ? <Detail icon={Sparkles} label="Opponent" value={booking.opponentName} /> : null}{canViewCosts ? <Detail icon={PoundSterling} label="Planned cost" value={money(booking.costPence)} /> : null}{booking.contactName || booking.contactEmail ? <Detail icon={Users} label="Booking contact" value={[booking.contactName, booking.contactEmail].filter(Boolean).join(" · ")} /> : null}{booking.bookingReference || booking.supplierReference ? <Detail icon={FileSpreadsheet} label="References" value={[booking.bookingReference, booking.supplierReference].filter(Boolean).join(" · ")} /> : null}{booking.notes ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">{booking.notes}</div> : null}{canOperate ? <div className="grid gap-2 sm:grid-cols-2"><button disabled={saving} type="button" onClick={() => onEdit(booking)} className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700">Edit booking</button>{booking.status === "requested" && canApprove ? <button disabled={saving} type="button" onClick={() => onApprove?.(booking)} className="h-11 rounded-xl bg-emerald-600 text-sm font-black text-white">Approve request</button> : <button disabled={saving} type="button" onClick={() => onDelete(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700"><Trash2 size={16} /> Remove</button>}</div> : null}</div></aside></div>;
}

function BookingEditor({ draft, setDraft, saving, pitchCfg, teamCfg, bookings, blackouts, matchdayBookings, canViewCosts, approvalRequired, canManage, onSave }) {
  const [localError, setLocalError] = useState("");
  if (!draft) return null;
  const occurrences = expandRecurringBookingDraft(draft);
  const conflicts = occurrences.flatMap((occurrence) => detectAnnualPlannerConflicts(occurrence, { bookings, blackouts, matchdayBookings, ignoreId: draft.id || "" }));
  const suggestions = conflicts.length ? findAnnualPlannerSuggestions(occurrences[0] || draft, { bookings, blackouts, matchdayBookings, pitches: pitchCfg }, { limit: 3 }) : [];
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const selectedPitch = pitchCfg.find((pitch) => String(pitch.id) === String(draft.pitchId));
  const submit = async () => {
    setLocalError("");
    if (!draft.title?.trim()) return setLocalError("Enter a clear booking title.");
    if (!draft.pitchId) return setLocalError("Choose a pitch before saving.");
    if (conflicts.length) return setLocalError(conflicts[0].message);
    try { await onSave({ ...draft, pitchName: selectedPitch?.label || draft.pitchName, venueId: selectedPitch?.siteId || draft.venueId, venueName: selectedPitch?.siteLabel || draft.venueName }); } catch (error) { setLocalError(error?.message || "The booking could not be saved."); }
  };
  return <div className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDraft(null); }}><section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl"><div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{draft.id ? "Edit annual booking" : "New annual booking"}</div><h2 className="mt-1 text-xl font-black text-slate-950">Plan facility use</h2></div><button disabled={saving} type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button></div><div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_310px]"><div className="grid gap-4 sm:grid-cols-2"><Field label="Booking title" wide><input value={draft.title || ""} onChange={(e) => set("title", e.target.value)} className="input" /></Field><Field label="Type"><select value={draft.bookingType || "training"} onChange={(e) => set("bookingType", e.target.value)} className="input">{ANNUAL_BOOKING_TYPES.filter((type) => type.value !== "match").map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field><Field label="Status"><select disabled={approvalRequired && !canManage} value={approvalRequired && !canManage ? "requested" : draft.status || "provisional"} onChange={(e) => set("status", e.target.value)} className="input disabled:bg-slate-100 disabled:text-slate-500">{(approvalRequired && !canManage ? ANNUAL_BOOKING_STATUSES.filter((status) => status.value === "requested") : ANNUAL_BOOKING_STATUSES.filter((status) => !["cancelled", "rejected"].includes(status.value))).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>{approvalRequired && !canManage ? <span className="mt-1 block text-[11px] font-semibold text-amber-700">Changes are submitted for owner or administrator approval.</span> : null}</Field><Field label="Team"><select value={draft.teamKey || ""} onChange={(e) => { const team = teamCfg.find((row) => String(row.id || row.name) === e.target.value); setDraft((current) => ({ ...current, teamKey: e.target.value, teamName: team?.name || "" })); }} className="input"><option value="">Club-wide / no team</option>{teamCfg.map((team) => <option key={team.id || team.name} value={team.id || team.name}>{team.name}</option>)}</select></Field>{draft.bookingType === "friendly" ? <Field label="Opponent"><input value={draft.opponentName || ""} onChange={(e) => set("opponentName", e.target.value)} className="input" placeholder="Visiting club or internal team" /></Field> : null}<Field label="Pitch"><select value={draft.pitchId || ""} onChange={(e) => { const pitch = pitchCfg.find((row) => String(row.id) === e.target.value); setDraft((current) => ({ ...current, pitchId: e.target.value, pitchName: pitch?.label || pitch?.name || "", venueId: pitch?.siteId || current.venueId || "", venueName: pitch?.siteLabel || pitch?.venueName || current.venueName || "" })); }} className="input"><option value="">Choose pitch</option>{pitchCfg.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.id}</option>)}</select></Field><Field label="Date"><input type="date" value={draft.startDate || ""} onChange={(e) => set("startDate", e.target.value)} className="input" /></Field><Field label="Starts"><input type="time" step="900" value={normaliseTime(draft.startTime)} onChange={(e) => set("startTime", e.target.value)} className="input" /></Field><Field label="Finishes"><input type="time" step="900" value={normaliseTime(draft.endTime, "19:30")} onChange={(e) => set("endTime", e.target.value)} className="input" /></Field>{!draft.id ? <><Field label="Repeats"><select value={draft.recurrence || "none"} onChange={(e) => set("recurrence", e.target.value)} className="input">{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>{draft.recurrence !== "none" ? <Field label="Repeat until"><input type="date" value={draft.recurrenceUntil || draft.startDate || ""} min={draft.startDate || ""} onChange={(e) => set("recurrenceUntil", e.target.value)} className="input" /></Field> : null}</> : null}{canViewCosts ? <Field label="Cost (£)"><input type="number" min="0" step="0.01" value={(Number(draft.costPence || 0) / 100).toFixed(2)} onChange={(e) => set("costPence", Math.round(Number(e.target.value || 0) * 100))} className="input" /></Field> : null}<Field label="Booking reference"><input value={draft.bookingReference || ""} onChange={(e) => set("bookingReference", e.target.value)} className="input" /></Field>{canViewCosts ? <Field label="Supplier reference"><input value={draft.supplierReference || ""} onChange={(e) => set("supplierReference", e.target.value)} className="input" /></Field> : null}<Field label="Contact name"><input value={draft.contactName || ""} onChange={(e) => set("contactName", e.target.value)} className="input" /></Field><Field label="Contact email"><input type="email" value={draft.contactEmail || ""} onChange={(e) => set("contactEmail", e.target.value)} className="input" /></Field><Field label="Notes" wide><textarea value={draft.notes || ""} onChange={(e) => set("notes", e.target.value)} rows="4" className="input min-h-[110px] py-3" /></Field></div><aside className="space-y-4"><div className={`rounded-2xl border p-4 ${conflicts.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center gap-2 text-sm font-black">{conflicts.length ? <AlertTriangle className="text-rose-600" size={18} /> : <CheckCircle2 className="text-emerald-600" size={18} />}{conflicts.length ? "Conflict found" : "Booking can be saved"}</div><p className="mt-2 text-xs font-semibold leading-5 opacity-80">{conflicts.length ? conflicts[0].message : `${occurrences.length || 1} occurrence${occurrences.length === 1 ? "" : "s"} checked against training, friendlies, blackouts and current matchdays.`}</p></div>{suggestions.length ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-sky-800">Available alternatives</div><div className="mt-3 space-y-2">{suggestions.map((suggestion) => <button key={`${suggestion.startDate}-${suggestion.startTime}-${suggestion.pitchId}`} type="button" onClick={() => setDraft((current) => ({ ...current, startDate: suggestion.startDate, startTime: suggestion.startTime, endTime: suggestion.endTime, pitchId: suggestion.pitchId }))} className="w-full rounded-xl bg-white p-3 text-left text-xs font-bold text-sky-950 shadow-sm"><span className="block font-black">{formatDate(`${suggestion.startDate}T12:00:00`, { weekday: "short", day: "numeric", month: "short" })} · {suggestion.startTime}</span><span className="mt-1 block text-sky-700">{suggestion.pitchName || suggestion.pitchId}</span></button>)}</div></div> : null}<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-500">Series preview</div><div className="mt-2 text-2xl font-black text-slate-950">{occurrences.length || 0}</div><div className="text-xs font-semibold text-slate-500">bookings will be created</div></div></aside></div>{localError ? <div className="mx-5 mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900 sm:mx-6">{localError}</div> : null}<div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6"><button disabled={saving} type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button disabled={saving || conflicts.length > 0} type="button" onClick={submit} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : draft.id ? "Save changes" : occurrences.length > 1 ? `Create ${occurrences.length} bookings` : "Add booking"}</button></div></section></div>;
}

function BlackoutEditor({ draft, setDraft, pitchCfg, saving, onSave }) {
  const [error, setError] = useState("");
  if (!draft) return null;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-[235] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:items-center sm:p-6"><section className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Facility protection</div><h2 className="mt-1 text-xl font-black">Add unavailable period</h2></div><button type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Title" wide><input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} /></Field><Field label="Pitch"><select className="input" value={draft.pitchId} onChange={(e) => set("pitchId", e.target.value)}><option value="">All relevant pitches</option>{pitchCfg.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.id}</option>)}</select></Field><Field label="Start date"><input type="date" className="input" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field><Field label="Start time"><input type="time" className="input" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field><Field label="End date"><input type="date" className="input" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field><Field label="End time"><input type="time" className="input" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field><Field label="Reason" wide><textarea className="input min-h-[100px] py-3" value={draft.reason} onChange={(e) => set("reason", e.target.value)} /></Field></div>{error ? <div className="mx-5 mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</div> : null}<div className="flex justify-end gap-2 border-t border-slate-200 p-5"><button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button><button disabled={saving} type="button" onClick={async () => { setError(""); try { await onSave(draft); } catch (saveError) { setError(saveError?.message || "Could not save blackout."); } }} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">Save blackout</button></div></section></div>;
}

function StatusBadge({ status }) {
  const tones = { confirmed: "bg-emerald-100 text-emerald-800", provisional: "bg-sky-100 text-sky-800", requested: "bg-amber-100 text-amber-800", cancelled: "bg-slate-100 text-slate-600", rejected: "bg-rose-100 text-rose-700" };
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tones[status] || tones.provisional}`}>{status || "provisional"}</span>;
}

function Detail({ icon: Icon, label, value }) { return <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon size={18} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-1 text-sm font-black text-slate-950">{value}</div></div></div>; }
function Policy({ label, value }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="text-right text-xs font-black text-slate-900">{value}</dd></div>; }
function Field({ label, children, wide = false }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>; }
function Empty({ icon: Icon, title, description }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Icon className="mx-auto text-slate-400" size={24} /><div className="mt-3 text-sm font-black text-slate-800">{title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</div></div>; }
function PlannerLoading() { return <div className="space-y-4"><div className="h-64 animate-pulse rounded-[32px] bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div></div>; }
