import { json, methodNotAllowed } from "../../server/communications/http.js";
import { userRpc, verifySupabaseUser } from "../../server/communications/supabase.js";
import { sendPayloadlessPush } from "../../server/notifications/webPush.js";

export async function POST(request) {
  try {
    const { token } = await verifySupabaseUser(request);
    const subscriptions = await userRpc(token, "get_my_daxora_push_subscriptions", {});
    if (!Array.isArray(subscriptions) || !subscriptions.length) return json({ error: "No active browser push subscription was found for this account.", code: "PUSH_SUBSCRIPTION_MISSING" }, 409);
    const summary = { requested: subscriptions.length, sent: 0, expired: 0, failed: 0 };
    for (const subscription of subscriptions) {
      try {
        const result = await sendPayloadlessPush({ ...subscription, auth: subscription.auth_secret }, { respectQuietHours: false, urgency: "high" });
        if (result.status === "accepted") summary.sent += 1;
        else if (result.status === "expired") summary.expired += 1;
      } catch { summary.failed += 1; }
    }
    return json(summary, summary.sent ? 200 : 502);
  } catch (error) {
    return json({ error: error?.message || "The test push could not be sent.", code: error?.code || "PUSH_TEST_FAILED" }, Number(error?.status) || 500);
  }
}

export function GET() { return methodNotAllowed("POST"); }
