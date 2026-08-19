function env(name) {
  return String(process.env[name] || "").trim();
}

function config() {
  return {
    url: (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, ""),
    key: env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY"),
  };
}

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/\r?\n/g, "\\n");
}

function dateValue(date, time = "00:00") {
  const safeDate = String(date || "").replaceAll("-", "");
  const safeTime = String(time || "00:00").slice(0, 5).replace(":", "");
  return `${safeDate}T${safeTime}00`;
}

function addMinutes(date, time, minutes) {
  const value = new Date(`${date}T${String(time || "00:00").slice(0, 5)}:00Z`);
  value.setUTCMinutes(value.getUTCMinutes() + minutes);
  return `${value.toISOString().slice(0, 10).replaceAll("-", "")}T${value.toISOString().slice(11, 19).replaceAll(":", "")}`;
}

function foldLine(line) {
  const chunks = [];
  let rest = String(line || "");
  while (rest.length > 73) {
    chunks.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function buildCalendar(payload) {
  const league = payload?.league || {};
  const feed = payload?.feed || {};
  const fixtures = Array.isArray(payload?.fixtures) ? payload.fixtures : [];
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Daxora//League Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(feed.label || league.name || "League fixtures")}`,
    `X-WR-TIMEZONE:${escapeIcs(league.timezone || "Europe/London")}`,
  ];
  fixtures.forEach((fixture) => {
    if (!fixture?.scheduled_date) return;
    const uid = `${fixture.target_type || "fixture"}-${fixture.id}@daxora-league-manager`;
    const summary = `${fixture.home_team_name || "Home"} v ${fixture.away_team_name || "Away"}`;
    const location = [fixture.venue_name, fixture.venue_address, fixture.venue_postcode].filter(Boolean).join(", ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${escapeIcs(league.timezone || "Europe/London")}:${dateValue(fixture.scheduled_date, fixture.kick_off)}`,
      `DTEND;TZID=${escapeIcs(league.timezone || "Europe/London")}:${addMinutes(fixture.scheduled_date, fixture.kick_off, 120)}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `LOCATION:${escapeIcs(location)}`,
      `DESCRIPTION:${escapeIcs(`Status: ${fixture.status || "scheduled"}`)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const token = String(requestUrl.searchParams.get("token") || "").trim();
  if (!token) return new Response("Calendar token is missing.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const { url, key } = config();
  if (!url || !key) return new Response("Calendar service is not configured.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_league_calendar_feed`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ feed_token: token }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload?.message || payload?.error || "Calendar feed could not be loaded");
    return new Response(buildCalendar(payload), {
      status: 200,
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `inline; filename="${String(payload?.feed?.label || "league-fixtures").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.ics"`,
        "cache-control": "private, max-age=300",
      },
    });
  } catch (error) {
    return new Response(error?.message || "Calendar feed is unavailable.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  }
}
