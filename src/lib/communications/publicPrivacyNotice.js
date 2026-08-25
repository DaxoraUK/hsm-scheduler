import { SUPA_URL, getSupaKey, SupabaseRequestError } from "../supabase.js";

export async function getPublicClubPrivacyNotice(slug) {
  const key = getSupaKey();
  if (!SUPA_URL || !key) throw new SupabaseRequestError("Privacy notice service is not configured");
  const response = await fetch(`${SUPA_URL}/rest/v1/rpc/get_public_club_privacy_notice`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ requested_slug: String(slug || "").trim().toLowerCase() }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new SupabaseRequestError(payload?.message || "Privacy notice could not be loaded", { status: response.status });
  return payload && typeof payload === "object" ? payload : null;
}
