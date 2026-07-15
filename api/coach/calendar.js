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

function buildCalendar(payload = {}) {
  const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
  const now = icsDate(new Date());
  const events = bookings.map((booking) => {
    const start = icsDate(booking.start_at || booking.startAt);
    const end = icsDate(booking.end_at || booking.endAt);
    if (!start || !end) return "";
    const title = booking.title || [booking.team_name || booking.teamName, booking.booking_type || booking.bookingType].filter(Boolean).join(" · ") || "Team booking";
    const location = [booking.venue_name || booking.venueName, booking.pitch_name || booking.pitchName].filter(Boolean).join(" · ");
    const description = [booking.opponent_name || booking.opponentName ? `Opponent: ${booking.opponent_name || booking.opponentName}` : "", booking.booking_reference || booking.bookingReference ? `Reference: ${booking.booking_reference || booking.bookingReference}` : ""].filter(Boolean).join("\\n");
    return [
      "BEGIN:VEVENT",
      `UID:${icsEscape(booking.id || crypto.randomUUID())}@daxora.co.uk`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(title)}`,
      location ? `LOCATION:${icsEscape(location)}` : "",
      description ? `DESCRIPTION:${icsEscape(description)}` : "",
      "END:VEVENT",
    ].filter(Boolean).join("\r\n");
  }).filter(Boolean);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daxora//Coach Hub//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(payload.label || `${payload.club_name || "Daxora"} team calendar`)}`,
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
