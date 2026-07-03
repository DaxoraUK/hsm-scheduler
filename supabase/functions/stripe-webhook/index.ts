import Stripe from "npm:stripe@^22.0.0";
import { createClient } from "npm:@supabase/supabase-js@^2.49.0";
import {
  corsHeaders,
  errorResponse,
  getStripe,
  jsonResponse,
  planForPrice,
  resolveClubIdForStripeObject,
} from "../_shared/billing.ts";

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function unixDate(value: unknown): string | null {
  const seconds = Number(value || 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function subscriptionPeriod(subscription: Record<string, unknown>) {
  const item = (subscription.items as { data?: Array<Record<string, unknown>> } | undefined)?.data?.[0] || {};
  return {
    start: unixDate(subscription.current_period_start || item.current_period_start),
    end: unixDate(subscription.current_period_end || item.current_period_end),
  };
}

function mappedStatus(stripeStatus: string): string {
  if (stripeStatus === "active") return "active";
  if (stripeStatus === "trialing") return "trialing";
  if (["past_due", "unpaid"].includes(stripeStatus)) return "grace";
  if (stripeStatus === "canceled") return "cancelled";
  return "suspended";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return errorResponse(request, new Error("Method not allowed"), 405);

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse(request, new Error("Missing Stripe signature"), 400);

  let event;
  try {
    const payload = await request.text();
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env("STRIPE_WEBHOOK_SECRET"),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (error) {
    return errorResponse(request, error, 400);
  }

  const adminClient = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: eventInsertError } = await adminClient.from("billing_provider_events").insert({
    provider: "stripe",
    external_event_id: event.id,
    event_type: event.type,
    processing_status: "processing",
    metadata: { livemode: event.livemode, api_version: event.api_version || null },
  });
  if (eventInsertError?.code === "23505") {
    const { data: existingEvent, error: existingError } = await adminClient
      .from("billing_provider_events")
      .select("processing_status,received_at")
      .eq("external_event_id", event.id)
      .single();
    if (existingError) return errorResponse(request, existingError, 500);
    if (["processed", "ignored"].includes(existingEvent.processing_status)) {
      return jsonResponse(request, { received: true, duplicate: true });
    }

    const receivedAt = new Date(existingEvent.received_at).getTime();
    const stillProcessing = existingEvent.processing_status === "processing"
      && Number.isFinite(receivedAt)
      && Date.now() - receivedAt < 120_000;
    if (stillProcessing) {
      return errorResponse(request, new Error("This Stripe event is already being processed"), 409);
    }

    const { error: retryError } = await adminClient.from("billing_provider_events").update({
      processing_status: "processing",
      failure_message: null,
      processed_at: null,
      received_at: new Date().toISOString(),
    }).eq("external_event_id", event.id);
    if (retryError) return errorResponse(request, retryError, 500);
  } else if (eventInsertError) {
    return errorResponse(request, eventInsertError, 500);
  }

  const finish = async (status: "processed" | "ignored" | "failed", clubId: string | null, failureMessage = "") => {
    await adminClient.from("billing_provider_events").update({
      club_id: clubId,
      processing_status: status,
      failure_message: failureMessage || null,
      processed_at: new Date().toISOString(),
    }).eq("external_event_id", event.id);
  };

  let clubId: string | null = null;
  try {
    const object = event.data.object as unknown as Record<string, unknown>;
    clubId = await resolveClubIdForStripeObject(adminClient, object);

    if (event.type === "checkout.session.completed") {
      const session = object;
      clubId = String((session.metadata as Record<string, string> | undefined)?.club_id || session.client_reference_id || clubId || "") || null;
      if (!clubId) throw new Error("Checkout session is missing club metadata");
      await adminClient.from("club_subscriptions").update({
        payment_provider: "stripe",
        external_customer_id: typeof session.customer === "string" ? session.customer : null,
        external_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
        billing_email: (session.customer_details as Record<string, string> | undefined)?.email || null,
        billing_name: (session.customer_details as Record<string, string> | undefined)?.name || null,
        billing_address: (session.customer_details as Record<string, unknown> | undefined)?.address || {},
      }).eq("club_id", clubId);
      await adminClient.from("billing_checkout_attempts").update({ status: "completed", completed_at: new Date().toISOString() }).eq("external_session_id", event.data.object.id);
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      const subscription = object;
      if (!clubId) throw new Error("Subscription is not linked to a Ground Control club");
      const firstItem = (subscription.items as { data?: Array<Record<string, unknown>> } | undefined)?.data?.[0] || {};
      const priceId = ((firstItem.price as Record<string, unknown> | undefined)?.id || "") as string;
      const mappedPlan = planForPrice(priceId);
      if (!mappedPlan) throw new Error(`Stripe price ${priceId || "unknown"} is not mapped to a Ground Control plan`);
      const stripeStatus = String(subscription.status || "");
      const period = subscriptionPeriod(subscription);
      const nextStatus = event.type === "customer.subscription.deleted" ? "cancelled" : mappedStatus(stripeStatus);
      await adminClient.from("club_subscriptions").update({
        payment_provider: "stripe",
        plan_code: mappedPlan.planCode,
        billing_interval: mappedPlan.billingInterval,
        status: nextStatus,
        external_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
        external_subscription_id: String(subscription.id || "") || null,
        external_price_id: priceId || null,
        current_period_start: period.start,
        current_period_end: period.end,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        cancelled_at: nextStatus === "cancelled" ? new Date().toISOString() : null,
        grace_ends_at: nextStatus === "grace" ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null,
      }).eq("club_id", clubId);
    } else if (event.type === "invoice.paid") {
      if (!clubId) throw new Error("Paid invoice is not linked to a Ground Control club");
      await adminClient.from("club_subscriptions").update({
        status: "active",
        grace_ends_at: null,
        last_invoice_status: "paid",
        last_payment_at: new Date().toISOString(),
        payment_failure_count: 0,
      }).eq("club_id", clubId);
    } else if (event.type === "invoice.payment_failed") {
      if (!clubId) throw new Error("Failed invoice is not linked to a Ground Control club");
      const { data: current } = await adminClient.from("club_subscriptions").select("payment_failure_count").eq("club_id", clubId).single();
      await adminClient.from("club_subscriptions").update({
        status: "grace",
        grace_ends_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        last_invoice_status: "payment_failed",
        payment_failure_count: Number(current?.payment_failure_count || 0) + 1,
      }).eq("club_id", clubId);
    } else {
      await finish("ignored", clubId);
      return jsonResponse(request, { received: true, ignored: true });
    }

    await finish("processed", clubId);
    return jsonResponse(request, { received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await finish("failed", clubId, message);
    return errorResponse(request, error, 500);
  }
});
