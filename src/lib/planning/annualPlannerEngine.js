const ACTIVE_BOOKING_STATUSES = new Set(["requested", "provisional", "confirmed"]);

export const ANNUAL_BOOKING_TYPES = Object.freeze([
  { value: "training", label: "Training" },
  { value: "friendly", label: "Friendly" },
  { value: "camp", label: "Camp / clinic" },
  { value: "tournament", label: "Tournament" },
  { value: "meeting", label: "Meeting / event" },
  { value: "maintenance", label: "Maintenance" },
  { value: "external_hire", label: "External hire" },
]);

export const ANNUAL_BOOKING_STATUSES = Object.freeze([
  { value: "requested", label: "Requested" },
  { value: "provisional", label: "Provisional" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
]);

export const RECURRENCE_OPTIONS = Object.freeze([
  { value: "none", label: "One-off" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Every two weeks" },
]);

function clean(value) {
  return String(value ?? "").trim();
}

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

export function normaliseDateKey(value, fallback = "") {
  const raw = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function normaliseTime(value, fallback = "18:00") {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return `${pad(hours)}:${pad(minutes)}`;
}

export function timeToMinutes(value, fallback = 0) {
  const match = normaliseTime(value, "00:00").match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

export function localDateTime(dateKey, time) {
  const date = normaliseDateKey(dateKey);
  const safeTime = normaliseTime(time);
  if (!date) return null;
  const result = new Date(`${date}T${safeTime}:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function bookingDurationMinutes(booking = {}) {
  const start = new Date(booking.startAt || booking.start_at || 0);
  const end = new Date(booking.endAt || booking.end_at || 0);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }
  const startMinutes = timeToMinutes(booking.startTime || booking.start_time);
  const endMinutes = timeToMinutes(booking.endTime || booking.end_time, startMinutes + 60);
  return Math.max(15, endMinutes - startMinutes);
}

export function normaliseAnnualBooking(row = {}) {
  const startAt = row.start_at || row.startAt || null;
  const endAt = row.end_at || row.endAt || null;
  const startDate = normaliseDateKey(row.start_date || row.startDate || startAt);
  const startTime = normaliseTime(row.start_time || row.startTime || (startAt ? new Date(startAt).toTimeString().slice(0, 5) : "18:00"));
  const endTime = normaliseTime(row.end_time || row.endTime || (endAt ? new Date(endAt).toTimeString().slice(0, 5) : "19:30"), "19:30");
  return Object.freeze({
    id: clean(row.id),
    clubId: clean(row.club_id || row.clubId),
    seriesId: clean(row.series_id || row.seriesId),
    title: clean(row.title) || "Pitch booking",
    bookingType: clean(row.booking_type || row.bookingType || "training").toLowerCase(),
    status: clean(row.status || "provisional").toLowerCase(),
    teamKey: clean(row.team_key || row.teamKey),
    teamName: clean(row.team_name || row.teamName),
    opponentName: clean(row.opponent_name || row.opponentName),
    venueId: clean(row.venue_id || row.venueId),
    venueName: clean(row.venue_name || row.venueName),
    pitchId: clean(row.pitch_id || row.pitchId),
    pitchName: clean(row.pitch_name || row.pitchName),
    startAt: startAt ? new Date(startAt).toISOString() : localDateTime(startDate, startTime)?.toISOString() || null,
    endAt: endAt ? new Date(endAt).toISOString() : localDateTime(startDate, endTime)?.toISOString() || null,
    startDate,
    startTime,
    endTime,
    recurrence: clean(row.recurrence || "none").toLowerCase(),
    recurrenceUntil: normaliseDateKey(row.recurrence_until || row.recurrenceUntil),
    exceptionDates: normaliseExceptionDates(row.exception_dates || row.exceptionDates || []),
    holidayPolicy: clean(row.holiday_policy || row.holidayPolicy || "include").toLowerCase(),
    financeStatus: clean(row.finance_status || row.financeStatus || "unreconciled").toLowerCase(),
    financeReference: clean(row.finance_reference || row.financeReference),
    costPence: Math.max(0, Math.round(finite(row.cost_pence ?? row.costPence, 0))),
    supplierReference: clean(row.supplier_reference || row.supplierReference),
    bookingReference: clean(row.booking_reference || row.bookingReference),
    contactName: clean(row.contact_name || row.contactName),
    contactEmail: clean(row.contact_email || row.contactEmail),
    notes: clean(row.notes),
    sourceType: clean(row.source_type || row.sourceType || "annual_planner"),
    sourceId: clean(row.source_id || row.sourceId),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  });
}

export function normaliseAnnualBlackout(row = {}) {
  const startAt = row.start_at || row.startAt || null;
  const endAt = row.end_at || row.endAt || null;
  return Object.freeze({
    id: clean(row.id),
    clubId: clean(row.club_id || row.clubId),
    title: clean(row.title) || "Unavailable",
    closureType: clean(row.closure_type || row.closureType || "blackout").toLowerCase(),
    visibility: clean(row.visibility || "club").toLowerCase(),
    venueId: clean(row.venue_id || row.venueId),
    venueName: clean(row.venue_name || row.venueName),
    pitchId: clean(row.pitch_id || row.pitchId),
    pitchName: clean(row.pitch_name || row.pitchName),
    startAt,
    endAt,
    startDate: normaliseDateKey(startAt),
    endDate: normaliseDateKey(endAt),
    startTime: normaliseTime(row.start_time || row.startTime || clean(startAt).slice(11, 16), "00:00"),
    endTime: normaliseTime(row.end_time || row.endTime || clean(endAt).slice(11, 16), "23:59"),
    reason: clean(row.reason),
    publicNote: clean(row.public_note || row.publicNote || row.reason),
    internalNote: clean(row.internal_note || row.internalNote),
    affectedBookingCount: Math.max(0, Math.round(finite(row.affected_booking_count ?? row.affectedBookingCount, 0))),
    createdAt: row.created_at || row.createdAt || null,
  });
}

export function annualBookingToPayload(booking = {}) {
  const normalised = normaliseAnnualBooking(booking);
  return {
    booking_id: normalised.id || null,
    title: normalised.title,
    booking_type: normalised.bookingType,
    status: normalised.status,
    team_key: normalised.teamKey || null,
    team_name: normalised.teamName || null,
    opponent_name: normalised.opponentName || null,
    venue_id: normalised.venueId || null,
    venue_name: normalised.venueName || null,
    pitch_id: normalised.pitchId || null,
    pitch_name: normalised.pitchName || null,
    start_at: normalised.startAt,
    end_at: normalised.endAt,
    series_id: normalised.seriesId || null,
    recurrence: normalised.recurrence,
    recurrence_until: normalised.recurrenceUntil || null,
    exception_dates: normalised.exceptionDates,
    holiday_policy: normalised.holidayPolicy || "include",
    finance_status: normalised.financeStatus || "unreconciled",
    finance_reference: normalised.financeReference || null,
    cost_pence: normalised.costPence,
    supplier_reference: normalised.supplierReference || null,
    booking_reference: normalised.bookingReference || null,
    contact_name: normalised.contactName || null,
    contact_email: normalised.contactEmail || null,
    notes: normalised.notes || null,
    source_type: normalised.sourceType || "annual_planner",
    source_id: normalised.sourceId || null,
  };
}

function addDays(dateKey, days) {
  const date = localDateTime(dateKey, "12:00");
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return normaliseDateKey(date);
}

export function normaliseExceptionDates(value) {
  const values = Array.isArray(value) ? value : clean(value).split(/[\s,;]+/g);
  return [...new Set(values.map((row) => normaliseDateKey(row)).filter(Boolean))].sort();
}

export function expandRecurringBookingDraft(draft = {}, { maximumOccurrences = 120 } = {}) {
  const startDate = normaliseDateKey(draft.startDate || draft.start_date);
  const startTime = normaliseTime(draft.startTime || draft.start_time, "18:00");
  const endTime = normaliseTime(draft.endTime || draft.end_time, "19:30");
  const recurrence = clean(draft.recurrence || "none").toLowerCase();
  const recurrenceUntil = normaliseDateKey(draft.recurrenceUntil || draft.recurrence_until || startDate);
  const stepDays = recurrence === "weekly" ? 7 : recurrence === "fortnightly" ? 14 : 0;
  const seriesId = clean(draft.seriesId || draft.series_id) || (stepDays ? `series_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : "");
  const exceptionDates = new Set(normaliseExceptionDates(draft.exceptionDates || draft.exception_dates || draft.exceptionDatesText || draft.exception_dates_text || []));
  const results = [];
  let currentDate = startDate;

  if (!startDate) return results;

  while (currentDate && results.length < maximumOccurrences) {
    const start = localDateTime(currentDate, startTime);
    let end = localDateTime(currentDate, endTime);
    if (!start || !end) break;
    if (end <= start) {
      end = new Date(end);
      end.setDate(end.getDate() + 1);
    }
    if (!exceptionDates.has(currentDate)) {
      results.push(normaliseAnnualBooking({
        ...draft,
        id: "",
        seriesId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        startDate: currentDate,
        startTime,
        endTime,
        recurrence,
        recurrenceUntil,
        exceptionDates: [...exceptionDates],
      }));
    }
    if (!stepDays || currentDate >= recurrenceUntil) break;
    const nextDate = addDays(currentDate, stepDays);
    if (!nextDate || nextDate > recurrenceUntil) break;
    currentDate = nextDate;
  }
  return results;
}

function activeBooking(booking = {}) {
  return ACTIVE_BOOKING_STATUSES.has(clean(booking.status || "confirmed").toLowerCase());
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function bookingInterval(booking = {}) {
  const start = new Date(booking.startAt || booking.start_at || 0);
  const end = new Date(booking.endAt || booking.end_at || 0);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return { start, end };
}

export function detectAnnualPlannerConflicts(candidate = {}, { bookings = [], blackouts = [], matchdayBookings = [], pitches = [], ignoreId = "" } = {}) {
  const normalised = normaliseAnnualBooking(candidate);
  const interval = bookingInterval(normalised);
  if (!interval) {
    return [{ type: "invalid_time", severity: "danger", title: "Invalid booking time", message: "Choose a valid start and finish time." }];
  }

  const conflicts = [];
  const resources = [...bookings, ...matchdayBookings]
    .map(normaliseAnnualBooking)
    .filter((booking) => booking.id !== ignoreId && activeBooking(booking));

  const overlapping = resources.filter((booking) => {
    const existing = bookingInterval(booking);
    return existing && intervalsOverlap(interval.start, interval.end, existing.start, existing.end);
  });

  if (normalised.pitchId) {
    const samePitch = overlapping.filter((booking) => booking.pitchId && booking.pitchId === normalised.pitchId);
    const pitch = (Array.isArray(pitches) ? pitches : []).find((row) => clean(row.id) === normalised.pitchId) || null;
    const trainingCapacity = Math.max(1, Math.min(20, finite(pitch?.trainingCapacity ?? pitch?.training_capacity ?? 1, 1)));
    const trainingOnly = normalised.bookingType === "training" && samePitch.every((booking) => booking.bookingType === "training");
    const capacityManaged = trainingOnly && !!pitch;
    const full = trainingOnly ? samePitch.length >= trainingCapacity : samePitch.length > 0;
    if (full) {
      const booking = samePitch[0];
      conflicts.push({
        type: capacityManaged ? "pitch_training_capacity" : "pitch_double_booking",
        severity: "danger",
        booking,
        title: capacityManaged ? "Pitch training capacity reached" : "Pitch already booked",
        message: capacityManaged
          ? `${normalised.pitchName || normalised.pitchId} already has ${samePitch.length} of ${trainingCapacity} training team${trainingCapacity === 1 ? "" : "s"} in this slot.`
          : `${booking?.title || "Another booking"} already uses ${booking?.pitchName || booking?.pitchId || normalised.pitchId} at this time.`,
      });
    }
  }

  overlapping.forEach((booking) => {
    const sameTeam = normalised.teamKey && booking.teamKey && normalised.teamKey === booking.teamKey;
    if (sameTeam) {
      conflicts.push({
        type: "team_double_booking",
        severity: "danger",
        booking,
        title: "Team already committed",
        message: `${booking.teamName || "This team"} already has ${booking.title} at this time.`,
      });
    }
  });

  blackouts.map(normaliseAnnualBlackout).forEach((blackout) => {
    const start = new Date(blackout.startAt || 0);
    const end = new Date(blackout.endAt || 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    const samePitch = !blackout.pitchId || !normalised.pitchId || blackout.pitchId === normalised.pitchId;
    const sameVenue = !blackout.venueId || !normalised.venueId || blackout.venueId === normalised.venueId;
    if (samePitch && sameVenue && intervalsOverlap(interval.start, interval.end, start, end)) {
      conflicts.push({
        type: "blackout",
        severity: "danger",
        blackout,
        title: "Facility unavailable",
        message: blackout.reason || blackout.title || "This pitch is unavailable during the selected time.",
      });
    }
  });

  return conflicts;
}

export function matchdayFixtureToAnnualBooking(fixture = {}, { date = "", pitchCfg = [], sourceType = "matchday" } = {}) {
  const dateKey = normaliseDateKey(date || fixture.date || fixture.fixtureDate);
  if (!dateKey) return null;
  const startMinutes = finite(fixture.koMins, timeToMinutes(fixture.koTime || fixture.ko || "09:00"));
  const duration = Math.max(15, finite(fixture.endMins, startMinutes + finite(fixture.cfg?.gameMins, 90) + finite(fixture.cfg?.bufferMins, 30)) - startMinutes);
  const endMinutes = startMinutes + duration;
  const pitch = pitchCfg.find((row) => clean(row.id) === clean(fixture.pitchId));
  const startAt = localDateTime(dateKey, `${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}`);
  const endAt = localDateTime(dateKey, `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`);
  if (!startAt || !endAt) return null;
  if (endMinutes >= 24 * 60) endAt.setDate(endAt.getDate() + 1);
  return normaliseAnnualBooking({
    id: `matchday_${clean(fixture.id || fixture.fixtureId || `${dateKey}_${fixture.pitchId}_${startMinutes}`)}`,
    title: `${fixture.homeTeam || fixture.team || "Home"} vs ${fixture.awayTeam || "TBC"}`,
    bookingType: "match",
    status: "confirmed",
    teamKey: fixture.cfg?.id || fixture.teamId || fixture.homeTeam || fixture.team || "",
    teamName: fixture.homeTeam || fixture.team || "",
    opponentName: fixture.awayTeam || "",
    pitchId: fixture.pitchId || "",
    pitchName: fixture.pitchLabel || pitch?.label || fixture.pitchId || "",
    venueId: fixture.venueId || pitch?.siteId || "",
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    sourceType,
    sourceId: clean(fixture.id || fixture.fixtureId),
  });
}

export function buildAnnualPlannerSnapshot({ bookings = [], blackouts = [], year = new Date().getFullYear() } = {}) {
  const rows = bookings.map(normaliseAnnualBooking).filter((booking) => Number(booking.startDate.slice(0, 4)) === Number(year));
  const active = rows.filter(activeBooking);
  const requested = rows.filter((booking) => booking.status === "requested");
  const confirmed = rows.filter((booking) => booking.status === "confirmed");
  const friendlies = active.filter((booking) => booking.bookingType === "friendly");
  const hours = active.reduce((sum, booking) => sum + bookingDurationMinutes(booking) / 60, 0);
  const costPence = active.reduce((sum, booking) => sum + booking.costPence, 0);
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index,
    count: 0,
    hours: 0,
    costPence: 0,
  }));
  active.forEach((booking) => {
    const month = Number(booking.startDate.slice(5, 7)) - 1;
    if (months[month]) {
      months[month].count += 1;
      months[month].hours += bookingDurationMinutes(booking) / 60;
      months[month].costPence += booking.costPence;
    }
  });
  return Object.freeze({
    year: Number(year),
    bookings: rows,
    active,
    blackouts: blackouts.map(normaliseAnnualBlackout),
    metrics: Object.freeze({
      total: rows.length,
      active: active.length,
      confirmed: confirmed.length,
      requested: requested.length,
      friendlies: friendlies.length,
      hours: Math.round(hours * 10) / 10,
      costPence,
    }),
    months,
  });
}

export function buildMonthCalendar(year, month, bookings = []) {
  const first = new Date(Number(year), Number(month), 1, 12);
  const last = new Date(Number(year), Number(month) + 1, 0, 12);
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells = [];
  for (let offset = -mondayIndex; offset < last.getDate() + (7 - ((mondayIndex + last.getDate()) % 7 || 7)); offset += 1) {
    const date = new Date(Number(year), Number(month), offset + 1, 12);
    const dateKey = normaliseDateKey(date);
    cells.push({
      date,
      dateKey,
      inMonth: date.getMonth() === Number(month),
      today: dateKey === normaliseDateKey(new Date()),
      bookings: bookings.map(normaliseAnnualBooking).filter((booking) => booking.startDate === dateKey).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    });
  }
  return cells;
}

export function findAnnualPlannerSuggestions(candidate = {}, context = {}, { limit = 4 } = {}) {
  const normalised = normaliseAnnualBooking(candidate);
  const duration = bookingDurationMinutes(normalised);
  const pitchIds = (context.pitches || []).map((pitch) => clean(pitch.id)).filter(Boolean);
  const startingMinutes = timeToMinutes(normalised.startTime);
  const suggestions = [];
  const dateOffsets = [0, 1, -1, 7, -7, 14];
  const timeOffsets = [0, 30, -30, 60, -60, 90];

  for (const dateOffset of dateOffsets) {
    const dateKey = addDays(normalised.startDate, dateOffset);
    if (!dateKey) continue;
    for (const pitchId of [normalised.pitchId, ...pitchIds].filter((value, index, all) => value && all.indexOf(value) === index)) {
      for (const timeOffset of timeOffsets) {
        const startMinutes = Math.max(6 * 60, Math.min(22 * 60, startingMinutes + timeOffset));
        const startTime = `${pad(Math.floor(startMinutes / 60))}:${pad(startMinutes % 60)}`;
        const endMinutes = startMinutes + duration;
        const endTime = `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`;
        const draft = normaliseAnnualBooking({ ...normalised, startDate: dateKey, startTime, endTime, startAt: null, endAt: null, pitchId });
        const conflicts = detectAnnualPlannerConflicts(draft, context);
        if (!conflicts.length) {
          const pitch = (context.pitches || []).find((row) => clean(row.id) === pitchId);
          suggestions.push({ ...draft, pitchName: pitch?.label || pitch?.name || draft.pitchName || pitchId });
          if (suggestions.length >= limit) return suggestions;
        }
      }
    }
  }
  return suggestions;
}

export function buildAnnualPlannerCsv(bookings = [], { includeCosts = true } = {}) {
  const headings = ["Date", "Start", "End", "Type", "Status", "Team", "Opponent", "Venue", "Pitch", "Title"];
  if (includeCosts) headings.push("Cost");
  headings.push("Reference", "Contact", "Contact email", "Notes");
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = bookings.map(normaliseAnnualBooking).sort((a, b) => `${a.startDate}${a.startTime}`.localeCompare(`${b.startDate}${b.startTime}`));
  return [headings, ...rows.map((booking) => {
    const row = [
      booking.startDate,
      booking.startTime,
      booking.endTime,
      booking.bookingType,
      booking.status,
      booking.teamName,
      booking.opponentName,
      booking.venueName,
      booking.pitchName,
      booking.title,
    ];
    if (includeCosts) row.push((booking.costPence / 100).toFixed(2));
    row.push(
      booking.bookingReference || booking.supplierReference,
      booking.contactName,
      booking.contactEmail,
      booking.notes,
    );
    return row;
  })].map((row) => row.map(escape).join(",")).join("\n");
}
