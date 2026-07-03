import Stripe from "npm:stripe@^22.0.0";
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@^2.49.0";

export type BillingContext = {
  user: User;
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getStripe(): Stripe {
  return new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getSiteUrl(): string {
  return requiredEnv("SITE_URL").replace(/\/$/, "");
}

function allowedOrigins(): Set<string> {
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  const extra = Deno.env.get("ALLOWED_ORIGINS")?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  return new Set([siteUrl, ...extra].filter(Boolean) as string[]);
}

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigins();
  const allowOrigin = allowed.has(origin) ? origin : [...allowed][0] || "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json" },
  });
}

export function errorResponse(request: Request, error: unknown, status = 400): Response {
  const message = error instanceof Error ? error.message : "Unexpected billing error";
  return jsonResponse(request, { error: message }, status);
}

export async function authenticateBillingRequest(request: Request): Promise<BillingContext> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Authenticated club owner access required");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Your secure session could not be verified");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { user: userData.user, userClient, adminClient };
}

export async function requireClubOwner(adminClient: SupabaseClient, clubId: string, userId: string) {
  const { data, error } = await adminClient
    .from("club_memberships")
    .select("role,status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "owner") throw new Error("Club owner access required");
}

export async function requireBillingReady(adminClient: SupabaseClient, clubId: string) {
  const [{ data: settings, error: settingsError }, { data: documents, error: documentsError }, { data: acceptances, error: acceptancesError }] = await Promise.all([
    adminClient.from("platform_legal_settings").select("*").eq("singleton", true).single(),
    adminClient.from("legal_documents").select("code,version,status,required_for_checkout,document_url").eq("status", "published"),
    adminClient.from("club_legal_acceptances").select("document_code,document_version").eq("club_id", clubId),
  ]);
  if (settingsError) throw settingsError;
  if (documentsError) throw documentsError;
  if (acceptancesError) throw acceptancesError;

  const requiredDocuments = (documents || []).filter((document) => document.required_for_checkout);
  const identityReady = String(settings.legal_name || "").trim().length > 1
    && String(settings.trading_name || "").trim().length > 1
    && String(settings.service_address || "").trim().length > 5
    && String(settings.support_email || "").includes("@")
    && String(settings.privacy_email || "").includes("@");
  if (!identityReady || !["test", "live"].includes(settings.stripe_mode)) {
    throw new Error("Daxora billing configuration is not ready");
  }
  if (requiredDocuments.length < 3 || requiredDocuments.some((document) => !String(document.document_url || "").startsWith("https://"))) {
    throw new Error("Reviewed commercial documents have not been published");
  }

  const accepted = new Set((acceptances || []).map((item) => `${item.document_code}:${item.document_version}`));
  const missing = requiredDocuments.filter((document) => !accepted.has(`${document.code}:${document.version}`));
  if (missing.length) throw new Error("The club owner must accept the current commercial documents before checkout");
  return { settings, requiredDocuments };
}

export function getPriceId(planCode: string, billingInterval: string): string {
  const plan = planCode.toLowerCase();
  const interval = billingInterval.toLowerCase();
  const names: Record<string, string> = {
    "link:monthly": "STRIPE_PRICE_LINK_MONTHLY",
    "link:annual": "STRIPE_PRICE_LINK_ANNUAL",
    "core:monthly": "STRIPE_PRICE_CORE_MONTHLY",
    "pro:monthly": "STRIPE_PRICE_PRO_MONTHLY",
  };
  const variable = names[`${plan}:${interval}`];
  if (!variable) throw new Error("This package is not available through self-service checkout");
  return requiredEnv(variable);
}

export function planForPrice(priceId: string): { planCode: string; billingInterval: string } | null {
  const mapping = [
    ["STRIPE_PRICE_LINK_MONTHLY", "link", "monthly"],
    ["STRIPE_PRICE_LINK_ANNUAL", "link", "annual"],
    ["STRIPE_PRICE_CORE_MONTHLY", "core", "monthly"],
    ["STRIPE_PRICE_PRO_MONTHLY", "pro", "monthly"],
  ] as const;
  for (const [envName, planCode, billingInterval] of mapping) {
    const configured = Deno.env.get(envName)?.trim();
    if (configured && configured === priceId) return { planCode, billingInterval };
  }
  return null;
}

export async function resolveClubIdForStripeObject(adminClient: SupabaseClient, object: Record<string, unknown>): Promise<string | null> {
  const metadata = (object.metadata || {}) as Record<string, string>;
  if (metadata.club_id) return metadata.club_id;
  const customerId = typeof object.customer === "string" ? object.customer : (object.customer as { id?: string } | null)?.id;
  const subscriptionId = typeof object.subscription === "string" ? object.subscription : (object.subscription as { id?: string } | null)?.id;
  let query = adminClient.from("club_subscriptions").select("club_id");
  if (subscriptionId) query = query.eq("external_subscription_id", subscriptionId);
  else if (customerId) query = query.eq("external_customer_id", customerId);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.club_id || null;
}
