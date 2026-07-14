import { serviceRpc } from "../communications/supabase.js";
import { pushDaxoraUsers } from "../notifications/webPush.js";
import { deliverLeagueReport } from "./delivery.js";

function transientRetryMinutes(error = {}) {
  const status = Number(error.status || 0);
  if (status === 429) return 30;
  if (status >= 500 && status < 600 && !["EMAIL_PROVIDER_NOT_CONFIGURED", "VAPID_NOT_CONFIGURED"].includes(error.code)) return 15;
  return null;
}

export async function processLeagueReportRun(run = {}) {
  try {
    const result = await deliverLeagueReport(run);
    const completion = await serviceRpc("complete_league_report_delivery", {
      target_run_id: run.id,
      next_status: "delivered",
      provider_name: result.provider,
      provider_reference: result.reference,
      failure_code: null,
      failure_message: null,
      generated_artifact_name: result.filename,
      retry_after_minutes: null,
    });
    const push = await pushDaxoraUsers(completion?.user_ids || [], { urgency: "normal" }).catch(() => null);
    return { runId: run.id, status: completion?.status || "delivered", provider: result.provider, reference: result.reference, filename: result.filename, push };
  } catch (error) {
    const retryMinutes = transientRetryMinutes(error);
    const completion = await serviceRpc("complete_league_report_delivery", {
      target_run_id: run.id,
      next_status: "failed",
      provider_name: null,
      provider_reference: null,
      failure_code: error?.code || "REPORT_DELIVERY_FAILED",
      failure_message: error?.message || "The report could not be delivered.",
      generated_artifact_name: null,
      retry_after_minutes: retryMinutes,
    });
    const push = await pushDaxoraUsers(completion?.user_ids || [], { urgency: "high" }).catch(() => null);
    return { runId: run.id, status: completion?.status || "failed", error: error?.message, code: error?.code || "REPORT_DELIVERY_FAILED", retryMinutes, push };
  }
}
