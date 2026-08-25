import { json, methodNotAllowed, readJson } from "../../server/communications/http.js";
import { serviceRpc, userRpc, verifySupabaseUser } from "../../server/communications/supabase.js";
import { deliverClubInvitation, deliverCoachHubInvitation } from "../../server/coach/invitations.js";

export async function POST(request) {
  let invitationId = "";
  try {
    const { token } = await verifySupabaseUser(request);
    const body = await readJson(request);
    const clubId = String(body?.clubId || "").trim();
    invitationId = String(body?.invitationId || "").trim();
    const inviteUrl = String(body?.inviteUrl || "").trim();
    const invitationType = body?.invitationType === "club" ? "club" : "coach";
    if (!clubId || !invitationId || !inviteUrl) {
      return json({ error: "Club, invitation and invitation URL are required.", code: "COACH_INVITE_CONTEXT_REQUIRED" }, 400);
    }

    const requestOrigin = new URL(request.url).origin;
    const parsedInviteUrl = new URL(inviteUrl);
    const tokenKey = invitationType === "club" ? "club_invite" : "coach_invite";
    if (parsedInviteUrl.origin !== requestOrigin || !parsedInviteUrl.searchParams.get(tokenKey)) {
      return json({ error: "The Coach Hub invitation link must belong to this Daxora deployment.", code: "COACH_INVITE_ORIGIN_INVALID" }, 400);
    }

    const prepared = await userRpc(token, invitationType === "club" ? "prepare_club_invitation_delivery" : "prepare_coach_hub_invitation_delivery", {
      target_club_id: clubId,
      target_invitation_id: invitationId,
      ...(invitationType === "coach" ? { public_base_url: parsedInviteUrl.origin } : {}),
    });
    const result = invitationType === "club"
      ? await deliverClubInvitation(prepared, parsedInviteUrl.toString())
      : await deliverCoachHubInvitation(prepared, parsedInviteUrl.toString());
    if (invitationType === "club") return json({ delivered: true, provider: result.provider, reference: result.reference, pilotMode: result.pilotMode }, 200);
    await serviceRpc("complete_coach_hub_invitation_delivery", {
      target_invitation_id: invitationId,
      next_status: "delivered",
      provider_value: result.provider || "resend",
      reference_value: result.reference || "",
      error_value: "",
    });
    return json({ delivered: true, provider: result.provider, reference: result.reference, pilotMode: result.pilotMode }, 200);
  } catch (error) {
    if (invitationId) {
      try {
        await serviceRpc("complete_coach_hub_invitation_delivery", {
          target_invitation_id: invitationId,
          next_status: "failed",
          provider_value: "resend",
          reference_value: "",
          error_value: error?.message || "Coach invitation delivery failed.",
        });
      } catch {
        // Keep the original delivery error as the response.
      }
    }
    return json({ error: error?.message || "The Coach Hub invitation could not be delivered.", code: error?.code || "COACH_INVITE_DELIVERY_FAILED" }, Number(error?.status) || 500);
  }
}

export function GET() {
  return methodNotAllowed("POST");
}
