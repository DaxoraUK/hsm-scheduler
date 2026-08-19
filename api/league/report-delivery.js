import { json, methodNotAllowed, readJson } from "../../server/communications/http.js";
import { userRpc, verifySupabaseUser } from "../../server/communications/supabase.js";
import { processLeagueReportRun } from "../../server/reports/processor.js";

export async function POST(request) {
  try {
    const { token } = await verifySupabaseUser(request);
    const body = await readJson(request);
    const leagueId = String(body?.leagueId || "").trim();
    const runId = String(body?.runId || "").trim();
    if (!leagueId || !runId) return json({ error: "League and report-run identifiers are required.", code: "REPORT_RUN_CONTEXT_REQUIRED" }, 400);
    const run = await userRpc(token, "claim_league_report_delivery", { target_league_id: leagueId, target_run_id: runId });
    if (!run?.id) return json({ error: "The report run is already processing or is not ready.", code: "REPORT_RUN_NOT_CLAIMED" }, 409);
    const result = await processLeagueReportRun(run);
    const status = result.status === "delivered" ? 200 : result.status === "queued" ? 202 : 502;
    return json(result, status);
  } catch (error) {
    return json({ error: error?.message || "The report could not be delivered.", code: error?.code || "REPORT_DELIVERY_FAILED" }, Number(error?.status) || 500);
  }
}

export function GET() { return methodNotAllowed("POST"); }
