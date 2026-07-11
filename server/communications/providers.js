import { channelConfiguration, communicationProviderConfig } from "./config.js";

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function providerError(message, code, status = 502, detail = null) {
  return Object.assign(new Error(message), { code, status, detail });
}

async function sendEmail(item) {
  const config = channelConfiguration("email");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": item.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: config.from,
      to: [item.destination],
      subject: item.subject,
      text: item.messageBody,
      tags: [
        { name: "club", value: item.clubTag },
        { name: "message", value: item.messageTag },
      ],
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok || !payload?.id) {
    throw providerError(payload?.message || "The email provider rejected the message", payload?.name || "RESEND_SEND_FAILED", response.status || 502, payload);
  }
  return { provider: "resend", reference: payload.id, status: "provider_accepted", rawStatus: "accepted" };
}

function twilioCallbackUrl() {
  const base = communicationProviderConfig().publicBaseUrl;
  return base ? `${base}/api/communications/webhooks/twilio` : "";
}

async function sendTwilio(item) {
  const config = channelConfiguration(item.channel);
  const params = new URLSearchParams({ To: item.channel === "whatsapp" ? `whatsapp:${item.destination}` : item.destination });
  if (config.messagingServiceSid) params.set("MessagingServiceSid", config.messagingServiceSid);
  else params.set("From", item.channel === "whatsapp" ? `whatsapp:${config.from.replace(/^whatsapp:/, "")}` : config.from);

  if (item.channel === "whatsapp") {
    params.set("ContentSid", config.contentSid);
    params.set("ContentVariables", JSON.stringify({ 1: item.messageBody }));
  } else {
    params.set("Body", item.messageBody);
  }
  const callback = twilioCallbackUrl();
  if (callback) params.set("StatusCallback", callback);

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const payload = await responsePayload(response);
  if (!response.ok || !payload?.sid) {
    throw providerError(payload?.message || "The messaging provider rejected the message", payload?.code ? `TWILIO_${payload.code}` : "TWILIO_SEND_FAILED", response.status || 502, payload);
  }
  return { provider: "twilio", reference: payload.sid, status: "provider_accepted", rawStatus: payload.status || "queued" };
}

export async function sendProviderMessage(item) {
  const config = channelConfiguration(item.channel);
  if (!config.enabled) {
    throw providerError(`${item.channel} web sending is not configured`, "CHANNEL_NOT_CONFIGURED", 503);
  }
  if (item.channel === "email") return sendEmail(item);
  return sendTwilio(item);
}
