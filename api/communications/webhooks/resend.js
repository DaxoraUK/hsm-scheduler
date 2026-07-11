import { json, methodNotAllowed } from "../../../server/communications/http.js";
import { serviceRpc } from "../../../server/communications/supabase.js";
import { mapResendStatus, verifyResendWebhook } from "../../../server/communications/webhooks.js";

export async function POST(request) {
  const rawBody = await request.text();
  if (!verifyResendWebhook(rawBody, request.headers)) {
    return json({ error: "Invalid webhook signature", code: "INVALID_WEBHOOK_SIGNATURE" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload", code: "INVALID_WEBHOOK_PAYLOAD" }, 400);
  }

  const nextStatus = mapResendStatus(payload?.type);
  const providerReference = payload?.data?.email_id || payload?.data?.id;
  if (!nextStatus || !providerReference) return json({ ok: true, ignored: true });

  await serviceRpc("update_communication_delivery_from_provider", {
    p_provider_name: "resend",
    p_provider_reference: String(providerReference),
    p_next_status: nextStatus,
    p_error_code: payload?.data?.bounce?.type || payload?.data?.failed?.reason || payload?.type || null,
    p_error_message: payload?.data?.bounce?.message || payload?.data?.failed?.reason || null,
    p_provider_detail: { eventType: payload?.type || null },
  });
  return json({ ok: true });
}

export function GET() {
  return methodNotAllowed("POST");
}
