import { bookingDurationMinutes, normaliseAnnualBooking, normaliseAnnualBlackout } from "../planning/annualPlannerEngine.js";

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, places = 1) {
  const factor = 10 ** places;
  return Math.round(number(value) * factor) / factor;
}

function dateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normaliseSite(row = {}) {
  return {
    id: text(row.id),
    name: text(row.name || row.site_name || row.siteName || "Winter site"),
    seasonType: text(row.season_type || row.seasonType || "winter"),
    providerType: text(row.provider_type || row.providerType || "external"),
    availableFrom: dateKey(row.available_from || row.availableFrom),
    availableTo: dateKey(row.available_to || row.availableTo),
    costPence: Math.max(0, number(row.cost_pence ?? row.costPence)),
    active: row.active !== false,
  };
}

function normaliseSlot(row = {}) {
  return {
    id: text(row.id),
    siteId: text(row.site_id || row.siteId),
    label: text(row.label || row.slot_label || row.slotLabel || "Training slot"),
    dayOfWeek: number(row.day_of_week ?? row.dayOfWeek, 1),
    startTime: text(row.start_time || row.startTime),
    endTime: text(row.end_time || row.endTime),
    capacity: Math.max(1, number(row.capacity, 1)),
    costPence: Math.max(0, number(row.cost_pence ?? row.costPence)),
    active: row.active !== false,
  };
}

function bookingHours(booking) {
  return bookingDurationMinutes(booking) / 60;
}

function activeForCapacity(booking) {
  return ["requested", "provisional", "confirmed", "completed"].includes(booking.status);
}

export function normaliseAnnualPlannerAnalyticsPayload(payload = {}) {
  return {
    bookings: (Array.isArray(payload.bookings) ? payload.bookings : []).map(normaliseAnnualBooking),
    blackouts: (Array.isArray(payload.blackouts) ? payload.blackouts : []).map(normaliseAnnualBlackout),
    winterSites: (Array.isArray(payload.winter_sites || payload.winterSites) ? (payload.winter_sites || payload.winterSites) : []).map(normaliseSite),
    winterSlots: (Array.isArray(payload.winter_slots || payload.winterSlots) ? (payload.winter_slots || payload.winterSlots) : []).map(normaliseSlot),
    requests: Array.isArray(payload.requests) ? payload.requests : [],
    allocationRuns: Array.isArray(payload.allocation_runs || payload.allocationRuns) ? (payload.allocation_runs || payload.allocationRuns) : [],
    allocationItems: Array.isArray(payload.allocation_items || payload.allocationItems) ? (payload.allocation_items || payload.allocationItems) : [],
    closureImpacts: Array.isArray(payload.closure_impacts || payload.closureImpacts) ? (payload.closure_impacts || payload.closureImpacts) : [],
    resources: Array.isArray(payload.resources || payload.planner_resources || payload.plannerResources) ? (payload.resources || payload.planner_resources || payload.plannerResources) : [],
    waitlist: Array.isArray(payload.waitlist || payload.waitlist_entries || payload.waitlistEntries) ? (payload.waitlist || payload.waitlist_entries || payload.waitlistEntries) : [],
    seasonRollovers: Array.isArray(payload.season_rollovers || payload.seasonRollovers) ? (payload.season_rollovers || payload.seasonRollovers) : [],
  };
}

export function buildAnnualPlannerAnalyticsModel(payload = {}, { year = new Date().getFullYear() } = {}) {
  const data = normaliseAnnualPlannerAnalyticsPayload(payload);
  const yearText = String(year);
  const bookings = data.bookings.filter((booking) => booking.startDate.startsWith(yearText));
  const active = bookings.filter(activeForCapacity);
  const completed = bookings.filter((booking) => booking.status === "completed");
  const weatherAffected = bookings.filter((booking) => ["weather_postponed", "weather_cancelled", "awaiting_rearrangement"].includes(booking.disruptionStatus));
  const rearranged = bookings.filter((booking) => booking.disruptionStatus === "rearranged" || booking.rescheduledFromBookingId);
  const winter = active.filter((booking) => booking.seasonPhase === "winter" || booking.siteInventoryId);
  const regular = active.filter((booking) => !winter.includes(booking));
  const plannedHours = active.reduce((sum, booking) => sum + bookingHours(booking), 0);
  const deliveredHours = completed.reduce((sum, booking) => sum + bookingHours(booking), 0);
  const weatherLostHours = weatherAffected.reduce((sum, booking) => sum + bookingHours(booking), 0);
  const rearrangedHours = rearranged.reduce((sum, booking) => sum + bookingHours(booking), 0);
  const winterHours = winter.reduce((sum, booking) => sum + bookingHours(booking), 0);
  const externalWinterCostPence = winter.reduce((sum, booking) => sum + booking.costPence, 0)
    + data.winterSites.filter((site) => site.providerType === "external").reduce((sum, site) => sum + site.costPence, 0);

  const pitchMap = new Map();
  active.forEach((booking) => {
    const key = booking.pitchId || booking.siteSlotId || "unallocated";
    const current = pitchMap.get(key) || {
      id: key,
      label: booking.pitchName || booking.venueName || "Unallocated",
      bookings: 0,
      hours: 0,
      winterHours: 0,
      weatherLostHours: 0,
    };
    current.bookings += 1;
    current.hours += bookingHours(booking);
    if (booking.seasonPhase === "winter" || booking.siteInventoryId) current.winterHours += bookingHours(booking);
    pitchMap.set(key, current);
  });
  weatherAffected.forEach((booking) => {
    const key = booking.pitchId || booking.siteSlotId || "unallocated";
    const current = pitchMap.get(key) || {
      id: key,
      label: booking.pitchName || booking.venueName || "Unallocated",
      bookings: 0,
      hours: 0,
      winterHours: 0,
      weatherLostHours: 0,
    };
    current.weatherLostHours += bookingHours(booking);
    pitchMap.set(key, current);
  });

  const teamMap = new Map();
  active.forEach((booking) => {
    const key = booking.teamKey || booking.teamName || "club";
    const current = teamMap.get(key) || { id: key, label: booking.teamName || "Club-wide", bookings: 0, hours: 0, winterHours: 0 };
    current.bookings += 1;
    current.hours += bookingHours(booking);
    if (booking.seasonPhase === "winter" || booking.siteInventoryId) current.winterHours += bookingHours(booking);
    teamMap.set(key, current);
  });

  const requestRows = data.requests.filter((row) => String(row.created_at || row.createdAt || "").startsWith(yearText));
  const resolvedRequests = requestRows.filter((row) => ["approved", "rejected", "cancelled", "accepted"].includes(text(row.status)));
  const pendingRequests = requestRows.filter((row) => ["submitted", "needs_information", "alternative_offered"].includes(text(row.status)));
  const weatherBlackouts = data.blackouts.filter((row) => row.closureType === "weather" && row.startDate.startsWith(yearText));
  const allocationRuns = data.allocationRuns.filter((row) => String(row.created_at || row.createdAt || "").startsWith(yearText));
  const allocationItems = data.allocationItems.filter((row) => allocationRuns.some((run) => String(run.id) === String(row.run_id || row.runId)));
  const publishedAllocationRuns = allocationRuns.filter((row) => text(row.status) === "published");
  const automaticAllocationRuns = allocationRuns.filter((row) => text(row.mode) === "automatic");
  const unassignedAllocationItems = allocationItems.filter((row) => text(row.status) === "unassigned");
  const scoredAllocationItems = allocationItems.filter((row) => number(row.score) > 0);
  const averageAllocationScore = scoredAllocationItems.length ? round(scoredAllocationItems.reduce((sum, row) => sum + number(row.score), 0) / scoredAllocationItems.length, 0) : 0;
  const closureImpacts = data.closureImpacts.filter((row) => String(row.created_at || row.createdAt || row.booking_start_at || row.bookingStartAt || "").startsWith(yearText));
  const closureResolved = closureImpacts.filter((row) => ["relocated", "postponed", "cancelled", "acknowledged", "resolved"].includes(text(row.status)));
  const closureAwaitingCoach = closureImpacts.filter((row) => text(row.status) === "awaiting_coach");
  const closureRelocated = closureImpacts.filter((row) => text(row.status) === "relocated");
  const closureCancelled = closureImpacts.filter((row) => text(row.status) === "cancelled");
  const closurePostponed = closureImpacts.filter((row) => text(row.status) === "postponed");
  const activeResources = data.resources.filter((row) => row.active !== false);
  const waitingRows = data.waitlist.filter((row) => text(row.status || "waiting") === "waiting");
  const offeredWaitlistRows = data.waitlist.filter((row) => text(row.status) === "offered");
  const allocatedWaitlistRows = data.waitlist.filter((row) => text(row.status) === "allocated");
  const rolloverRows = data.seasonRollovers.filter((row) => String(row.created_at || row.createdAt || "").startsWith(yearText));
  const bufferedBookings = active.filter((booking) => booking.setupBufferMinutes > 0 || booking.clearDownBufferMinutes > 0);
  const resourceReservations = active.reduce((sum, booking) => sum + (Array.isArray(booking.resourceRequirements) ? booking.resourceRequirements.length : 0), 0);

  const grantNarratives = [];
  if (weatherLostHours > 0) grantNarratives.push(`${round(weatherLostHours)} scheduled training and friendly hours were lost or postponed because of weather.`);
  if (winterHours > 0) grantNarratives.push(`${round(winterHours)} team-hours were scheduled at winter or external facilities.`);
  if (externalWinterCostPence > 0) grantNarratives.push(`External winter provision currently represents GBP ${(externalWinterCostPence / 100).toFixed(2)} of recorded facility cost.`);
  if (publishedAllocationRuns.length > 0) grantNarratives.push(`${publishedAllocationRuns.length} reviewed smart allocation run${publishedAllocationRuns.length === 1 ? "" : "s"} supported consistent seasonal training access.`);
  if (closureImpacts.length > 0) grantNarratives.push(`${closureImpacts.length} approved session${closureImpacts.length === 1 ? " was" : "s were"} affected by facility closures; ${closureRelocated.length} were relocated and ${closureCancelled.length} were cancelled.`);
  if (waitingRows.length > 0) grantNarratives.push(`${waitingRows.length} team${waitingRows.length === 1 ? " remains" : "s remain"} on the training waitlist because suitable facility capacity is not yet available.`);
  if (allocatedWaitlistRows.length > 0) grantNarratives.push(`${allocatedWaitlistRows.length} waitlisted team${allocatedWaitlistRows.length === 1 ? " has" : "s have"} since been allocated a training slot.`);
  if (resourceReservations > 0) grantNarratives.push(`${resourceReservations} shared-resource reservation${resourceReservations === 1 ? " was" : "s were"} recorded across annual facility bookings.`);
  if (!grantNarratives.length) grantNarratives.push("Record completed sessions, weather disruptions and winter allocations to build grant-ready facility evidence.");

  return Object.freeze({
    year: Number(year),
    hasData: bookings.length > 0 || data.winterSites.length > 0 || requestRows.length > 0 || data.waitlist.length > 0 || data.resources.length > 0,
    bookings,
    winterSites: data.winterSites,
    winterSlots: data.winterSlots,
    metrics: Object.freeze({
      plannedHours: round(plannedHours),
      deliveredHours: round(deliveredHours),
      weatherLostHours: round(weatherLostHours),
      weatherAffectedSessions: weatherAffected.length,
      rearrangedSessions: rearranged.length,
      rearrangedHours: round(rearrangedHours),
      winterBookings: winter.length,
      winterHours: round(winterHours),
      regularHours: round(regular.reduce((sum, booking) => sum + bookingHours(booking), 0)),
      externalWinterCostPence,
      activeWinterSites: data.winterSites.filter((site) => site.active).length,
      fixedWinterSlots: data.winterSlots.filter((slot) => slot.active).length,
      requestCount: requestRows.length,
      pendingRequests: pendingRequests.length,
      resolvedRequests: resolvedRequests.length,
      requestResolutionPct: requestRows.length ? Math.round((resolvedRequests.length / requestRows.length) * 100) : 100,
      weatherClosures: weatherBlackouts.length,
      allocationRuns: allocationRuns.length,
      publishedAllocationRuns: publishedAllocationRuns.length,
      automaticAllocationRuns: automaticAllocationRuns.length,
      smartAllocatedTeams: allocationItems.filter((row) => text(row.status) === "published").length,
      unassignedAllocationTeams: unassignedAllocationItems.length,
      averageAllocationScore,
      activeResources: activeResources.length,
      waitingTeams: waitingRows.length,
      offeredWaitlistTeams: offeredWaitlistRows.length,
      allocatedWaitlistTeams: allocatedWaitlistRows.length,
      seasonRollovers: rolloverRows.length,
      bufferedBookings: bufferedBookings.length,
      resourceReservations,
      closureAffectedBookings: closureImpacts.length,
      closureResolvedBookings: closureResolved.length,
      closureAwaitingCoach: closureAwaitingCoach.length,
      closureRelocatedBookings: closureRelocated.length,
      closurePostponedBookings: closurePostponed.length,
      closureCancelledBookings: closureCancelled.length,
      closureResolutionPct: closureImpacts.length ? Math.round((closureResolved.length / closureImpacts.length) * 100) : 100,
    }),
    pitchRows: [...pitchMap.values()].map((row) => ({ ...row, hours: round(row.hours), winterHours: round(row.winterHours), weatherLostHours: round(row.weatherLostHours) })).sort((a, b) => b.hours - a.hours),
    teamRows: [...teamMap.values()].map((row) => ({ ...row, hours: round(row.hours), winterHours: round(row.winterHours) })).sort((a, b) => b.hours - a.hours),
    grantNarratives,
  });
}
