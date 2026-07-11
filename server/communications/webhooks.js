import { createHmac, timingSafeEqual } from "node:crypto";
import { communicationProviderConfig } from "./config.js";

function secureEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyResendWebhook(rawBody, headers) {
  const secretValue = communicationProviderConfig().email.webhookSecret;
  const id = String(headers.get("svix-id") || "");
  const timestamp = String(headers.get("svix-timestamp") || "");
  const signatureHeader = String(headers.get("svix-signature") || "");
  if (!secretValue || !id || !timestamp || !signatureHeader) return false;
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp) || Math.abs(Date.now() / 1000 - numericTimestamp) > 300) return false;
  const secret = Buffer.from(secretValue.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signatureHeader.split(/\s+/).some((entry) => {
    const [version, signature] = entry.split(",");
    return version === "v1" && signature && secureEqual(signature, expected);
  });
}

export function verifyTwilioWebhook(requestUrl, params, signature) {
  const token = communicationProviderConfig().sms.authToken || communicationProviderConfig().whatsapp.authToken;
  if (!token || !signature) return false;
  const configuredBase = communicationProviderConfig().publicBaseUrl;
  const parsed = new URL(requestUrl);
  const signedUrl = configuredBase ? `${configuredBase}${parsed.pathname}${parsed.search}` : requestUrl;
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const source = sorted.reduce((value, [key, item]) => `${value}${key}${item}`, signedUrl);
  const expected = createHmac("sha1", token).update(source).digest("base64");
  return secureEqual(signature, expected);
}

export function mapResendStatus(type) {
  return {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.bounced": "undelivered",
    "email.complained": "failed",
    "email.delivery_delayed": "provider_accepted",
  }[type] || null;
}

export function mapTwilioStatus(value) {
  return {
    accepted: "provider_accepted",
    queued: "provider_accepted",
    sending: "provider_accepted",
    sent: "sent",
    delivered: "delivered",
    read: "read",
    undelivered: "undelivered",
    failed: "failed",
    canceled: "cancelled",
  }[String(value || "").toLowerCase()] || null;
}
