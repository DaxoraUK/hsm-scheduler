import {
  authenticateBillingRequest,
  corsHeaders,
  errorResponse,
  getSiteUrl,
  getStripe,
  jsonResponse,
  requireClubOwner,
} from "../_shared/billing.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return errorResponse(request, new Error("Method not allowed"), 405);

  try {
    const { clubId } = await request.json();
    if (!clubId) throw new Error("Club is required");
    const { user, adminClient } = await authenticateBillingRequest(request);
    await requireClubOwner(adminClient, clubId, user.id);

    const { data: subscription, error } = await adminClient
      .from("club_subscriptions")
      .select("external_customer_id,billing_exempt,status")
      .eq("club_id", clubId)
      .single();
    if (error) throw error;
    if (subscription.billing_exempt || subscription.status === "internal") throw new Error("This workspace is billing exempt");
    if (!subscription.external_customer_id) throw new Error("No Stripe customer is connected to this club");

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.external_customer_id,
      return_url: `${getSiteUrl()}/?billing=portal_return`,
    });
    return jsonResponse(request, { url: session.url });
  } catch (error) {
    return errorResponse(request, error, 400);
  }
});
