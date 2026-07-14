import { Auth } from "../supabase.js";

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return { error: text }; }
}

export async function deliverLeagueReportRun({ leagueId, runId }) {
  const session = await Auth.getValidSession();
  if (!session?.access_token) throw new Error("Sign in again to deliver the report.");
  const response = await fetch("/api/league/report-delivery", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ leagueId, runId }),
  });
  const payload = await responsePayload(response);
  if (!response.ok && payload?.status !== "queued") {
    throw Object.assign(new Error(payload?.error || "The report could not be delivered."), { code: payload?.code || "REPORT_DELIVERY_FAILED", detail: payload });
  }
  return payload;
}
