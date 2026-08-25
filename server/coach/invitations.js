import { sendDaxoraEmail } from "../notifications/email.js";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validInviteUrl(value = "") {
  try {
    const url = new URL(String(value || "").trim());
    const isLocalHttp = url.protocol === "http:"
      && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return (url.protocol === "https:" || isLocalHttp)
      && Boolean(url.searchParams.get("coach_invite"))
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export async function deliverCoachHubInvitation(prepared = {}, inviteUrl = "") {
  const safeUrl = validInviteUrl(inviteUrl);
  if (!safeUrl) {
    throw Object.assign(new Error("The Coach Hub invitation link is invalid."), {
      code: "COACH_INVITE_URL_INVALID",
      status: 400,
    });
  }

  const recipient = String(prepared.email || "").trim().toLowerCase();
  const displayName = String(prepared.display_name || prepared.displayName || "Coach").trim();
  const clubName = String(prepared.club_name || prepared.clubName || "your club").trim();
  const teamNames = String(prepared.team_names || prepared.teamNames || "your team").trim();
  const subject = `${clubName} invited you to Daxora Coach Hub`;
  const html = `
    <div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden">
        <div style="background:#020617;padding:26px 28px;color:#ffffff">
          <div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#6ee7b7">Daxora Coach Hub</div>
          <h1 style="margin:12px 0 0;font-size:27px;line-height:1.2">Your team workspace is ready</h1>
        </div>
        <div style="padding:28px">
          <p style="font-size:16px;line-height:1.65;margin:0 0 18px">Hello ${escapeHtml(displayName)},</p>
          <p style="font-size:16px;line-height:1.65;margin:0 0 18px"><strong>${escapeHtml(clubName)}</strong> has invited you to Coach Hub for <strong>${escapeHtml(teamNames)}</strong>.</p>
          <p style="font-size:15px;line-height:1.65;color:#475569;margin:0 0 24px">Use Coach Hub to view training, fixtures and friendlies, submit pitch-booking requests, respond to alternatives and acknowledge club messages. Your contact details are already connected, so there is no duplicate setup.</p>
          <a href="${escapeHtml(safeUrl)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Open Coach Hub</a>
          <p style="font-size:12px;line-height:1.6;color:#64748b;margin:24px 0 0">This invitation is personal to you. Do not forward it. If you were not expecting it, contact your club administrator.</p>
        </div>
      </div>
    </div>`;

  return sendDaxoraEmail({
    to: [recipient],
    subject,
    html,
    text: `${displayName}, ${clubName} invited you to Daxora Coach Hub for ${teamNames}. Open: ${safeUrl}`,
    idempotencyKey: `coach-invite-${prepared.invitation_id || prepared.invitationId}`,
    tags: { product: "coach-hub", type: "invitation" },
  });
}

export async function deliverClubInvitation(prepared = {}, inviteUrl = "") {
  let safeUrl = "";
  try {
    const parsed = new URL(String(inviteUrl || "").trim());
    if (parsed.protocol === "https:" && parsed.searchParams.get("club_invite")) safeUrl = parsed.toString();
  } catch { /* validated below */ }
  if (!safeUrl) throw Object.assign(new Error("The club invitation link is invalid."), { code: "CLUB_INVITE_URL_INVALID", status: 400 });
  const recipient = String(prepared.email || "").trim().toLowerCase();
  const clubName = String(prepared.club_name || "your club").trim();
  const role = String(prepared.role || "club user").replaceAll("_", " ");
  const subject = `${clubName} invited you to Daxora Ground Control`;
  const html = `<div style="background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:24px;overflow:hidden"><div style="background:#020617;padding:26px 28px;color:#fff"><div style="font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#6ee7b7">Daxora Ground Control</div><h1 style="margin:12px 0 0;font-size:27px">Your club workspace is ready</h1></div><div style="padding:28px"><p style="font-size:16px;line-height:1.65"><strong>${escapeHtml(clubName)}</strong> has invited you to Ground Control with ${escapeHtml(role)} access.</p><a href="${escapeHtml(safeUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Accept invitation</a><p style="font-size:12px;line-height:1.6;color:#64748b;margin:24px 0 0">This secure invitation is personal to you and expires automatically. Sign in using this email address and do not forward the link.</p></div></div></div>`;
  return sendDaxoraEmail({ to: [recipient], subject, html, text: `${clubName} invited you to Daxora Ground Control as ${role}. Open: ${safeUrl}`, idempotencyKey: `club-invite-${prepared.invitation_id}`, tags: { product: "ground-control", type: "invitation" } });
}
