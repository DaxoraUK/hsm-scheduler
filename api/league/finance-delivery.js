import { json, methodNotAllowed, readJson } from "../../server/communications/http.js";
import { serviceRpc, userRpc, verifySupabaseUser } from "../../server/communications/supabase.js";
import { deliverLeagueFinanceDocument } from "../../server/finance/delivery.js";

export async function POST(request) {
  let prepared = null;
  try {
    const { token } = await verifySupabaseUser(request);
    const body = await readJson(request);
    const leagueId = String(body?.leagueId || "").trim();
    const invoiceId = String(body?.invoiceId || "").trim();
    const deliveryKind = String(body?.deliveryKind || "invoice").trim().toLowerCase();
    if (!leagueId || !invoiceId) return json({ error: "League and invoice identifiers are required.", code: "FINANCE_DELIVERY_CONTEXT_REQUIRED" }, 400);
    if (!["invoice", "reminder"].includes(deliveryKind)) return json({ error: "Invalid finance delivery type.", code: "FINANCE_DELIVERY_TYPE_INVALID" }, 400);
    prepared = await userRpc(token, "prepare_league_finance_delivery", { target_league_id: leagueId, target_invoice_id: invoiceId, requested_kind: deliveryKind });
    const result = await deliverLeagueFinanceDocument(prepared);
    await serviceRpc("complete_league_finance_delivery", { target_delivery_id: result.deliveryId, next_status: "delivered", provider_name: result.provider || "resend", provider_reference_value: result.reference || "", error_message_value: "" });
    return json(result, 200);
  } catch (error) {
    if (prepared?.delivery_id || prepared?.deliveryId) {
      try {
        await serviceRpc("complete_league_finance_delivery", { target_delivery_id: prepared.delivery_id || prepared.deliveryId, next_status: "failed", provider_name: "resend", provider_reference_value: "", error_message_value: error?.message || "Finance delivery failed." });
      } catch {
        // Keep the original delivery error as the response.
      }
    }
    return json({ error: error?.message || "The finance document could not be delivered.", code: error?.code || "FINANCE_DELIVERY_FAILED" }, Number(error?.status) || 500);
  }
}

export function GET() { return methodNotAllowed("POST"); }
