import * as automationDaily from "../server-api/automation/daily.js";
import * as coachCalendar from "../server-api/coach/calendar.js";
import * as coachInvite from "../server-api/coach/invite.js";
import * as communicationsCapabilities from "../server-api/communications/capabilities.js";
import * as communicationsDispatch from "../server-api/communications/dispatch.js";
import * as resendWebhook from "../server-api/communications/webhooks/resend.js";
import * as twilioWebhook from "../server-api/communications/webhooks/twilio.js";
import * as health from "../server-api/health.js";
import * as leagueCalendar from "../server-api/league/calendar.js";
import * as leagueFinanceDelivery from "../server-api/league/finance-delivery.js";
import * as leagueGeocodeVenues from "../server-api/league/geocode-venues.js";
import * as leagueOfficialResponse from "../server-api/league/official-response.js";
import * as leagueReportDelivery from "../server-api/league/report-delivery.js";
import * as notificationsPushTest from "../server-api/notifications/push-test.js";
import * as plannerCalendar from "../server-api/planner/calendar.js";
import * as weather from "../server-api/weather.js";

const ROUTES = new Map([
  ["/api/automation/daily", automationDaily],
  ["/api/coach/calendar", coachCalendar],
  ["/api/coach/invite", coachInvite],
  ["/api/communications/capabilities", communicationsCapabilities],
  ["/api/communications/dispatch", communicationsDispatch],
  ["/api/communications/webhooks/resend", resendWebhook],
  ["/api/communications/webhooks/twilio", twilioWebhook],
  ["/api/health", health],
  ["/api/league/calendar", leagueCalendar],
  ["/api/league/finance-delivery", leagueFinanceDelivery],
  ["/api/league/geocode-venues", leagueGeocodeVenues],
  ["/api/league/official-response", leagueOfficialResponse],
  ["/api/league/report-delivery", leagueReportDelivery],
  ["/api/notifications/push-test", notificationsPushTest],
  ["/api/planner/calendar", plannerCalendar],
  ["/api/weather", weather],
]);

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function pathname(request) {
  const value = new URL(request.url).pathname.replace(/\/+$/, "");
  return value || "/";
}

async function dispatch(method, request) {
  const path = pathname(request);
  const route = ROUTES.get(path);
  if (!route) return json({ error: "API route not found.", code: "API_ROUTE_NOT_FOUND", path }, 404);

  const handler = route[method];
  if (typeof handler !== "function") {
    return json({ error: `Method ${method} is not allowed for this endpoint.`, code: "METHOD_NOT_ALLOWED", path }, 405);
  }

  return handler(request);
}

export function GET(request) {
  return dispatch("GET", request);
}

export function POST(request) {
  return dispatch("POST", request);
}

export function PUT(request) {
  return dispatch("PUT", request);
}

export function PATCH(request) {
  return dispatch("PATCH", request);
}

export function DELETE(request) {
  return dispatch("DELETE", request);
}

export const __ROUTES = Object.freeze([...ROUTES.keys()]);
