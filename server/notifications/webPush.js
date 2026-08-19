import { createPrivateKey, sign } from "node:crypto";
import { serviceRpc } from "../communications/supabase.js";

function env(name) { return String(process.env[name] || "").trim(); }
function base64Url(input) { return Buffer.from(input).toString("base64url"); }
function decode(value) { return Buffer.from(String(value || ""), "base64url"); }

function vapidConfig() {
  const publicKey = env("DAXORA_VAPID_PUBLIC_KEY");
  const privateKey = env("DAXORA_VAPID_PRIVATE_KEY");
  const subject = env("DAXORA_VAPID_SUBJECT") || "mailto:support@daxora.com";
  if (!publicKey || !privateKey) throw Object.assign(new Error("Daxora VAPID keys are not configured."), { code: "VAPID_NOT_CONFIGURED", status: 503 });
  const publicBytes = decode(publicKey);
  const privateBytes = decode(privateKey);
  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw Object.assign(new Error("The configured Daxora VAPID keys are invalid."), { code: "VAPID_KEYS_INVALID", status: 503 });
  }
  return { publicKey, privateKey, publicBytes, privateBytes, subject };
}

function vapidToken(endpoint) {
  const config = vapidConfig();
  const audience = new URL(endpoint).origin;
  const header = base64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = base64Url(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: config.subject }));
  const unsigned = `${header}.${payload}`;
  const key = createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: config.publicBytes.subarray(1, 33).toString("base64url"),
      y: config.publicBytes.subarray(33, 65).toString("base64url"),
      d: config.privateBytes.toString("base64url"),
    },
  });
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return { token: `${unsigned}.${signature}`, publicKey: config.publicKey };
}

function isQuietHours(target = {}, date = new Date()) {
  if (!target.quiet_start || !target.quiet_end) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: target.timezone || "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
    const hour = parts.find((part) => part.type === "hour")?.value || "00";
    const minute = parts.find((part) => part.type === "minute")?.value || "00";
    const current = `${hour}:${minute}`;
    const start = String(target.quiet_start).slice(0, 5);
    const end = String(target.quiet_end).slice(0, 5);
    return start <= end ? current >= start && current < end : current >= start || current < end;
  } catch { return false; }
}

export async function sendPayloadlessPush(subscription, { urgency = "normal", respectQuietHours = true } = {}) {
  if (respectQuietHours && isQuietHours(subscription)) return { status: "quiet_hours" };
  const { token, publicKey } = vapidToken(subscription.endpoint);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "300",
      Urgency: urgency,
      Authorization: `vapid t=${token}, k=${publicKey}`,
      "Crypto-Key": `p256ecdsa=${publicKey}`,
      "Content-Length": "0",
    },
  });
  if (response.status === 404 || response.status === 410) return { status: "expired", httpStatus: response.status };
  if (!response.ok) throw Object.assign(new Error(`Push service rejected the request (${response.status}).`), { code: "WEB_PUSH_REJECTED", status: response.status });
  return { status: "accepted", httpStatus: response.status };
}

export async function pushDaxoraUsers(userIds = [], options = {}) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean))];
  if (!ids.length) return { attempted: 0, accepted: 0, quiet: 0, expired: 0, failed: 0 };
  let targets = [];
  try { targets = await serviceRpc("get_daxora_push_targets", { target_user_ids: ids }); }
  catch (error) { if (error?.code === "SUPABASE_SERVICE_ROLE_NOT_CONFIGURED") throw error; return { attempted: 0, accepted: 0, quiet: 0, expired: 0, failed: 0 }; }
  const summary = { attempted: targets.length, accepted: 0, quiet: 0, expired: 0, failed: 0 };
  for (const target of targets) {
    try {
      const result = await sendPayloadlessPush(target, options);
      if (result.status === "accepted") summary.accepted += 1;
      else if (result.status === "quiet_hours") summary.quiet += 1;
      else if (result.status === "expired") {
        summary.expired += 1;
        await serviceRpc("deactivate_daxora_push_subscription", { target_subscription_id: target.id }).catch(() => null);
      }
    } catch { summary.failed += 1; }
  }
  return summary;
}
