function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeKey(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(11, 16);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function normaliseCoachBlackout(row = {}) {
  const startAt = row.start_at || row.startAt || null;
  const endAt = row.end_at || row.endAt || null;
  return {
    id: text(row.id),
    kind: "blackout",
    title: text(row.title || "Club blackout"),
    closureType: text(row.closure_type || row.closureType || "blackout"),
    venueId: text(row.venue_id || row.venueId),
    venueName: text(row.venue_name || row.venueName),
    pitchId: text(row.pitch_id || row.pitchId),
    pitchName: text(row.pitch_name || row.pitchName),
    startAt,
    endAt,
    startDate: dateKey(startAt),
    endDate: dateKey(endAt),
    startTime: timeKey(startAt),
    endTime: timeKey(endAt),
    publicNote: text(row.public_note || row.publicNote || row.reason),
    visibility: text(row.visibility || "club"),
    affectedBookingCount: number(row.affected_booking_count ?? row.affectedBookingCount),
  };
}

export function normaliseCoachPitchClosure(row = {}) {
  const startDate = dateKey(row.effective_from || row.effectiveFrom || row.start_date || row.startDate);
  const untilReopened = Boolean(row.until_reopened ?? row.untilReopened ?? String(row.mode || "").toLowerCase() === "untilreopened");
  const endDate = untilReopened ? "9999-12-31" : dateKey(row.effective_to || row.effectiveTo || startDate);
  const startAt = startDate ? `${startDate}T00:00:00` : null;
  const endAt = endDate ? `${endDate}T23:59:59` : null;
  return {
    id: text(row.id),
    kind: "pitch_closure",
    title: text(row.title || row.reason || "Pitch closed"),
    pitchId: text(row.pitch_id || row.pitchId),
    pitchName: text(row.pitch_name || row.pitchName),
    startAt,
    endAt,
    startDate,
    endDate,
    startTime: "00:00",
    endTime: "23:59",
    publicNote: text(row.public_note || row.publicNote || row.reason || row.notes),
    untilReopened,
    mode: text(row.mode || (untilReopened ? "untilReopened" : "range")),
  };
}

export function normaliseAvailabilityResult(payload = {}) {
  const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives : [];
  const reasons = Array.isArray(payload.reasons) ? payload.reasons : [];
  return {
    status: text(payload.status || (payload.available ? "available" : "unavailable")),
    available: Boolean(payload.available),
    advisory: Boolean(payload.advisory),
    capacity: Math.max(1, number(payload.capacity, 1)),
    usedCapacity: Math.max(0, number(payload.used_capacity ?? payload.usedCapacity, 0)),
    remainingCapacity: Math.max(0, number(payload.remaining_capacity ?? payload.remainingCapacity, 0)),
    reasons,
    alternatives: alternatives.map((row) => ({
      pitchId: text(row.pitch_id || row.pitchId),
      pitchName: text(row.pitch_name || row.pitchName),
      venueId: text(row.venue_id || row.venueId),
      venueName: text(row.venue_name || row.venueName),
      startAt: row.start_at || row.startAt || null,
      endAt: row.end_at || row.endAt || null,
      startDate: dateKey(row.start_at || row.startAt),
      startTime: timeKey(row.start_at || row.startAt),
      endTime: timeKey(row.end_at || row.endAt),
      remainingCapacity: Math.max(0, number(row.remaining_capacity ?? row.remainingCapacity, 0)),
    })),
  };
}

export function buildCoachCalendarEvents(workspace = {}) {
  const bookings = (Array.isArray(workspace.bookings) ? workspace.bookings : []).map((row) => ({
    ...row,
    kind: "booking",
    calendarStatus: row.status,
    pitchAreaId: text(row.pitchAreaId || row.pitch_area_id),
    pitchAreaName: text(row.pitchAreaName || row.pitch_area_name),
  }));
  const requests = (Array.isArray(workspace.requests) ? workspace.requests : [])
    .filter((row) => ["submitted", "needs_information", "alternative_offered", "accepted"].includes(row.status))
    .map((row) => ({
      id: `request-${row.id}`,
      requestId: row.id,
      kind: "request",
      title: row.title,
      teamKey: row.teamKey,
      teamName: row.teamName,
      pitchId: row.preferredPitchId,
      pitchName: row.preferredPitchName,
      pitchAreaId: row.preferredPitchAreaId,
      pitchAreaName: row.preferredPitchAreaName,
      venueId: row.preferredVenueId,
      venueName: row.preferredVenueName,
      startAt: row.preferredStartAt,
      endAt: row.preferredEndAt,
      startDate: row.preferredDate,
      startTime: row.preferredStartTime,
      endTime: row.preferredEndTime,
      status: row.status,
      calendarStatus: row.status,
      requestType: row.requestType,
    }));
  const blackouts = (Array.isArray(workspace.blackouts) ? workspace.blackouts : []).map(normaliseCoachBlackout);
  const closures = (Array.isArray(workspace.pitchClosures) ? workspace.pitchClosures : []).map(normaliseCoachPitchClosure);
  return [...bookings, ...requests, ...blackouts, ...closures]
    .filter((row) => row.startAt || row.startDate)
    .sort((a, b) => new Date(a.startAt || `${a.startDate}T00:00:00`) - new Date(b.startAt || `${b.startDate}T00:00:00`));
}

export function eventOccursOnDate(event, targetDate) {
  const date = dateKey(targetDate);
  if (!date) return false;
  const start = event.startDate || dateKey(event.startAt);
  const end = event.endDate || dateKey(event.endAt) || start;
  return Boolean(start && start <= date && date <= end);
}

export function buildCoachMonthCalendar(year, month, events = []) {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const today = dateKey(new Date());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    return {
      date,
      dateKey: key,
      inMonth: date.getMonth() === month,
      today: key === today,
      events: events.filter((event) => eventOccursOnDate(event, key)),
    };
  });
}

export function calendarEventTone(event = {}) {
  if (event.kind === "blackout" || event.kind === "pitch_closure") return "border-rose-200 bg-rose-50 text-rose-800";
  if (event.kind === "request") return "border-amber-200 bg-amber-50 text-amber-800";
  if (event.bookingType === "friendly" || event.bookingType === "match") return "border-sky-200 bg-sky-50 text-sky-800";
  if (["confirmed", "approved"].includes(event.status)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-violet-200 bg-violet-50 text-violet-800";
}

export function calendarEventLabel(event = {}) {
  if (event.kind === "pitch_closure") return "Pitch closure";
  if (event.kind === "blackout") return "Blackout";
  if (event.kind === "request") return "Pending request";
  return event.bookingType || "Booking";
}
