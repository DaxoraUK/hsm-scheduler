import { communicationProviderConfig } from "../communications/config.js";

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return { message: text }; }
}

function cleanRecipients(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim().toLowerCase()).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))].slice(0, 50);
}

function safeTag(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "daxora";
}

export async function sendDaxoraEmail({ to = [], subject, html, text = "", attachments = [], idempotencyKey, tags = {} }) {
  const config = communicationProviderConfig();
  if (!config.email.enabled) {
    throw Object.assign(new Error("Daxora email delivery is not configured on this deployment."), { code: "EMAIL_PROVIDER_NOT_CONFIGURED", status: 503 });
  }
  const intended = cleanRecipients(to);
  if (!intended.length) throw Object.assign(new Error("No valid email recipients were supplied."), { code: "EMAIL_RECIPIENTS_REQUIRED", status: 400 });
  const recipients = config.email.pilotMode ? [config.email.pilotRecipient] : intended;
  const finalSubject = config.email.pilotMode ? `[STAGING · intended for ${intended.length}] ${subject}` : subject;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.email.apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": String(idempotencyKey || crypto.randomUUID()).slice(0, 256),
    },
    body: JSON.stringify({
      from: config.email.from,
      to: recipients,
      subject: finalSubject,
      html,
      text: text || String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      attachments: (Array.isArray(attachments) ? attachments : []).map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(String(attachment.content || ""), "utf8").toString("base64"),
      })),
      tags: Object.entries(tags).slice(0, 8).map(([name, value]) => ({ name: safeTag(name), value: safeTag(value) })),
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok || !payload?.id) {
    throw Object.assign(new Error(payload?.message || "The email provider rejected the Daxora message."), {
      code: payload?.name || "RESEND_SEND_FAILED",
      status: response.status || 502,
      detail: payload,
    });
  }
  return { provider: "resend", reference: payload.id, recipients: recipients.length, pilotMode: config.email.pilotMode };
}
