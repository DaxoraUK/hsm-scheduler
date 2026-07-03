import {
  authenticateBillingRequest,
  corsHeaders,
  errorResponse,
  getPriceId,
  getSiteUrl,
  getStripe,
  jsonResponse,
  requireBillingReady,
  requireClubOwner,
} from "../_shared/billing.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return errorResponse(request, new Error("Method not allowed"), 405);

  try {
    const { clubId, planCode, billingInterval = "monthly" } = await request.json();
    if (!clubId || !planCode) throw new Error("Club and package are required");

    const { user, adminClient } = await authenticateBillingRequest(request);
    await requireClubOwner(adminClient, clubId, user.id);
    const { settings } = await requireBillingReady(adminClient, clubId);

    const [{ data: club, error: clubError }, { data: subscription, error: subscriptionError }] = await Promise.all([
      adminClient.from("clubs").select("id,name,status").eq("id", clubId).single(),
      adminClient.from("club_subscriptions").select("*").eq("club_id", clubId).single(),
    ]);
    if (clubError) throw clubError;
    if (subscriptionError) throw subscriptionError;
    if (club.status !== "active") throw new Error("This club workspace is not active");
    if (subscription.billing_exempt || subscription.status === "internal") throw new Error("This workspace is billing exempt");

    const stripe = getStripe();
    const priceId = getPriceId(String(planCode), String(billingInterval));
    let customerId = subscription.external_customer_id as string | null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: club.name,
        metadata: { club_id: clubId, ground_control_owner_id: user.id },
      }, { idempotencyKey: `gc-customer-${clubId}` });
      customerId = customer.id;
      const { error } = await adminClient.from("club_subscriptions").update({
        payment_provider: "stripe",
        external_customer_id: customerId,
        billing_email: user.email || null,
        billing_name: club.name,
        updated_by: user.id,
      }).eq("club_id", clubId);
      if (error) throw error;
    }

    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: clubId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      tax_id_collection: { enabled: settings.tax_status === "vat_registered" },
      success_url: `${siteUrl}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?billing=cancelled`,
      metadata: { club_id: clubId, plan_code: String(planCode), billing_interval: String(billingInterval), owner_user_id: user.id },
      subscription_data: { metadata: { club_id: clubId, plan_code: String(planCode), billing_interval: String(billingInterval) } },
    }, { idempotencyKey: `gc-checkout-${clubId}-${planCode}-${billingInterval}-${new Date().toISOString().slice(0, 13)}` });

    const { error: attemptError } = await adminClient.from("billing_checkout_attempts").insert({
      club_id: clubId,
      requested_by: user.id,
      plan_code: String(planCode).toLowerCase(),
      billing_interval: String(billingInterval).toLowerCase(),
      provider: "stripe",
      external_session_id: session.id,
      status: "created",
      metadata: { stripe_mode: settings.stripe_mode },
    });
    if (attemptError) throw attemptError;

    return jsonResponse(request, { url: session.url, sessionId: session.id });
  } catch (error) {
    return errorResponse(request, error, 400);
  }
});
