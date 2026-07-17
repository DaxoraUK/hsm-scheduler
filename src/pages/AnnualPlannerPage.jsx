import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarDays,
  CalendarRange,
  CloudRain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  ListChecks,
  MapPin,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  PoundSterling,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Snowflake,
  UserCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import DaxoraConfirmDialog from "../components/system/DaxoraConfirmDialog.jsx";
import DaxoraSectionErrorBoundary from "../components/system/DaxoraSectionErrorBoundary.jsx";
import CoachRequestReviewDialog from "../components/coach/CoachRequestReviewDialog.jsx";
import CoachRequestConversation from "../components/coach/CoachRequestConversation.jsx";
import WinterSiteWorkspace from "../components/planning/WinterSiteWorkspace.jsx";
import SmartTrainingAllocationWorkspace from "../components/planning/SmartTrainingAllocationWorkspace.jsx";
import WeatherDisruptionDialog from "../components/planning/WeatherDisruptionDialog.jsx";
import AnnualPlannerAnalyticsSummary from "../components/analytics/AnnualPlannerAnalyticsSummary.jsx";
import { DB, isSupaConfigured } from "../lib/supabase.js";
import {
  ANNUAL_BOOKING_STATUSES,
  ANNUAL_BOOKING_TYPES,
  FULL_PITCH_AREA_ID,
  FULL_PITCH_AREA_LABEL,
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
  pitchAreaOptions,
} from "../lib/planning/annualPlannerEngine.js";
import { normaliseCoachRequest, requestStatusLabel } from "../lib/coach/coachHubEngine.js";
import { buildAnnualPlannerAnalyticsModel } from "../lib/analytics/annualPlannerAnalyticsEngine.js";
import { allocationItemToPayload, allocationRunToPayload, trainingPreferenceToPayload } from "../lib/planning/smartTrainingAllocationEngine.js";
import { calendarEventTone, COACH_CALENDAR_LEGEND, eventOccursOnDate, normaliseCoachPitchClosure } from "../lib/coach/sharedCalendarEngine.js";
import {
  buildPilotRefinementSnapshot,
  buildCoachCommunicationAudience,
} from "../lib/coach/coachHubPilotEngine.js";
import { buildAnnualPlannerCoachAudience } from "../lib/communications/coachAudience.js";

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
    pitchAreaId: "",
    pitchAreaName: "",
    seasonPhase: "regular",
    siteInventoryId: "",
    siteSlotId: "",
    startDate: date,
    startTime: "18:00",
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    recurrence: "none",
    recurrenceUntil: date,
    exceptionDates: [],
    exceptionDatesText: "",
    holidayPolicy: "include",
    costPence: 0,
    financeStatus: "unreconciled",
    financeReference: "",
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
  onOpenCoachAudience,
}) {
  const clubId = club.id || "";
  const canOperate = Boolean(workspaceAccess.canOperate);
  const canManage = Boolean(workspaceAccess.canManageSettings || workspaceAccess.role === "owner" || workspaceAccess.role === "admin");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tab, setTab] = useState("calendar");
  const [workspace, setWorkspace] = useState({ settings: {}, bookings: [], blackouts: [], pitchClosures: [], closureImpacts: [], winterSites: [], winterSlots: [], allocationPreferences: [], allocationRuns: [], allocationItems: [] });
  const [coachRequests, setCoachRequests] = useState([]);
  const [pilotWorkspace, setPilotWorkspace] = useState({ people: [], assignments: [], invitations: [], requests: [], messages: [], reminders: [], bookings: [], unavailable: false });
  const [coachReview, setCoachReview] = useState(null);
  const [conversationRequest, setConversationRequest] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(normaliseDateKey(today));
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editor, setEditor] = useState(null);
  const [blackoutEditor, setBlackoutEditor] = useState(null);
  const [weatherBooking, setWeatherBooking] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const refreshInFlight = useRef(false);
  const requestRefreshInFlight = useRef(false);
  const requestFingerprintRef = useRef("");
  const approvalRequired = Boolean(workspace.settings?.require_approval ?? workspace.settings?.requireApproval);
  const canViewCosts = canManage || (workspace.settings?.show_costs_to_schedulers ?? workspace.settings?.showCostsToSchedulers ?? true) !== false;

  const matchdayBookings = useMemo(() => [
    ...satFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: satDate, pitchCfg })).filter(Boolean),
    ...sunFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: sunDate, pitchCfg })).filter(Boolean),
    ...(midweekEnabled ? midweekFinal.map((fixture) => matchdayFixtureToAnnualBooking(fixture, { date: midweekDate, pitchCfg })).filter(Boolean) : []),
  ], [midweekDate, midweekEnabled, midweekFinal, pitchCfg, satDate, satFinal, sunDate, sunFinal]);

  const loadWorkspace = useCallback(async ({ quiet = false } = {}) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (!quiet) setStatus("loading");
    else setRefreshing(true);
    if (!quiet) setError("");
    try {
      let result;
      let coachPayload = { requests: [] };
      let pilotPayload = { people: [], assignments: [], invitations: [], requests: [], messages: [], reminders: [], bookings: [] };
      let pitchClosurePayload = [];
      let closureImpactPayload = [];
      if (isSupaConfigured() && clubId) {
        [result, coachPayload, pilotPayload, pitchClosurePayload, closureImpactPayload] = await Promise.all([
          DB.listAnnualPlannerWorkspace(clubId, dateRangeForYear(year)),
          canOperate ? DB.listCoachHubRequestQueue(clubId) : Promise.resolve({ requests: [] }),
          canOperate ? DB.listCoachHubPilotMetrics(clubId, dateRangeForYear(year)) : Promise.resolve({ people: [], assignments: [], invitations: [], requests: [], messages: [], reminders: [], bookings: [] }),
          DB.loadPitchClosures(clubId),
          canOperate ? DB.listAnnualPlannerClosureImpacts(clubId, dateRangeForYear(year)) : Promise.resolve([]),
        ]);
      } else {
        result = readLocalWorkspace(clubId);
        pitchClosurePayload = Array.isArray(result?.pitchClosures) ? result.pitchClosures : [];
        closureImpactPayload = Array.isArray(result?.closureImpacts) ? result.closureImpacts : [];
      }
      setWorkspace({
        settings: result?.settings || {},
        bookings: Array.isArray(result?.bookings) ? result.bookings.map(normaliseAnnualBooking) : [],
        blackouts: Array.isArray(result?.blackouts) ? result.blackouts.map(normaliseAnnualBlackout) : [],
        pitchClosures: Array.isArray(pitchClosurePayload) ? pitchClosurePayload.map(normaliseCoachPitchClosure) : [],
        closureImpacts: Array.isArray(closureImpactPayload) ? closureImpactPayload : [],
        winterSites: Array.isArray(result?.winter_sites || result?.winterSites) ? (result.winter_sites || result.winterSites) : [],
        winterSlots: Array.isArray(result?.winter_slots || result?.winterSlots) ? (result.winter_slots || result.winterSlots) : [],
        allocationPreferences: Array.isArray(result?.allocation_preferences || result?.allocationPreferences) ? (result.allocation_preferences || result.allocationPreferences) : [],
        allocationRuns: Array.isArray(result?.allocation_runs || result?.allocationRuns) ? (result.allocation_runs || result.allocationRuns) : [],
        allocationItems: Array.isArray(result?.allocation_items || result?.allocationItems) ? (result.allocation_items || result.allocationItems) : [],
      });
      setCoachRequests(
        (Array.isArray(coachPayload?.requests) ? coachPayload.requests : [])
          .map(normaliseCoachRequest)
          .filter((request) => ["submitted", "needs_information", "alternative_offered"].includes(request.status)),
      );
      setPilotWorkspace({
        people: Array.isArray(pilotPayload?.people) ? pilotPayload.people : [],
        assignments: Array.isArray(pilotPayload?.assignments) ? pilotPayload.assignments : [],
        invitations: Array.isArray(pilotPayload?.invitations) ? pilotPayload.invitations : [],
        requests: Array.isArray(pilotPayload?.requests) ? pilotPayload.requests : [],
        messages: Array.isArray(pilotPayload?.messages) ? pilotPayload.messages : [],
        reminders: Array.isArray(pilotPayload?.reminders) ? pilotPayload.reminders : [],
        bookings: Array.isArray(pilotPayload?.bookings) ? pilotPayload.bookings.map(normaliseAnnualBooking) : [],
        unavailable: Boolean(pilotPayload?.unavailable),
      });
      setStatus("ready");
      setLastRefreshedAt(new Date());
    } catch (loadError) {
      if (!quiet) {
        setError(loadError?.message || "The annual planner could not be loaded.");
        setStatus("error");
      }
    } finally {
      refreshInFlight.current = false;
      if (quiet) setRefreshing(false);
    }
  }, [canOperate, clubId, year]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const refreshRequestQueueQuietly = useCallback(async () => {
    if (!canOperate || !clubId || !isSupaConfigured() || requestRefreshInFlight.current) return;
    requestRefreshInFlight.current = true;
    const preservedScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    try {
      const coachPayload = await DB.listCoachHubRequestQueue(clubId);
      const nextRequests = (Array.isArray(coachPayload?.requests) ? coachPayload.requests : [])
        .map(normaliseCoachRequest)
        .filter((request) => ["submitted", "needs_information", "alternative_offered"].includes(request.status));
      const nextFingerprint = JSON.stringify(nextRequests.map((request) => [
        request.id, request.status, request.updatedAt, request.preferredStartAt, request.preferredEndAt,
        request.preferredPitchId, request.preferredPitchAreaId, request.proposedStartAt, request.proposedPitchId,
      ]));
      if (nextFingerprint !== requestFingerprintRef.current) {
        requestFingerprintRef.current = nextFingerprint;
        setCoachRequests(nextRequests);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => window.scrollTo({ top: preservedScrollY, left: 0, behavior: "auto" }));
        });
      }
      setLastRefreshedAt(new Date());
    } catch {
      // Background refresh failures remain silent; manual Refresh still provides a visible retry path.
    } finally {
      requestRefreshInFlight.current = false;
    }
  }, [canOperate, clubId]);

  useEffect(() => {
    requestFingerprintRef.current = JSON.stringify(coachRequests.map((request) => [
      request.id, request.status, request.updatedAt, request.preferredStartAt, request.preferredEndAt,
      request.preferredPitchId, request.preferredPitchAreaId, request.proposedStartAt, request.proposedPitchId,
    ]));
  }, [coachRequests]);

  useEffect(() => {
    const refresh = (event) => {
      const changedClubId = String(event?.detail?.clubId || "");
      if (changedClubId && changedClubId !== String(clubId)) return;
      if (tab === "requests") refreshRequestQueueQuietly();
      else loadWorkspace({ quiet: true });
    };
    window.addEventListener("daxora-annual-planner-updated", refresh);
    return () => window.removeEventListener("daxora-annual-planner-updated", refresh);
  }, [clubId, loadWorkspace, refreshRequestQueueQuietly, tab]);

  useEffect(() => {
    if (tab !== "requests" || status !== "ready") return undefined;
    const shadowRefresh = () => {
      if (document.visibilityState === "visible") refreshRequestQueueQuietly();
    };
    const interval = window.setInterval(shadowRefresh, 6000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") shadowRefresh();
    };
    window.addEventListener("focus", shadowRefresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", shadowRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshRequestQueueQuietly, status, tab]);

  const snapshot = useMemo(() => buildAnnualPlannerSnapshot({ bookings: workspace.bookings, blackouts: workspace.blackouts, year }), [workspace, year]);
  const coachRequestCalendarBookings = useMemo(() => coachRequests.map((request) => normaliseAnnualBooking({
    id: `coach-request-${request.id}`,
    title: request.title,
    bookingType: request.requestType === "friendly" ? "friendly" : "training",
    status: "requested",
    teamKey: request.teamKey,
    teamName: request.teamName,
    venueId: request.preferredVenueId,
    venueName: request.preferredVenueName,
    pitchId: request.preferredPitchId,
    pitchName: request.preferredPitchName,
    pitchAreaId: request.preferredPitchAreaId,
    pitchAreaName: request.preferredPitchAreaName,
    startAt: request.preferredStartAt,
    endAt: request.preferredEndAt,
    sourceType: "coach_request",
    sourceId: request.id,
  })), [coachRequests]);
  const allCalendarBookings = useMemo(() => [
    ...snapshot.bookings,
    ...matchdayBookings.filter((booking) => Number(booking.startDate.slice(0, 4)) === year),
    ...coachRequestCalendarBookings.filter((booking) => Number(booking.startDate.slice(0, 4)) === year),
  ], [coachRequestCalendarBookings, matchdayBookings, snapshot.bookings, year]);
  const calendarClosures = useMemo(() => [
    ...workspace.blackouts.map((blackout) => ({
      ...blackout,
      kind: "blackout",
      pitchName: blackout.pitchName || pitchCfg.find((pitch) => pitch.id === blackout.pitchId)?.label || blackout.pitchId,
    })),
    ...workspace.pitchClosures,
  ], [pitchCfg, workspace.blackouts, workspace.pitchClosures]);
  const calendar = useMemo(() => buildMonthCalendar(year, month, allCalendarBookings).map((cell) => ({
    ...cell,
    closures: calendarClosures.filter((closure) => eventOccursOnDate(closure, cell.dateKey)),
  })), [allCalendarBookings, calendarClosures, month, year]);
  const selectedDayBookings = useMemo(() => allCalendarBookings.filter((booking) => booking.startDate === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [allCalendarBookings, selectedDate]);
  const selectedDayClosures = useMemo(() => calendarClosures.filter((closure) => eventOccursOnDate(closure, selectedDate)), [calendarClosures, selectedDate]);
  const filteredBookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.bookings
      .filter((booking) => typeFilter === "all" || booking.bookingType === typeFilter)
      .filter((booking) => !needle || [booking.title, booking.teamName, booking.opponentName, booking.pitchName, booking.venueName, booking.bookingReference].join(" ").toLowerCase().includes(needle))
      .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  }, [query, snapshot.bookings, typeFilter]);
  const requestQueue = useMemo(() => snapshot.bookings.filter((booking) => booking.status === "requested"), [snapshot.bookings]);
  const totalRequests = requestQueue.length + coachRequests.length;
  const pilotSnapshot = useMemo(() => buildPilotRefinementSnapshot({
    workspace: { ...pilotWorkspace, bookings: workspace.bookings },
    pitches: pitchCfg,
    rangeStart: `${year}-01-01`,
    rangeEnd: `${year + 1}-01-01`,
  }), [pilotWorkspace, pitchCfg, workspace.bookings, year]);
  const annualAnalytics = useMemo(() => buildAnnualPlannerAnalyticsModel({
    bookings: workspace.bookings,
    blackouts: workspace.blackouts,
    winterSites: workspace.winterSites,
    winterSlots: workspace.winterSlots,
    requests: coachRequests,
  }, { year }), [coachRequests, workspace.blackouts, workspace.bookings, workspace.winterSites, workspace.winterSlots, year]);

  const openCoachAudience = useCallback(({ reason, bookingIds = [], blackoutIds = [], teamKeys = [] } = {}) => {
    const audience = buildAnnualPlannerCoachAudience({
      reason,
      bookings: workspace.bookings,
      blackouts: workspace.blackouts,
      selectedBookingIds: bookingIds,
      selectedBlackoutIds: blackoutIds,
      teamKeys,
    });
    const enriched = buildCoachCommunicationAudience({
      people: pilotWorkspace.people,
      assignments: pilotWorkspace.assignments,
      teamKeys: audience.teamKeys,
      reason: audience.reason,
    });
    onOpenCoachAudience?.({ ...audience, ...enriched, teamKeys: audience.teamKeys });
    if (!onOpenCoachAudience) {
      toast.info("Coach audience prepared", { description: `${enriched.readyCount} connected coach contact${enriched.readyCount === 1 ? "" : "s"} identified.` });
    }
  }, [onOpenCoachAudience, pilotWorkspace.assignments, pilotWorkspace.people, workspace.blackouts, workspace.bookings]);

  function openCoachReview(request) {
    const candidate = normaliseAnnualBooking({
      id: `coach-request-${request.id}`,
      title: request.title, bookingType: request.requestType === "friendly" ? "friendly" : "training", status: "requested",
      teamKey: request.teamKey, teamName: request.teamName, venueId: request.preferredVenueId, venueName: request.preferredVenueName,
      pitchId: request.preferredPitchId, pitchName: request.preferredPitchName, startAt: request.preferredStartAt, endAt: request.preferredEndAt,
    });
    const suggestions = findAnnualPlannerSuggestions(candidate, {
      bookings: workspace.bookings, blackouts: workspace.blackouts, matchdayBookings, pitches: pitchCfg,
    }, { limit: 4 });
    setCoachReview({ ...request, suggestions });
  }

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

    if (effectiveDraft.id && effectiveDraft.seriesId && effectiveDraft.applyToSeries) {
      const seriesRows = workspace.bookings
        .filter((row) => row.seriesId === effectiveDraft.seriesId && row.startDate >= effectiveDraft.startDate && !["cancelled", "rejected"].includes(row.status))
        .sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`))
        .map((row) => ({
          ...row,
          title: effectiveDraft.title, bookingType: effectiveDraft.bookingType, status: effectiveDraft.status,
          teamKey: effectiveDraft.teamKey, teamName: effectiveDraft.teamName, opponentName: effectiveDraft.opponentName,
          venueId: effectiveDraft.venueId, venueName: effectiveDraft.venueName, pitchId: effectiveDraft.pitchId, pitchName: effectiveDraft.pitchName,
          pitchAreaId: effectiveDraft.pitchAreaId, pitchAreaName: effectiveDraft.pitchAreaName,
          seasonPhase: effectiveDraft.seasonPhase, siteInventoryId: effectiveDraft.siteInventoryId, siteSlotId: effectiveDraft.siteSlotId,
          startTime: effectiveDraft.startTime, endTime: effectiveDraft.endTime, recurrence: "none", recurrenceUntil: row.startDate,
          costPence: effectiveDraft.costPence, supplierReference: effectiveDraft.supplierReference, bookingReference: effectiveDraft.bookingReference,
          contactName: effectiveDraft.contactName, contactEmail: effectiveDraft.contactEmail, notes: effectiveDraft.notes,
          holidayPolicy: effectiveDraft.holidayPolicy, exceptionDates: effectiveDraft.exceptionDates || [],
        }));
      if (!seriesRows.length) throw new Error("No remaining bookings were found in this series.");
      if (isSupaConfigured() && clubId) {
        await DB.saveAnnualPlannerBookingSeries(clubId, seriesRows.map(annualBookingToPayload));
      } else {
        const ids = new Set(seriesRows.map((row) => row.id));
        const current = readLocalWorkspace(clubId);
        const replacements = new Map(seriesRows.map((row) => [row.id, normaliseAnnualBooking(row)]));
        const next = (current.bookings || []).map(normaliseAnnualBooking).map((row) => ids.has(row.id) ? replacements.get(row.id) : row);
        writeLocalWorkspace(clubId, { ...current, settings: workspace.settings, bookings: next, blackouts: workspace.blackouts });
      }
      return;
    }

    const occurrences = expandRecurringBookingDraft(effectiveDraft);
    if (!occurrences.length) throw new Error("Choose a valid booking date and time.");
    const accepted = [];
    for (const occurrence of occurrences) {
      const conflicts = detectAnnualPlannerConflicts(occurrence, {
        bookings: [...workspace.bookings, ...accepted],
        blackouts: workspace.blackouts,
        matchdayBookings,
        pitches: pitchCfg,
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
        description: draft.applyToSeries ? "The remaining recurring series has been updated together." : draft.recurrence && draft.recurrence !== "none" ? "The complete recurring series has been checked for conflicts." : `${draft.startDate} · ${draft.startTime}`,
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
      closure_type: draft.closureType || "blackout",
      visibility: draft.visibility || "club",
      public_note: draft.publicNote || draft.reason || null,
      internal_note: draft.internalNote || null,
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

  async function resolveClosureImpact(impact, statusValue) {
    if (!impact?.id) return;
    setSaving(true);
    try {
      await DB.resolveAnnualPlannerClosureImpact(clubId, impact.id, {
        status: statusValue,
        note: statusValue === "relocated" ? "Booking relocated by a club operator." : statusValue === "cancelled" ? "Affected booking cancelled by a club operator." : "Closure impact reviewed by a club operator.",
      });
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(statusValue === "relocated" ? "Closure impact marked as relocated" : statusValue === "cancelled" ? "Closure impact marked as cancelled" : "Closure impact resolved");
    } catch (impactError) {
      toast.error("Closure impact could not be updated", { description: impactError?.message });
    } finally {
      setSaving(false);
    }
  }

  async function saveWinterSite(site) {
    setSaving(true);
    try {
      await DB.saveAnnualPlannerWinterSite(clubId, site);
      await loadWorkspace({ quiet: true });
      toast.success(site.id ? "Winter site updated" : "Winter site added");
    } finally { setSaving(false); }
  }

  async function performDeleteWinterSite(site) {
    setSaving(true);
    try {
      await DB.deleteAnnualPlannerWinterSite(clubId, site.id);
      await loadWorkspace({ quiet: true });
      toast.success("Winter site removed");
    } finally { setSaving(false); setConfirmRequest(null); }
  }

  function deleteWinterSite(site) {
    setConfirmRequest({
      tone: "danger",
      title: "Remove winter site?",
      description: `${site.name || "This winter site"} and its fixed slots will be removed from the seasonal inventory.`,
      confirmLabel: "Remove winter site",
      cancelLabel: "Keep winter site",
      action: "delete_winter_site",
      site,
    });
  }

  async function saveWinterSlot(slot) {
    setSaving(true);
    try {
      await DB.saveAnnualPlannerWinterSlot(clubId, slot);
      await loadWorkspace({ quiet: true });
      toast.success(slot.id ? "Winter slot updated" : "Winter slot added");
    } finally { setSaving(false); }
  }

  async function performDeleteWinterSlot(slot) {
    setSaving(true);
    try {
      await DB.deleteAnnualPlannerWinterSlot(clubId, slot.id);
      await loadWorkspace({ quiet: true });
      toast.success("Winter slot removed");
    } finally { setSaving(false); setConfirmRequest(null); }
  }

  function deleteWinterSlot(slot) {
    setConfirmRequest({
      tone: "danger",
      title: "Remove fixed winter slot?",
      description: `${slot.label || "This fixed slot"} will be removed from the seasonal inventory.`,
      confirmLabel: "Remove winter slot",
      cancelLabel: "Keep winter slot",
      action: "delete_winter_slot",
      slot,
    });
  }

  function nextDateForWeekday(dayOfWeek) {
    const date = new Date();
    const delta = (Number(dayOfWeek) - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + delta);
    return normaliseDateKey(date);
  }

  function openWinterSlotBooking(site, slot) {
    const base = blankBooking({ year, month, pitchCfg, settings: workspace.settings, canManage });
    setEditor({
      ...base,
      title: `${slot.label || slot.areaName || "Winter training"} booking`,
      seasonPhase: "winter",
      siteInventoryId: site.id,
      siteSlotId: slot.id,
      venueId: `winter-site:${site.id}`,
      venueName: site.name,
      pitchId: `winter-slot:${slot.id}`,
      pitchName: slot.label || slot.areaName || "Winter slot",
      pitchAreaId: FULL_PITCH_AREA_ID,
      pitchAreaName: slot.areaName || FULL_PITCH_AREA_LABEL,
      startDate: nextDateForWeekday(slot.dayOfWeek ?? slot.day_of_week),
      startTime: String(slot.startTime || slot.start_time || "18:00").slice(0, 5),
      endTime: String(slot.endTime || slot.end_time || "19:00").slice(0, 5),
      costPence: Number(slot.costPence ?? slot.cost_pence ?? site.costPence ?? site.cost_pence ?? 0) || 0,
    });
  }

  async function saveSmartPreference(preference) {
    setSaving(true);
    try {
      const payload = trainingPreferenceToPayload(preference);
      if (isSupaConfigured() && clubId) {
        await DB.saveAnnualPlannerTeamPreference(clubId, payload);
      } else {
        const current = readLocalWorkspace(clubId);
        const rows = Array.isArray(current.allocationPreferences) ? current.allocationPreferences : [];
        const index = rows.findIndex((row) => String(row.team_key || row.teamKey) === payload.team_key && String(row.season_phase || row.seasonPhase) === payload.season_phase);
        const next = index >= 0 ? rows.map((row, rowIndex) => rowIndex === index ? payload : row) : [...rows, payload];
        writeLocalWorkspace(clubId, { ...current, allocationPreferences: next });
      }
      await loadWorkspace({ quiet: true });
      toast.success("Team scheduling profile saved");
    } catch (preferenceError) {
      toast.error("Scheduling profile could not be saved", { description: preferenceError?.message });
      throw preferenceError;
    } finally {
      setSaving(false);
    }
  }

  async function saveSmartDraft(draft, { publish = false } = {}) {
    setSaving(true);
    try {
      if (isSupaConfigured() && clubId) {
        const saved = await DB.saveAnnualPlannerAllocationRun(
          clubId,
          allocationRunToPayload(draft),
          draft.items.map(allocationItemToPayload),
        );
        const runId = saved?.run?.id || saved?.run_id || saved?.id;
        if (publish) {
          if (!runId) throw new Error("The smart allocation draft did not return a run ID.");
          await DB.publishAnnualPlannerAllocationRun(clubId, runId);
        }
      } else {
        const current = readLocalWorkspace(clubId);
        const run = { ...allocationRunToPayload(draft), id: draft.id || crypto.randomUUID(), createdAt: new Date().toISOString(), status: publish ? "published" : "draft" };
        writeLocalWorkspace(clubId, { ...current, allocationRuns: [run, ...(current.allocationRuns || [])], allocationItems: draft.items });
      }
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(publish ? "Smart training allocation published" : "Smart allocation draft saved", {
        description: publish ? "Recurring bookings were created after a final database capacity check." : "The explainable draft is available for continued review.",
      });
    } catch (draftError) {
      toast.error(publish ? "Smart allocation could not be published" : "Smart allocation draft could not be saved", { description: draftError?.message });
      throw draftError;
    } finally {
      setSaving(false);
    }
  }

  async function recordWeatherDisruption(action, data) {
    if (!weatherBooking) return;
    setSaving(true);
    try {
      await DB.recordAnnualPlannerWeatherDisruption(clubId, weatherBooking.id, action, data);
      setWeatherBooking(null);
      setSelectedBooking(null);
      await loadWorkspace({ quiet: true });
      announceUpdate();
      toast.success(action === "rearrange" ? "Session rearranged" : action === "cancel" ? "Session cancelled due to weather" : "Session postponed due to weather");
    } catch (weatherError) {
      toast.error("Weather update could not be saved", { description: weatherError?.message });
    } finally { setSaving(false); }
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
              <button type="button" onClick={() => loadWorkspace({ quiet: true })} disabled={refreshing} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-black text-white hover:bg-white/10 disabled:opacity-60"><RefreshCw size={17} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}</button>
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
        <div className="mb-2 flex min-h-4 items-center justify-end px-2 text-[10px] font-black uppercase tracking-wide text-slate-400">{lastRefreshedAt ? `Updated ${lastRefreshedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
          {[
            ["calendar", "Calendar", CalendarDays, "Full year and monthly planning"],
            ["bookings", "Bookings", ListChecks, "Search and manage every booking"],
            ["requests", "Requests", ShieldCheck, "Approvals and provisional demand"],
            ["availability", "Availability", Ban, "Closures, blackouts and controls"],
            ["winter", "Winter sites", Snowflake, "Fixed external and seasonal slots"],
            ["smart", "Smart allocation", Sparkles, "Manual, assisted and automatic drafts"],
            ["insights", "Insights", Activity, "Utilisation, weather and grant evidence"],
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
          selectedDayBookings={selectedDayBookings} selectedDayClosures={selectedDayClosures} onSelectBooking={(booking) => booking.sourceType === "coach_request" ? openCoachReview(coachRequests.find((request) => request.id === booking.sourceId) || {}) : setSelectedBooking(booking)}
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
          onSelectCoachRequest={openCoachReview}
          onConversation={setConversationRequest}
          onApprove={(booking) => updateBookingStatus(booking, "confirmed")}
          onReject={(booking) => updateBookingStatus(booking, "rejected")}
        />
      ) : null}

      {tab === "availability" ? (
        <AvailabilityWorkspace
          blackouts={workspace.blackouts} pitchClosures={workspace.pitchClosures} closureImpacts={workspace.closureImpacts} pitchCfg={pitchCfg} canOperate={canOperate} canManage={canManage}
          onCreate={() => setBlackoutEditor({ title: "Pitch unavailable", closureType: "blackout", visibility: "club", startDate: normaliseDateKey(new Date()), endDate: normaliseDateKey(new Date()), startTime: "08:00", endTime: "22:00", venueId: "", pitchId: "", reason: "", publicNote: "", internalNote: "" })}
          settings={workspace.settings}
          saving={saving}
          onResolveImpact={resolveClosureImpact}
          onCommunicate={(blackout) => openCoachAudience({ reason: `Facility update: ${blackout.title}`, blackoutIds: [blackout.id] })}
        />
      ) : null}

      {tab === "winter" ? (
        <WinterSiteWorkspace
          sites={workspace.winterSites}
          slots={workspace.winterSlots}
          canManage={canManage}
          saving={saving}
          onSaveSite={saveWinterSite}
          onDeleteSite={deleteWinterSite}
          onSaveSlot={saveWinterSlot}
          onDeleteSlot={deleteWinterSlot}
          onBookSlot={openWinterSlotBooking}
        />
      ) : null}

      {tab === "smart" ? (
        <SmartTrainingAllocationWorkspace
          teams={teamCfg}
          pitches={pitchCfg}
          winterSites={workspace.winterSites}
          winterSlots={workspace.winterSlots}
          bookings={workspace.bookings}
          assignments={pilotWorkspace.assignments}
          preferences={workspace.allocationPreferences}
          allocationRuns={workspace.allocationRuns}
          canManage={canManage}
          saving={saving}
          onSavePreference={saveSmartPreference}
          onSaveDraft={(draft) => saveSmartDraft(draft)}
          onPublishDraft={(draft) => saveSmartDraft(draft, { publish: true })}
        />
      ) : null}

      {tab === "insights" ? (
        <DaxoraSectionErrorBoundary
          resetKey={`${clubId}:${year}:${pilotWorkspace.unavailable ? "unavailable" : "ready"}`}
          title="Annual Planner insights could not be displayed"
          description="Bookings, requests and approvals remain available. Retry Insights after the reporting data refreshes."
        >
          <div className="space-y-6">
            <AnnualPlannerAnalyticsSummary model={annualAnalytics} title="Annual Planner operational insights" />
          <PilotInsightsWorkspace
            snapshot={pilotSnapshot}
            canViewCosts={canViewCosts}
            metricsUnavailable={pilotWorkspace.unavailable}
            onCommunicateAll={() => openCoachAudience({ reason: "Annual Planner schedule update", teamKeys: [...new Set(workspace.bookings.map((booking) => booking.teamKey).filter(Boolean))] })}
          />
          </div>
        </DaxoraSectionErrorBoundary>
      ) : null}

      <BookingDrawer
        booking={selectedBooking}
        canOperate={canOperate}
        canApprove={canManage}
        canViewCosts={canViewCosts}
        saving={saving}
        onClose={() => setSelectedBooking(null)}
        onEdit={(booking) => setEditor({ ...booking, status: approvalRequired && !canManage ? "requested" : booking.status, recurrence: "none", recurrenceUntil: booking.startDate, applyToSeries: false })}
        onApprove={(booking) => canManage ? updateBookingStatus(booking, "confirmed") : undefined}
        onCommunicate={(booking) => openCoachAudience({ reason: `Booking update: ${booking.title}`, bookingIds: [booking.id] })}
        onWeather={(booking) => setWeatherBooking(booking)}
        onReconcile={async (booking) => {
          try {
            await DB.reconcileAnnualPlannerBookingCost(clubId, booking.id, { status: "reconciled", reference: booking.financeReference || booking.bookingReference || "Annual Planner" });
            await loadWorkspace({ quiet: true });
            toast.success("Booking cost reconciled");
          } catch (reconcileError) {
            toast.error("Cost reconciliation failed", { description: reconcileError?.message });
          }
        }}
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
        winterSites={workspace.winterSites}
        winterSlots={workspace.winterSlots}
        onSave={saveBooking}
      />

      <BlackoutEditor draft={blackoutEditor} setDraft={setBlackoutEditor} pitchCfg={pitchCfg} saving={saving} onSave={saveBlackout} />

      {coachReview ? <CoachRequestReviewDialog request={coachReview} pitches={pitchCfg} winterSites={workspace.winterSites} winterSlots={workspace.winterSlots} busy={saving} onClose={() => setCoachReview(null)} onDecision={decideCoachRequest} /> : null}
      {conversationRequest ? <CoachRequestConversation clubId={clubId} request={conversationRequest} role="club" onClose={() => setConversationRequest(null)} /> : null}
      {weatherBooking ? <WeatherDisruptionDialog booking={weatherBooking} pitches={pitchCfg} winterSites={workspace.winterSites} winterSlots={workspace.winterSlots} saving={saving} onClose={() => setWeatherBooking(null)} onSubmit={recordWeatherDisruption} /> : null}

      <DaxoraConfirmDialog
        request={confirmRequest}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={() => {
          if (confirmRequest?.booking) return deleteBooking(confirmRequest);
          if (confirmRequest?.action === "delete_winter_site" && confirmRequest.site) return performDeleteWinterSite(confirmRequest.site);
          if (confirmRequest?.action === "delete_winter_slot" && confirmRequest.slot) return performDeleteWinterSlot(confirmRequest.slot);
          setConfirmRequest(null);
        }}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, tone = "neutral" }) {
  const toneClass = tone === "warning" ? "bg-amber-400/15 text-amber-300" : tone === "ready" ? "bg-emerald-400/15 text-emerald-300" : "bg-white/[0.07] text-slate-300";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneClass}`}><Icon size={16} /></span></div><div className="mt-3 text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}

function CalendarWorkspace({ year, month, setYear, setMonth, cells, selectedDate, setSelectedDate, selectedDayBookings, selectedDayClosures = [], onSelectBooking, onCreate, matchdayBookings }) {
  const moveMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Shared calendar · year {year}</div><h2 className="mt-1 text-xl font-black text-slate-950">{MONTHS[month]}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Bookings, coach requests, blackouts and pitch closures share one calendar.</p></div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => moveMonth(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Previous month"><ChevronLeft size={18} /></button><button type="button" onClick={() => { const now = new Date(); setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDate(normaliseDateKey(now)); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50">Today</button><button type="button" onClick={() => moveMonth(1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Next month"><ChevronRight size={18} /></button></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-3 text-[10px] font-black uppercase tracking-wide">{COACH_CALENDAR_LEGEND.map((item) => <span key={item.key} className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${item.tone}`}><span className={`h-2 w-2 rounded-full ${item.swatch}`} />{item.label}</span>)}</div>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{WEEKDAYS.map((day) => <div key={day} className="px-2 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{day}</div>)}</div>
      <div className="grid grid-cols-7">{cells.map((cell) => {
        const closures = Array.isArray(cell.closures) ? cell.closures : [];
        const totalItems = closures.length + cell.bookings.length;
        const visibleItems = [
          ...closures.slice(0, 2).map((closure) => ({ id: `closure-${closure.kind}-${closure.id}-${cell.dateKey}`, kind: "closure", label: closure.pitchName || closure.title || "Unavailable" })),
          ...cell.bookings.slice(0, Math.max(0, 3 - Math.min(2, closures.length))).map((booking) => ({ id: `booking-${booking.id}`, kind: "booking", booking })),
        ].slice(0, 3);
        return <button type="button" key={cell.dateKey} onClick={() => setSelectedDate(cell.dateKey)} className={`min-h-[118px] border-b border-r border-slate-100 p-2 text-left align-top transition hover:bg-slate-50 ${!cell.inMonth ? "bg-slate-50/60 text-slate-400" : "bg-white"} ${selectedDate === cell.dateKey ? "ring-2 ring-inset ring-emerald-400" : ""}`}><div className="flex items-center justify-between gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${cell.today ? "bg-emerald-500 text-white" : "text-slate-700"}`}>{cell.date.getDate()}</span>{totalItems > 3 ? <span className="text-[10px] font-black text-slate-400">+{totalItems - 3}</span> : null}</div><div className="mt-2 space-y-1">{visibleItems.map((item) => item.kind === "closure" ? <span key={item.id} className="block truncate rounded-md border border-rose-200 bg-rose-50 px-1.5 py-1 text-[10px] font-black text-rose-800">Closed · {item.label}</span> : <span key={item.id} className={`block truncate rounded-md border px-1.5 py-1 text-[10px] font-black ${calendarEventTone(item.booking)}`}>{item.booking.startTime} {item.booking.teamName || item.booking.title}{item.booking.pitchAreaName ? ` · ${item.booking.pitchAreaName}` : ""}</span>)}</div></button>;
      })}</div>
    </section>
    <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Selected day</div><h3 className="mt-1 text-lg font-black text-slate-950">{formatDate(`${selectedDate}T12:00:00`, { weekday: "long", day: "numeric", month: "long" })}</h3></div>{onCreate ? <button type="button" onClick={() => onCreate(selectedDate)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Plus size={18} /></button> : null}</div>
      {selectedDayClosures.length ? <div className="mt-5 space-y-2">{selectedDayClosures.map((closure) => <div key={`${closure.kind}-${closure.id}`} className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><Ban className="mt-0.5 shrink-0 text-rose-600" size={17} /><div><div className="text-xs font-black uppercase tracking-wide text-rose-700">{closure.kind === "pitch_closure" ? "Pitch closure" : "Unavailable period"}</div><div className="mt-1 text-sm font-black text-rose-950">{closure.title}</div><div className="mt-1 text-xs font-semibold text-rose-900/75">{closure.pitchName || "All relevant facilities"}{closure.startTime && closure.endTime ? ` · ${closure.startTime}–${closure.endTime}` : ""}</div>{closure.publicNote || closure.reason ? <p className="mt-2 text-xs font-semibold leading-5 text-rose-900/80">{closure.publicNote || closure.reason}</p> : null}</div></div></div>)}</div> : null}
      <div className="mt-5 space-y-3">{selectedDayBookings.length ? selectedDayBookings.map((booking) => <BookingMiniCard key={booking.id} booking={booking} onClick={() => booking.sourceType === "matchday" ? null : onSelectBooking(booking)} readOnly={booking.sourceType === "matchday"} />) : !selectedDayClosures.length ? <Empty icon={CalendarDays} title="No facility use planned" description="Add training, a friendly or another booking for this day." /> : null}</div>
      {matchdayBookings.length ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-5 text-emerald-900"><ShieldCheck className="mb-2" size={18} />Ground Control fixtures are shown as protected facility bookings and are included in every conflict check.</div> : null}
    </aside>
  </div>;
}

function BookingsWorkspace({ bookings, query, setQuery, typeFilter, setTypeFilter, onSelect, onCreate }) {
  return <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Booking register</div><h2 className="mt-1 text-xl font-black text-slate-950">All training, friendlies and facility use</h2></div>{onCreate ? <button type="button" onClick={onCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={17} /> New booking</button> : null}</div>
    <div className="mt-5 flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team, opponent, pitch or reference" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-bold outline-none focus:border-emerald-400" /></label><label className="relative min-w-[220px]"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-black text-slate-700"><option value="all">All booking types</option>{ANNUAL_BOOKING_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label></div>
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="hidden grid-cols-[110px_90px_minmax(180px,1fr)_minmax(150px,0.8fr)_120px_44px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 lg:grid"><span>Date</span><span>Time</span><span>Booking</span><span>Pitch</span><span>Status</span><span /></div>{bookings.length ? bookings.map((booking) => <button key={booking.id} type="button" onClick={() => onSelect(booking)} className="grid w-full gap-2 border-b border-slate-100 px-4 py-4 text-left last:border-b-0 hover:bg-slate-50 lg:grid-cols-[110px_90px_minmax(180px,1fr)_minmax(150px,0.8fr)_120px_44px] lg:items-center"><span className="text-xs font-black text-slate-600">{formatDate(booking.startAt, { day: "2-digit", month: "short", year: "2-digit" })}</span><span className="text-xs font-black text-slate-900">{booking.startTime}</span><span><span className="block text-sm font-black text-slate-950">{booking.title}</span><span className="mt-1 block text-xs font-semibold text-slate-500">{booking.teamName || "Club-wide"}{booking.opponentName ? ` · v ${booking.opponentName}` : ""}</span></span><span className="text-xs font-bold text-slate-600">{[booking.pitchName || "Facility TBC", booking.pitchAreaName].filter(Boolean).join(" · ")}</span><StatusBadge status={booking.status} /><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><MoreHorizontal size={17} /></span></button>) : <Empty icon={Search} title="No bookings match" description="Change the filters or add a new booking." />}</div>
  </section>;
}

function RequestsWorkspace({ bookings, coachRequests = [], canOperate, saving, onSelect, onSelectCoachRequest, onConversation, onApprove, onReject }) {
  const total = bookings.length + coachRequests.length;
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Approval queue</div>
        <h2 className="mt-1 text-xl font-black text-slate-950">Facility requests awaiting a decision</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Coach Hub requests, conversations and administrator-created provisional bookings share one queue.</p>
      </div>
      <div className="mt-6 space-y-3">
        {coachRequests.map((request) => (
          <div key={`coach-${request.id}`} className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <button type="button" onClick={() => onSelectCoachRequest?.(request)} className="min-w-0 flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-emerald-950">{request.title}</span><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">Coach Hub</span></div>
              <div className="mt-1 text-xs font-bold text-emerald-900/70">{request.preferredDate} · {request.preferredStartTime}–{request.preferredEndTime} · {[request.preferredPitchName || "Pitch requested", request.preferredPitchAreaName].filter(Boolean).join(" · ")}</div>
              <div className="mt-1 text-xs font-semibold text-emerald-900/70">{request.teamName} · {requestStatusLabel(request.status)}{request.exceptionDates?.length ? ` · ${request.exceptionDates.length} skipped date${request.exceptionDates.length === 1 ? "" : "s"}` : ""}</div>
            </button>
            {canOperate ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onConversation?.(request)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-900"><MessageSquareText size={15} /> Conversation</button><button type="button" onClick={() => onSelectCoachRequest?.(request)} className="h-10 rounded-xl bg-slate-950 px-4 text-xs font-black text-white">Review request</button></div> : null}
          </div>
        ))}
        {bookings.map((booking) => (
          <div key={booking.id} className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <button type="button" onClick={() => onSelect(booking)} className="min-w-0 text-left">
              <div className="text-sm font-black text-amber-950">{booking.title}</div>
              <div className="mt-1 text-xs font-bold text-amber-900/70">{formatDate(booking.startAt)} · {booking.startTime}–{booking.endTime} · {[booking.pitchName || "Pitch TBC", booking.pitchAreaName].filter(Boolean).join(" · ")}</div>
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

function AvailabilityWorkspace({ blackouts, pitchClosures = [], closureImpacts = [], pitchCfg, canOperate, canManage, onCreate, onCommunicate, onResolveImpact, settings, saving = false }) {
  const activeImpacts = closureImpacts.filter((impact) => (impact.status || "action_required") === "action_required");
  return <div className="space-y-6">
    {activeImpacts.length ? <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm"><AlertTriangle size={20} /></span><div className="min-w-0 flex-1"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Action required</div><h2 className="mt-1 text-xl font-black text-amber-950">Closures affect {activeImpacts.length} existing booking{activeImpacts.length === 1 ? "" : "s"}</h2><p className="mt-2 text-sm font-semibold text-amber-900/75">Relocate, cancel or acknowledge every affected session. Ground Control will never silently remove an approved booking.</p></div></div><div className="mt-5 grid gap-3 lg:grid-cols-2">{activeImpacts.map((impact) => <div key={impact.id} className="rounded-2xl border border-amber-200 bg-white p-4"><div className="text-sm font-black text-slate-950">{impact.booking_title || "Affected booking"}</div><div className="mt-1 text-xs font-bold text-slate-600">{impact.team_name || impact.team_key || "Club-wide"} · {impact.pitch_name || "Facility TBC"}</div><div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(impact.booking_start_at || impact.created_at)} · affected by {impact.blackout_title || "facility closure"}</div>{canOperate ? <div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} type="button" onClick={() => onResolveImpact?.(impact, "relocated")} className="h-9 rounded-xl border border-sky-200 bg-sky-50 px-3 text-[11px] font-black text-sky-800">Mark relocated</button><button disabled={saving} type="button" onClick={() => onResolveImpact?.(impact, "cancelled")} className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-[11px] font-black text-rose-800">Mark cancelled</button><button disabled={saving} type="button" onClick={() => onResolveImpact?.(impact, "resolved")} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700">Resolve</button></div> : null}</div>)}</div></section> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Protected availability</div><h2 className="mt-1 text-xl font-black text-slate-950">Blackouts and unavailable periods</h2><p className="mt-2 text-sm font-semibold text-slate-500">Visible closures automatically appear in operator and Coach Hub calendars.</p></div>{canOperate ? <button type="button" onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white"><Plus size={17} /> Add blackout</button> : null}</div>
        <div className="mt-6 space-y-3">{blackouts.length ? blackouts.map((blackout) => <div key={blackout.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm"><Ban size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><div className="text-sm font-black text-rose-950">{blackout.title}</div><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-700">{blackout.visibility === "operators" ? "Operators only" : "Shared calendar"}</span>{blackout.affectedBookingCount ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-800">{blackout.affectedBookingCount} affected</span> : null}</div><div className="mt-1 text-xs font-bold text-rose-900/70">{formatDate(blackout.startAt)} to {formatDate(blackout.endAt)}</div><div className="mt-1 text-xs font-semibold text-rose-900/70">{pitchCfg.find((pitch) => pitch.id === blackout.pitchId)?.label || blackout.pitchName || (blackout.pitchId ? blackout.pitchId : "All relevant facilities")}</div>{blackout.publicNote || blackout.reason ? <div className="mt-2 text-xs font-semibold leading-5 text-rose-900/80">{blackout.publicNote || blackout.reason}</div> : null}{blackout.internalNote && canManage ? <div className="mt-2 rounded-xl border border-rose-200 bg-white/70 p-3 text-xs font-semibold text-slate-600"><span className="font-black text-slate-800">Internal:</span> {blackout.internalNote}</div> : null}{canOperate && blackout.visibility !== "operators" ? <button type="button" onClick={() => onCommunicate?.(blackout)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-800"><Megaphone size={14} /> Contact affected coaches</button> : null}</div></div></div>) : <Empty icon={Ban} title="No annual blackouts" description="Create a shared or operator-only closure to protect the calendar." />}</div>
        {pitchClosures.length ? <div className="mt-7"><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Matchday pitch closures</div><div className="mt-3 grid gap-3 sm:grid-cols-2">{pitchClosures.map((closure) => <div key={closure.id || `${closure.pitchId}-${closure.startDate}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-black text-slate-900">{closure.pitchName || closure.pitchId || "Pitch closure"}</div><div className="mt-1 text-xs font-bold text-slate-600">{formatDate(`${closure.startDate}T12:00:00`)}{closure.untilReopened ? " · until reopened" : closure.endDate && closure.endDate !== closure.startDate ? ` to ${formatDate(`${closure.endDate}T12:00:00`)}` : ""}</div>{closure.publicNote ? <p className="mt-2 text-xs font-semibold text-slate-500">{closure.publicNote}</p> : null}</div>)}</div></div> : null}
      </section>
      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Settings2 size={20} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Planner policy</div><h3 className="text-lg font-black text-slate-950">Booking defaults</h3></div></div><dl className="mt-5 space-y-3"><Policy label="Default status" value={settings.default_status || "Provisional"} /><Policy label="Training duration" value={`${settings.default_training_duration_minutes || 90} minutes`} /><Policy label="Friendly duration" value={`${settings.default_friendly_duration_minutes || 150} minutes`} /><Policy label="Approval required" value={settings.require_approval ? "Yes" : "No"} /><Policy label="Cost visibility" value={settings.show_costs_to_schedulers === false ? "Owners/admins" : "Schedulers"} /></dl>{canManage ? <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs font-bold leading-5 text-sky-900">Closures are rechecked at request and approval time. Affected bookings stay visible until an operator records the outcome.</div> : null}</aside>
    </div>
  </div>;
}

function PilotInsightsWorkspace({ snapshot, canViewCosts, metricsUnavailable = false, onCommunicateAll }) {
  const engagement = snapshot?.engagement || {};
  const utilisation = snapshot?.utilisation || {};
  const finance = snapshot?.finance || {};
  const pitchRows = Array.isArray(utilisation.byPitch) ? utilisation.byPitch : [];
  return <div className="space-y-6">
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-700">Pilot intelligence</div><h2 className="mt-1 text-xl font-black text-slate-950">Utilisation, coach engagement and cost control</h2><p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Measure whether the Annual Planner is reducing wasted pitch time, closing communication gaps and keeping supplier costs governed.</p></div><button type="button" onClick={onCommunicateAll} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white"><Megaphone size={17} /> Message active coaches</button></div>
      {metricsUnavailable ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><div><div className="font-black">Coach engagement metrics are temporarily unavailable</div><div className="mt-1 text-sm font-semibold text-amber-900/75">Annual bookings, requests and approvals remain operational while Daxora retries the reporting service.</div></div></div> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><InsightMetric icon={Activity} label="Facility use" value={`${utilisation.utilisationPct || 0}%`} detail={`${utilisation.usedHours || 0} booked hours`} /><InsightMetric icon={UserCheck} label="Coach verification" value={`${engagement.verificationPct || 0}%`} detail={`${engagement.verified || 0} of ${engagement.people || 0} contacts`} /><InsightMetric icon={MessageSquareText} label="Acknowledgements" value={`${engagement.acknowledgementPct ?? 100}%`} detail="Action messages confirmed" /><InsightMetric icon={CheckCircle2} label="Requests resolved" value={`${engagement.requestResolutionPct || 0}%`} detail={`${engagement.requestsResolved || 0} completed decisions`} /></div>
      {canViewCosts ? <div className="mt-4 grid gap-3 sm:grid-cols-3"><InsightMetric icon={PoundSterling} label="Planned cost" value={money(finance.plannedPence)} detail="Active bookings" /><InsightMetric icon={Receipt} label="Reconciled" value={`${finance.reconciledPct ?? 100}%`} detail={money(finance.reconciledPence)} /><InsightMetric icon={AlertTriangle} label="Needs reconciliation" value={finance.unreconciledCount || 0} detail={money(finance.outstandingPence)} tone="warning" /></div> : null}
    </section>
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Pitch utilisation</div><h3 className="mt-1 text-lg font-black text-slate-950">Where the calendar year is being used</h3><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="grid grid-cols-[minmax(140px,1fr)_90px_90px_100px] gap-3 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-500"><span>Pitch</span><span>Bookings</span><span>Hours</span><span>Use</span></div>{pitchRows.length ? pitchRows.map((pitch) => <div key={pitch.pitchId} className="grid grid-cols-[minmax(140px,1fr)_90px_90px_100px] gap-3 border-t border-slate-100 px-4 py-3 text-sm"><span className="font-black text-slate-900">{pitch.pitchName}</span><span className="font-bold text-slate-600">{pitch.bookings}</span><span className="font-bold text-slate-600">{pitch.hours}</span><span className="font-black text-emerald-700">{pitch.utilisationPct}%</span></div>) : <div className="p-6 text-center text-sm font-semibold text-slate-500">Add bookings to build a utilisation baseline.</div>}</div></section>
  </div>;
}

function InsightMetric({ icon: Icon, label, value, detail, tone = "neutral" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span><Icon size={17} className={tone === "warning" ? "text-amber-600" : "text-violet-600"} /></div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div></div>;
}

function BookingMiniCard({ booking, onClick, readOnly }) {
  return <button type="button" disabled={readOnly} onClick={onClick} className={`w-full rounded-2xl border p-4 text-left ${TYPE_TONES[booking.bookingType] || TYPE_TONES.meeting} ${readOnly ? "cursor-default" : "hover:shadow-sm"}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-black uppercase tracking-wide opacity-70">{booking.startTime}–{booking.endTime}</div><div className="mt-1 truncate text-sm font-black">{booking.title}</div><div className="mt-1 text-xs font-semibold opacity-80">{[booking.pitchName || "Pitch TBC", booking.pitchAreaName, booking.teamName].filter(Boolean).join(" · ")}</div></div>{readOnly ? <span className="rounded-full bg-white/70 px-2 py-1 text-[9px] font-black uppercase">Matchday</span> : <StatusBadge status={booking.status} />}</div></button>;
}

function BookingDrawer({ booking, canOperate, canApprove, canViewCosts, saving, onClose, onEdit, onApprove, onCommunicate, onWeather, onReconcile, onDelete }) {
  if (!booking) return null;
  const financeStatus = booking.financeStatus || "unreconciled";
  return <div className="fixed inset-0 z-[220] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur"><div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Annual planner booking</div><h2 className="mt-1 text-xl font-black text-slate-950">{booking.title}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button></div>
      <div className="space-y-5 p-5">
        <div className={`rounded-2xl border p-4 ${TYPE_TONES[booking.bookingType] || TYPE_TONES.meeting}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wide">{ANNUAL_BOOKING_TYPES.find((type) => type.value === booking.bookingType)?.label || booking.bookingType}</span><StatusBadge status={booking.status} /></div><div className="mt-4 text-lg font-black">{formatDate(booking.startAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div><div className="mt-1 text-sm font-bold">{booking.startTime}–{booking.endTime}</div></div>
        <Detail icon={Users} label="Team" value={booking.teamName || "Club-wide booking"} />
        <Detail icon={MapPin} label="Facility" value={[booking.venueName, booking.pitchName, booking.pitchAreaName].filter(Boolean).join(" · ") || "To be allocated"} />
        {booking.opponentName ? <Detail icon={Sparkles} label="Opponent" value={booking.opponentName} /> : null}
        {canViewCosts ? <Detail icon={PoundSterling} label="Planned cost" value={`${money(booking.costPence)} · ${financeStatus.replaceAll("_", " ")}`} /> : null}
        {booking.contactName || booking.contactEmail ? <Detail icon={Users} label="Booking contact" value={[booking.contactName, booking.contactEmail].filter(Boolean).join(" · ")} /> : null}
        {booking.bookingReference || booking.supplierReference || booking.financeReference ? <Detail icon={FileSpreadsheet} label="References" value={[booking.bookingReference, booking.supplierReference, booking.financeReference].filter(Boolean).join(" · ")} /> : null}
        {booking.notes ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">{booking.notes}</div> : null}
        {canOperate ? <div className="grid gap-2 sm:grid-cols-2"><button disabled={saving} type="button" onClick={() => onEdit(booking)} className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700">Edit booking</button><button disabled={saving || ["cancelled", "rejected", "postponed"].includes(booking.status)} type="button" onClick={() => onWeather?.(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sm font-black text-sky-800 disabled:opacity-40"><CloudRain size={16} /> Weather action</button><button disabled={saving || !booking.teamKey} type="button" onClick={() => onCommunicate?.(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 text-sm font-black text-violet-800 disabled:opacity-40"><Megaphone size={16} /> Contact coaches</button>{canViewCosts && Number(booking.costPence || 0) > 0 && financeStatus !== "reconciled" ? <button disabled={saving} type="button" onClick={() => onReconcile?.(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800"><Receipt size={16} /> Mark reconciled</button> : null}{booking.status === "requested" && canApprove ? <button disabled={saving} type="button" onClick={() => onApprove?.(booking)} className="h-11 rounded-xl bg-emerald-600 text-sm font-black text-white">Approve request</button> : <button disabled={saving} type="button" onClick={() => onDelete(booking)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700"><Trash2 size={16} /> Remove</button>}</div> : null}
      </div>
    </aside>
  </div>;
}

function BookingEditor({ draft, setDraft, saving, pitchCfg, teamCfg, bookings, blackouts, matchdayBookings, canViewCosts, approvalRequired, canManage, winterSites = [], winterSlots = [], onSave }) {
  const [localError, setLocalError] = useState("");
  if (!draft) return null;

  const selectedPitch = pitchCfg.find((pitch) => String(pitch.id) === String(draft.pitchId));
  const selectedAreas = pitchAreaOptions(selectedPitch || {}, { includeFullPitch: true });
  const selectedWinterSlot = winterSlots.find((slot) => String(slot.id) === String(draft.siteSlotId));
  const selectedWinterSite = winterSites.find((site) => String(site.id) === String(draft.siteInventoryId || selectedWinterSlot?.site_id || selectedWinterSlot?.siteId));
  const occurrences = expandRecurringBookingDraft(draft);
  const conflicts = occurrences.flatMap((occurrence) => detectAnnualPlannerConflicts(occurrence, {
    bookings,
    blackouts,
    matchdayBookings,
    pitches: pitchCfg,
    ignoreId: draft.id || "",
  }));
  const suggestions = conflicts.length
    ? findAnnualPlannerSuggestions(occurrences[0] || draft, { bookings, blackouts, matchdayBookings, pitches: pitchCfg }, { limit: 3 })
    : [];
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  const choosePitch = (pitchId) => {
    const pitch = pitchCfg.find((row) => String(row.id) === String(pitchId));
    const areas = pitchAreaOptions(pitch || {}, { includeFullPitch: true });
    const fullPitchByDefault = ["friendly", "camp", "tournament", "maintenance", "external_hire"].includes(draft.bookingType) && areas.length;
    setDraft((current) => ({
      ...current,
      pitchId,
      pitchName: pitch?.label || pitch?.name || "",
      venueId: pitch?.siteId || current.venueId || "",
      venueName: pitch?.siteLabel || pitch?.venueName || current.venueName || "",
      pitchAreaId: fullPitchByDefault ? FULL_PITCH_AREA_ID : "",
      pitchAreaName: fullPitchByDefault ? FULL_PITCH_AREA_LABEL : "",
      seasonPhase: current.seasonPhase === "winter" ? "regular" : (current.seasonPhase || "regular"),
      siteInventoryId: "",
      siteSlotId: "",
    }));
  };

  const chooseArea = (areaId) => {
    const area = selectedAreas.find((row) => row.id === areaId);
    setDraft((current) => ({ ...current, pitchAreaId: areaId, pitchAreaName: area?.label || "" }));
  };

  const chooseWinterSlot = (slotId) => {
    const slot = winterSlots.find((row) => String(row.id) === String(slotId));
    const site = winterSites.find((row) => String(row.id) === String(slot?.site_id || slot?.siteId));
    if (!slot || !site) return;
    setDraft((current) => ({
      ...current,
      seasonPhase: "winter",
      siteInventoryId: site.id,
      siteSlotId: slot.id,
      venueId: `winter-site:${site.id}`,
      venueName: site.name,
      pitchId: `winter-slot:${slot.id}`,
      pitchName: slot.label || slot.area_name || slot.areaName || "Winter slot",
      pitchAreaId: FULL_PITCH_AREA_ID,
      pitchAreaName: slot.area_name || slot.areaName || FULL_PITCH_AREA_LABEL,
      startTime: String(slot.start_time || slot.startTime || current.startTime).slice(0, 5),
      endTime: String(slot.end_time || slot.endTime || current.endTime).slice(0, 5),
      costPence: Number(slot.cost_pence ?? slot.costPence ?? site.cost_pence ?? site.costPence ?? current.costPence ?? 0) || 0,
    }));
  };

  const submit = async () => {
    setLocalError("");
    if (!draft.title?.trim()) return setLocalError("Enter a clear booking title.");
    if (!draft.pitchId && !draft.siteSlotId) return setLocalError("Choose a club pitch or fixed winter slot before saving.");
    if (selectedAreas.length && !draft.pitchAreaId && !draft.siteSlotId) return setLocalError("Choose Full Pitch or a named pitch area before saving.");
    if (conflicts.length) return setLocalError(conflicts[0].message);
    try {
      await onSave({
        ...draft,
        pitchName: selectedPitch?.label || selectedWinterSlot?.label || draft.pitchName,
        pitchAreaName: selectedAreas.find((area) => area.id === draft.pitchAreaId)?.label || selectedWinterSlot?.area_name || selectedWinterSlot?.areaName || draft.pitchAreaName || "",
        venueId: selectedPitch?.siteId || (selectedWinterSite ? `winter-site:${selectedWinterSite.id}` : draft.venueId),
        venueName: selectedPitch?.siteLabel || selectedWinterSite?.name || draft.venueName,
      });
    } catch (error) {
      setLocalError(error?.message || "The booking could not be saved.");
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setDraft(null); }}>
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{draft.id ? "Edit annual booking" : "New annual booking"}</div><h2 className="mt-1 text-xl font-black text-slate-950">Plan facility use</h2></div>
          <button disabled={saving} type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500"><X size={18} /></button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_310px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Booking title" wide><input value={draft.title || ""} onChange={(event) => set("title", event.target.value)} className="input" /></Field>
            <Field label="Type"><select value={draft.bookingType || "training"} onChange={(event) => { const nextType = event.target.value; setDraft((current) => ({ ...current, bookingType: nextType, pitchAreaId: selectedAreas.length && ["friendly", "camp", "tournament", "maintenance", "external_hire"].includes(nextType) ? FULL_PITCH_AREA_ID : current.pitchAreaId, pitchAreaName: selectedAreas.length && ["friendly", "camp", "tournament", "maintenance", "external_hire"].includes(nextType) ? FULL_PITCH_AREA_LABEL : current.pitchAreaName })); }} className="input">{ANNUAL_BOOKING_TYPES.filter((type) => type.value !== "match").map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
            <Field label="Status"><select disabled={approvalRequired && !canManage} value={approvalRequired && !canManage ? "requested" : draft.status || "provisional"} onChange={(event) => set("status", event.target.value)} className="input disabled:bg-slate-100 disabled:text-slate-500">{(approvalRequired && !canManage ? ANNUAL_BOOKING_STATUSES.filter((status) => status.value === "requested") : ANNUAL_BOOKING_STATUSES.filter((status) => !["cancelled", "rejected"].includes(status.value))).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>{approvalRequired && !canManage ? <span className="mt-1 block text-[11px] font-semibold text-amber-700">Changes are submitted for owner or administrator approval.</span> : null}</Field>
            <Field label="Team"><select value={draft.teamKey || ""} onChange={(event) => { const team = teamCfg.find((row) => String(row.id || row.name) === event.target.value); setDraft((current) => ({ ...current, teamKey: event.target.value, teamName: team?.name || "" })); }} className="input"><option value="">Club-wide / no team</option>{teamCfg.map((team) => <option key={team.id || team.name} value={team.id || team.name}>{team.name}</option>)}</select></Field>
            {draft.bookingType === "friendly" ? <Field label="Opponent"><input value={draft.opponentName || ""} onChange={(event) => set("opponentName", event.target.value)} className="input" placeholder="Visiting club or internal team" /></Field> : null}
            <Field label="Season"><select value={draft.seasonPhase || "regular"} onChange={(event) => { const next = event.target.value; setDraft((current) => ({ ...current, seasonPhase: next, ...(next !== "winter" ? { siteInventoryId: "", siteSlotId: "" } : {}) })); }} className="input"><option value="preseason">Pre-season</option><option value="regular">Regular season</option><option value="winter">Winter training</option></select></Field>
            {draft.seasonPhase === "winter" && winterSlots.length ? <Field label="Fixed winter slot" wide><select value={draft.siteSlotId || ""} onChange={(event) => chooseWinterSlot(event.target.value)} className="input"><option value="">Choose fixed winter slot</option>{winterSlots.filter((slot) => slot.active !== false).map((slot) => { const site = winterSites.find((row) => String(row.id) === String(slot.site_id || slot.siteId)); return <option key={slot.id} value={slot.id}>{site?.name || "Winter site"} · {slot.label || slot.area_name || slot.areaName || "Training slot"} · {String(slot.start_time || slot.startTime).slice(0,5)}–{String(slot.end_time || slot.endTime).slice(0,5)}</option>; })}</select><span className="mt-1 block text-[11px] font-semibold text-slate-500">Winter availability uses this site's dates, weekly slots, capacity and cost rather than the normal grass-pitch inventory.</span></Field> : null}
            {draft.seasonPhase !== "winter" || !draft.siteSlotId ? <Field label="Pitch"><select value={draft.siteSlotId ? "" : (draft.pitchId || "")} onChange={(event) => choosePitch(event.target.value)} className="input"><option value="">Choose pitch</option>{pitchCfg.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.id}</option>)}</select></Field> : null}
            {selectedAreas.length && !draft.siteSlotId ? <Field label="Pitch allocation"><select value={draft.pitchAreaId || ""} onChange={(event) => chooseArea(event.target.value)} className="input"><option value="">Choose allocation</option>{selectedAreas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select><span className="mt-1 block text-[11px] font-semibold text-slate-500">Full Pitch blocks every half. Named halves can run simultaneously up to the pitch capacity.</span></Field> : null}
            <Field label="Date"><input type="date" value={draft.startDate || ""} onChange={(event) => set("startDate", event.target.value)} className="input" /></Field>
            <Field label="Starts"><input type="time" step="900" value={normaliseTime(draft.startTime)} onChange={(event) => set("startTime", event.target.value)} className="input" /></Field>
            <Field label="Finishes"><input type="time" step="900" value={normaliseTime(draft.endTime, "19:30")} onChange={(event) => set("endTime", event.target.value)} className="input" /></Field>

            {!draft.id ? <>
              <Field label="Repeats"><select value={draft.recurrence || "none"} onChange={(event) => set("recurrence", event.target.value)} className="input">{RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
              {draft.recurrence !== "none" ? <>
                <Field label="Repeat until"><input type="date" value={draft.recurrenceUntil || draft.startDate || ""} min={draft.startDate || ""} onChange={(event) => set("recurrenceUntil", event.target.value)} className="input" /></Field>
                <Field label="School holidays"><select value={draft.holidayPolicy || "include"} onChange={(event) => set("holidayPolicy", event.target.value)} className="input"><option value="include">Keep every scheduled date</option><option value="exclude">Exclude supplied holiday dates</option><option value="custom">Use custom exceptions</option></select></Field>
                <Field label="Dates to skip" wide><textarea rows="3" value={draft.exceptionDatesText || (draft.exceptionDates || []).join(", ")} onChange={(event) => set("exceptionDatesText", event.target.value)} className="input min-h-[88px] py-3" placeholder="2026-10-26, 2026-11-02" /><span className="mt-1 block text-[11px] font-semibold text-slate-500">Comma, space or new-line separated. These dates are excluded from the saved series.</span></Field>
              </> : null}
            </> : null}

            {draft.id && draft.seriesId ? <Field label="Recurring series" wide><label className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4"><input type="checkbox" checked={Boolean(draft.applyToSeries)} onChange={(event) => set("applyToSeries", event.target.checked)} className="mt-0.5" /><span><span className="block text-sm font-black text-violet-950">Apply this change to remaining dates</span><span className="mt-1 block text-xs font-semibold leading-5 text-violet-800">Keeps each date but updates pitch, area, time, status, team, cost and booking details across the rest of this series.</span></span></label></Field> : null}
            {canViewCosts ? <Field label="Cost (£)"><input type="number" min="0" step="0.01" value={(Number(draft.costPence || 0) / 100).toFixed(2)} onChange={(event) => set("costPence", Math.round(Number(event.target.value || 0) * 100))} className="input" /></Field> : null}
            <Field label="Booking reference"><input value={draft.bookingReference || ""} onChange={(event) => set("bookingReference", event.target.value)} className="input" /></Field>
            {canViewCosts ? <Field label="Supplier reference"><input value={draft.supplierReference || ""} onChange={(event) => set("supplierReference", event.target.value)} className="input" /></Field> : null}
            <Field label="Contact name"><input value={draft.contactName || ""} onChange={(event) => set("contactName", event.target.value)} className="input" /></Field>
            <Field label="Contact email"><input type="email" value={draft.contactEmail || ""} onChange={(event) => set("contactEmail", event.target.value)} className="input" /></Field>
            <Field label="Notes" wide><textarea value={draft.notes || ""} onChange={(event) => set("notes", event.target.value)} rows="4" className="input min-h-[110px] py-3" /></Field>
          </div>

          <aside className="space-y-4">
            <div className={`rounded-2xl border p-4 ${conflicts.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center gap-2 text-sm font-black">{conflicts.length ? <AlertTriangle className="text-rose-600" size={18} /> : <CheckCircle2 className="text-emerald-600" size={18} />}{conflicts.length ? "Conflict found" : "Booking can be saved"}</div><p className="mt-2 text-xs font-semibold leading-5 opacity-80">{conflicts.length ? conflicts[0].message : `${occurrences.length || 1} occurrence${occurrences.length === 1 ? "" : "s"} checked against areas, pitch capacity, training, friendlies, blackouts and current matchdays.`}</p></div>
            {selectedPitch && draft.bookingType === "training" ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-[10px] font-black uppercase tracking-wide text-sky-800">Shared pitch capacity</div><div className="mt-2 text-sm font-black text-sky-950">{selectedPitch.label || selectedPitch.id} supports {Math.max(1, Number(selectedPitch.trainingCapacity || selectedPitch.training_capacity || 1))} simultaneous teams</div>{selectedAreas.length ? <div className="mt-2 text-xs font-semibold text-sky-800">Allocations: {selectedAreas.map((area) => area.label).join(" · ")}</div> : null}</div> : null}
            {suggestions.length ? <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-sky-800">Available alternatives</div><div className="mt-3 space-y-2">{suggestions.map((suggestion) => <button key={`${suggestion.startDate}-${suggestion.startTime}-${suggestion.pitchId}`} type="button" onClick={() => setDraft((current) => ({ ...current, startDate: suggestion.startDate, startTime: suggestion.startTime, endTime: suggestion.endTime, pitchId: suggestion.pitchId, pitchName: suggestion.pitchName, pitchAreaId: suggestion.pitchAreaId || "", pitchAreaName: suggestion.pitchAreaName || "" }))} className="w-full rounded-xl bg-white p-3 text-left text-xs font-bold text-sky-950 shadow-sm"><span className="block font-black">{formatDate(`${suggestion.startDate}T12:00:00`, { weekday: "short", day: "numeric", month: "short" })} · {suggestion.startTime}</span><span className="mt-1 block text-sky-700">{[suggestion.pitchName || suggestion.pitchId, suggestion.pitchAreaName].filter(Boolean).join(" · ")}</span></button>)}</div></div> : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-500">Series preview</div><div className="mt-2 text-2xl font-black text-slate-950">{occurrences.length || 0}</div><div className="text-xs font-semibold text-slate-500">bookings will be created</div></div>
          </aside>
        </div>

        {localError ? <div className="mx-5 mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900 sm:mx-6">{localError}</div> : null}
        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6"><button disabled={saving} type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700">Cancel</button><button disabled={saving || conflicts.length > 0} type="button" onClick={submit} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : draft.id ? "Save changes" : occurrences.length > 1 ? `Create ${occurrences.length} bookings` : "Add booking"}</button></div>
      </section>
    </div>
  );
}

function BlackoutEditor({ draft, setDraft, pitchCfg, saving, onSave }) {
  const [error, setError] = useState("");
  if (!draft) return null;
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-[235] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:items-center sm:p-6"><section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-700">Facility protection</div><h2 className="mt-1 text-xl font-black">Add unavailable period</h2><p className="mt-1 text-xs font-semibold text-slate-500">Shared closures appear automatically on Coach Hub and operator calendars.</p></div><button type="button" onClick={() => setDraft(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button></div><div className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Title" wide><input className="input" value={draft.title} onChange={(e) => set("title", e.target.value)} /></Field><Field label="Closure type"><select className="input" value={draft.closureType || "blackout"} onChange={(e) => set("closureType", e.target.value)}><option value="blackout">Club blackout</option><option value="pitch_closure">Pitch closure</option><option value="maintenance">Maintenance</option><option value="external_hire">External hire</option><option value="weather">Weather</option><option value="club_event">Club event</option></select></Field><Field label="Calendar visibility"><select className="input" value={draft.visibility || "club"} onChange={(e) => set("visibility", e.target.value)}><option value="club">Shared with affected coaches</option><option value="operators">Operators only</option></select></Field><Field label="Pitch"><select className="input" value={draft.pitchId} onChange={(e) => { const pitch = pitchCfg.find((row) => row.id === e.target.value); setDraft((current) => ({ ...current, pitchId: e.target.value, venueId: pitch?.siteId || current.venueId || "" })); }}><option value="">All relevant pitches</option>{pitchCfg.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label || pitch.id}</option>)}</select></Field><Field label="Start date"><input type="date" className="input" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field><Field label="Start time"><input type="time" className="input" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field><Field label="End date"><input type="date" className="input" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field><Field label="End time"><input type="time" className="input" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field><Field label="Public coach-facing note" wide><textarea className="input min-h-[96px] py-3" value={draft.publicNote || ""} onChange={(e) => set("publicNote", e.target.value)} placeholder="Explain what is unavailable and what coaches should do next." /></Field><Field label="Operational reason" wide><textarea className="input min-h-[88px] py-3" value={draft.reason || ""} onChange={(e) => set("reason", e.target.value)} placeholder="Closure reason used in the operational record." /></Field><Field label="Internal note" wide><textarea className="input min-h-[88px] py-3" value={draft.internalNote || ""} onChange={(e) => set("internalNote", e.target.value)} placeholder="Visible only to club operators." /></Field></div>{error ? <div className="mx-5 mb-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-900">{error}</div> : null}<div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur"><button type="button" onClick={() => setDraft(null)} className="h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">Cancel</button><button disabled={saving} type="button" onClick={async () => { setError(""); try { await onSave(draft); } catch (saveError) { setError(saveError?.message || "Could not save blackout."); } }} className="h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">{saving ? "Saving…" : "Save closure"}</button></div></section></div>;
}

function StatusBadge({ status }) {
  const tones = { confirmed: "bg-emerald-100 text-emerald-800", completed: "bg-emerald-100 text-emerald-800", provisional: "bg-sky-100 text-sky-800", requested: "bg-amber-100 text-amber-800", postponed: "bg-violet-100 text-violet-800", cancelled: "bg-slate-100 text-slate-600", rejected: "bg-rose-100 text-rose-700" };
  return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${tones[status] || tones.provisional}`}>{status || "provisional"}</span>;
}

function Detail({ icon: Icon, label, value }) { return <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><Icon size={18} /></span><div><div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-1 text-sm font-black text-slate-950">{value}</div></div></div>; }
function Policy({ label, value }) { return <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3"><dt className="text-xs font-bold text-slate-500">{label}</dt><dd className="text-right text-xs font-black text-slate-900">{value}</dd></div>; }
function Field({ label, children, wide = false }) { return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>{children}</label>; }
function Empty({ icon: Icon, title, description }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><Icon className="mx-auto text-slate-400" size={24} /><div className="mt-3 text-sm font-black text-slate-800">{title}</div><div className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</div></div>; }
function PlannerLoading() { return <div className="space-y-4"><div className="h-64 animate-pulse rounded-[32px] bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-200" />)}</div></div>; }
