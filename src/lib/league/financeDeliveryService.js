import { Auth } from "../supabase.js";

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return { error: text }; }
}

export async function deliverLeagueFinanceDocument({ leagueId, invoiceId, deliveryKind = "invoice" }) {
  const session = await Auth.getValidSession();
  if (!session?.access_token) throw new Error("Sign in again to send finance documents.");
  const response = await fetch("/api/league/finance-delivery", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ leagueId, invoiceId, deliveryKind }),
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || "The finance document could not be delivered."), {
      code: payload?.code || "FINANCE_DELIVERY_FAILED",
      detail: payload,
    });
  }
  return payload;
}
