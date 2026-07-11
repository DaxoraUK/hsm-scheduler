export const MATCHDAY_EMAIL_TEMPLATE_VERSION = "professional-matchday-v1";

const STATUS_PRESENTATION = Object.freeze({
  scheduled: {
    eyebrow: "MATCHDAY DETAILS",
    title: "Your fixture information",
    badge: "Scheduled",
    accent: "#047857",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    summary: "The latest matchday information is ready for you to review.",
    action: "Please confirm receipt and let the club know promptly if anything is incorrect.",
  },
  postponed: {
    eyebrow: "FIXTURE UPDATE",
    title: "Fixture postponed",
    badge: "Postponed",
    accent: "#b45309",
    soft: "#fffbeb",
    border: "#fde68a",
    summary: "This fixture is currently postponed and should not be treated as going ahead.",
    action: "Please do not travel or make final arrangements until the club confirms the rearranged details.",
  },
  cancelled: {
    eyebrow: "FIXTURE UPDATE",
    title: "Fixture cancelled",
    badge: "Cancelled",
    accent: "#be123c",
    soft: "#fff1f2",
    border: "#fecdd3",
    summary: "This fixture has been cancelled.",
    action: "Please confirm receipt and make sure the relevant players and parents are informed.",
  },
  unresolved: {
    eyebrow: "MATCHDAY UPDATE",
    title: "Fixture details pending",
    badge: "Awaiting details",
    accent: "#b45309",
    soft: "#fffbeb",
    border: "#fde68a",
    summary: "The fixture is still awaiting final operational details.",
    action: "Please do not circulate final arrangements yet. The club will send another update when the allocation is complete.",
  },
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function compact(value, fallback = "") {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || fallback;
}

function statusPresentation(status) {
  return STATUS_PRESENTATION[compact(status).toLowerCase()] || STATUS_PRESENTATION.scheduled;
}

function fixtureSubject(item = {}, pilotMode = false) {
  const teamName = compact(item.teamName, "Team");
  const status = compact(item.status).toLowerCase();
  const suffix = status === "postponed"
    ? "fixture postponed"
    : status === "cancelled"
      ? "fixture cancelled"
      : status === "unresolved"
        ? "fixture update"
        : "matchday details";
  return `${pilotMode ? "[STAGING TEST] " : ""}${teamName} | ${suffix}`;
}

function detailRow(label, value, { last = false } = {}) {
  if (!compact(value)) return "";
  return `
    <tr>
      <td style="padding:14px 16px;${last ? "" : "border-bottom:1px solid #e2e8f0;"}font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:14px 16px;${last ? "" : "border-bottom:1px solid #e2e8f0;"}font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;line-height:21px;color:#0f172a;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;
}

function textDetail(label, value) {
  return compact(value) ? `${label}: ${compact(value)}` : "";
}

export function buildMatchdayEmail(item = {}, { pilotMode = false } = {}) {
  const status = compact(item.status, "scheduled").toLowerCase();
  const presentation = statusPresentation(status);
  const clubName = compact(item.clubName, "Your club");
  const teamName = compact(item.teamName, "Team");
  const opposition = compact(item.opposition, "Opposition TBC");
  const recipientName = compact(item.recipientLabel, "Coach");
  const dateLabel = compact(item.dateLabel, "Date TBC");
  const kickOff = compact(item.kickOff || item.ko, "TBC");
  const venue = compact(item.venue);
  const pitch = compact(item.pitch, "TBC");
  const format = compact(item.format);
  const referee = compact(item.referee);
  const messageReference = compact(item.messageTag || item.idempotencyKey).slice(0, 12).toUpperCase();
  const subject = fixtureSubject(item, pilotMode);
  const fixtureLine = `${teamName} v ${opposition}`;

  const detailEntries = [
    ["Date", dateLabel],
    ["Kick-off", kickOff],
    ["Venue", venue],
    ["Pitch", pitch],
    ["Format", format],
    ["Official", referee],
  ].filter(([, value]) => compact(value));

  const detailHtml = detailEntries
    .map(([label, value], index) => detailRow(label, value, { last: index === detailEntries.length - 1 }))
    .join("");

  const pilotBlock = pilotMode
    ? `
      <tr>
        <td style="padding:0 20px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;">
            <tr>
              <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;color:#9a3412;">
                <div style="font-size:10px;font-weight:800;line-height:16px;letter-spacing:.16em;text-transform:uppercase;">Internal staging test</div>
                <div style="margin-top:4px;font-size:13px;font-weight:700;line-height:20px;">This email was redirected to the authorised test inbox. No saved coach or assistant address received it.</div>
                <div style="margin-top:3px;font-size:12px;line-height:18px;color:#c2410c;">Intended recipient: ${escapeHtml(recipientName)} (${escapeHtml(compact(item.recipientHint, "contact recorded"))}). The coach-facing layout begins below.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(`${presentation.title}: ${fixtureLine} on ${dateLabel} at ${kickOff}.`)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eef2f7;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;">
          ${pilotBlock}
          <tr>
            <td style="overflow:hidden;border-radius:22px;background:#ffffff;box-shadow:0 12px 36px rgba(15,23,42,.10);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:24px 28px;background:#07111f;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
                          <div style="font-size:10px;font-weight:800;line-height:15px;letter-spacing:.20em;text-transform:uppercase;color:#34d399;">Daxora</div>
                          <div style="margin-top:2px;font-size:20px;font-weight:800;line-height:24px;color:#ffffff;">Ground Control</div>
                        </td>
                        <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;line-height:18px;color:#cbd5e1;vertical-align:middle;">${escapeHtml(clubName)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:10px;font-weight:800;line-height:16px;letter-spacing:.18em;text-transform:uppercase;color:${presentation.accent};">${escapeHtml(presentation.eyebrow)}</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse;">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;vertical-align:middle;">
                          <h1 style="margin:0;font-size:28px;font-weight:800;line-height:34px;color:#0f172a;">${escapeHtml(presentation.title)}</h1>
                        </td>
                        <td align="right" style="padding-left:12px;vertical-align:middle;">
                          <span style="display:inline-block;padding:7px 11px;border-radius:999px;background:${presentation.soft};border:1px solid ${presentation.border};font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:800;line-height:16px;color:${presentation.accent};">${escapeHtml(presentation.badge)}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:12px 0 0;font-size:15px;font-weight:500;line-height:23px;color:#64748b;">${escapeHtml(presentation.summary)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px 0;font-family:Arial,Helvetica,sans-serif;">
                    <div style="padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;">
                      <div style="font-size:12px;font-weight:800;line-height:18px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${escapeHtml(teamName)}</div>
                      <div style="margin-top:5px;font-size:22px;font-weight:800;line-height:29px;color:#0f172a;">${escapeHtml(fixtureLine)}</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 28px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
                      ${detailHtml}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px 30px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:16px;font-weight:700;line-height:24px;color:#0f172a;">Hi ${escapeHtml(recipientName)},</p>
                    <p style="margin:12px 0 0;font-size:15px;font-weight:500;line-height:24px;color:#475569;">${escapeHtml(presentation.action)}</p>
                    <div style="margin-top:22px;padding:16px 18px;border-left:4px solid ${presentation.accent};border-radius:0 12px 12px 0;background:${presentation.soft};font-size:13px;font-weight:700;line-height:21px;color:${presentation.accent};">
                      This is an operational club message. Reply to your usual club contact if you need help with these details.
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-size:12px;font-weight:700;line-height:19px;color:#475569;">Sent on behalf of ${escapeHtml(clubName)} using Ground Control.</div>
                    <div style="margin-top:4px;font-size:11px;line-height:17px;color:#94a3b8;">Operational message only · Reference ${escapeHtml(messageReference || "NOT RECORDED")}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 18px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#94a3b8;">Ground Control helps clubs coordinate matchday operations. Delivery status is recorded separately from provider acceptance.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const detailText = detailEntries.map(([label, value]) => textDetail(label, value)).filter(Boolean).join("\n");
  const pilotText = pilotMode
    ? [
        "INTERNAL STAGING TEST",
        "This email was redirected to the authorised test inbox.",
        "No saved coach or assistant address received it.",
        `Intended recipient: ${recipientName} (${compact(item.recipientHint, "contact recorded")})`,
        "",
      ].join("\n")
    : "";
  const textBody = [
    pilotText,
    "DAXORA GROUND CONTROL",
    clubName,
    "",
    presentation.title.toUpperCase(),
    fixtureLine,
    "",
    detailText,
    "",
    `Hi ${recipientName},`,
    "",
    presentation.action,
    "",
    `Sent on behalf of ${clubName} using Ground Control.`,
    `Reference: ${messageReference || "not recorded"}`,
  ].filter((value, index, values) => value !== "" || values[index - 1] !== "").join("\n").trim();

  return { subject, html, text: textBody };
}

export { escapeHtml, fixtureSubject, statusPresentation };
