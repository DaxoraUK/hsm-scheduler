import { methodNotAllowed } from "../../server/communications/http.js";
import { serviceRpc } from "../../server/communications/supabase.js";

function icsEscape(value = "") {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function closureDate(value, endOfDay = false) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return icsDate(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  return icsDate(raw);
}

function calendarEvent({ id, startAt, endAt, title, location = "", description = "", now }) {
  const start = icsDate(startAt);
  const end = icsDate(endAt);
  if (!start || !end) return "";
  return [
    "BEGIN:VEVENT",
    `UID:${icsEscape(id || crypto.randomUUID())}@daxora.co.uk`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(title)}`,
    location ? `LOCATION:${icsEscape(location)}` : "",
    description ? `DESCRIPTION:${icsEscape(description)}` : "",
    "END:VEVENT",
  ].filter(Boolean).join("\r\n");
}

function buildCalendar(payload = {}) {
  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const blackouts = Array.isArray(payload.blackouts) ? payload.blackouts : [];
  const pitchClosures = Array.isArray(payload.pitch_closures || payload.pitchClosures) ? payload.pitch_closures || payload.pitchClosures : [];
  const now = icsDate(new Date());

  const bookingEvents = bookings.map((booking) => calendarEvent({
    id: booking.id,
    startAt: booking.start_at || booking.startAt,
    endAt: booking.end_at || booking.endAt,
    title: booking.title || [booking.team_name || booking.teamName, booking.booking_type || booking.bookingType].filter(Boolean).join(" · ") || "Team booking",
    location: [booking.venue_name || booking.venueName, booking.pitch_name || booking.pitchName, booking.pitch_area_name || booking.pitchAreaName].filter(Boolean).join(" · "),
    description: [
      booking.opponent_name || booking.opponentName ? `Opponent: ${booking.opponent_name || booking.opponentName}` : "",
      booking.booking_reference || booking.bookingReference ? `Reference: ${booking.booking_reference || booking.bookingReference}` : "",
    ].filter(Boolean).join("\n"),
    now,
  }));

  const blackoutEvents = blackouts.map((blackout) => calendarEvent({
    id: `blackout-${blackout.id || crypto.randomUUID()}`,
    startAt: blackout.start_at || blackout.startAt,
    endAt: blackout.end_at || blackout.endAt,
    title: `UNAVAILABLE · ${blackout.title || "Club blackout"}`,
    location: [blackout.venue_name || blackout.venueName, blackout.pitch_name || blackout.pitchName].filter(Boolean).join(" · "),
    description: blackout.public_note || blackout.publicNote || blackout.reason || "This facility period is unavailable.",
    now,
  }));

  const closureEvents = pitchClosures.map((closure) => {
    const data = closure.data && typeof closure.data === "object" ? closure.data : closure;
    const startDate = data.effectiveFrom || data.effective_from || data.date || data.startDate || data.start_date;
    const untilReopened = Boolean(data.untilReopened || data.until_reopened || String(data.mode || "").toLowerCase() === "untilreopened");
    const endDate = untilReopened ? startDate : data.effectiveTo || data.effective_to || data.endDate || data.end_date || startDate;
    const startAt = closureDate(startDate);
    const endAt = closureDate(endDate, true);
    return calendarEvent({
      id: `pitch-closure-${data.id || closure.id || crypto.randomUUID()}`,
      startAt,
      endAt,
      title: `PITCH CLOSED · ${data.pitch_name || data.pitchName || data.title || data.pitch_id || data.pitchId || "Facility"}`,
      location: data.pitch_name || data.pitchName || data.pitch_id || data.pitchId || "",
      description: data.public_note || data.publicNote || data.reason || data.notes || (untilReopened ? "Closed until the club confirms reopening." : "This pitch is unavailable."),
      now,
    });
  });

  const events = [...bookingEvents, ...blackoutEvents, ...closureEvents].filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daxora//Coach Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(payload.label || `${payload.club_name || "Daxora"} shared team calendar`)}`,
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    if (!token.trim()) return new Response("Calendar token is required.", { status: 400 });
    const payload = await serviceRpc("get_coach_hub_calendar_by_token", { feed_token: token.trim() });
    const calendar = buildCalendar(payload || {});
    return new Response(calendar, {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": "inline; filename=coach-hub-calendar.ics",
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    return new Response(error?.message || "Calendar feed unavailable.", { status: Number(error?.status) || 404 });
  }
}

export function POST() {
  return methodNotAllowed("GET");
}
