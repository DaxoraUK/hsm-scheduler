import { json, methodNotAllowed } from "../../../server/communications/http.js";
import { serviceRpc } from "../../../server/communications/supabase.js";
import { mapTwilioStatus, verifyTwilioWebhook } from "../../../server/communications/webhooks.js";

export async function POST(request) {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!verifyTwilioWebhook(request.url, params, signature)) {
    return json({ error: "Invalid webhook signature", code: "INVALID_WEBHOOK_SIGNATURE" }, 401);
  }

  const providerReference = params.get("MessageSid");
  const providerStatus = params.get("MessageStatus");
  const nextStatus = mapTwilioStatus(providerStatus);
  if (!providerReference || !nextStatus) return json({ ok: true, ignored: true });

  await serviceRpc("update_communication_delivery_from_provider", {
    p_provider_name: "twilio",
    p_provider_reference: providerReference,
    p_next_status: nextStatus,
    p_error_code: params.get("ErrorCode") || null,
    p_error_message: params.get("ErrorMessage") || null,
    p_provider_detail: { rawStatus: providerStatus || null },
  });
  return json({ ok: true });
}

export function GET() {
  return methodNotAllowed("POST");
}
