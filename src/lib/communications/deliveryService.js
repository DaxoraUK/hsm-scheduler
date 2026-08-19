import { Auth } from "../supabase.js";
import { maskContactDestination } from "./contactModel.js";

export const EMPTY_DELIVERY_CAPABILITIES = Object.freeze({
  webSendingEnabled: false,
  mode: "disabled",
  channels: {
    email: { enabled: false, provider: null, statusTracking: false, pilotMode: false, pilotRecipientHint: null, operatorRestricted: false, maxBatch: null, blockedReason: null },
    sms: { enabled: false, provider: null, statusTracking: false },
    whatsapp: { enabled: false, provider: null, statusTracking: false, templateRequired: true },
  },
});

async function responsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}


export function describeCommunicationDispatchFailure(result = {}) {
  const firstFailure = result?.failure || (Array.isArray(result?.results)
    ? result.results.find((item) => item?.status === "failed")
    : null) || {};
  const providerStatus = Number(firstFailure.providerStatus) || null;
  const code = String(firstFailure.code || result?.code || "COMMUNICATION_DISPATCH_FAILED");
  const rawMessage = String(firstFailure.message || firstFailure.error || result?.error || "The message provider rejected the request").trim();
  const lower = rawMessage.toLowerCase();

  if (providerStatus === 401 || /api key|unauthori[sz]ed|authentication/.test(lower)) {
    return {
      title: "Email provider authentication failed",
      description: "The Resend API key on this Vercel deployment is missing, invalid or no longer active. Update RESEND_API_KEY and redeploy staging.",
      code,
    };
  }
  if (providerStatus === 403 || /resend\.dev|testing domain|verified domain|forbidden/.test(lower)) {
    return {
      title: "Resend blocked the test email",
      description: `${rawMessage}. Check that the pilot inbox is the email attached to the Resend account, or use a verified sending domain.`,
      code,
    };
  }
  if (providerStatus === 422 || /invalid.*(from|sender|recipient|email)|validation/.test(lower)) {
    return {
      title: "Email sender or recipient is invalid",
      description: `${rawMessage}. Check COMMUNICATIONS_EMAIL_FROM and the staging pilot recipient in Vercel.`,
      code,
    };
  }
  if (providerStatus === 429 || /rate limit|too many requests/.test(lower)) {
    return {
      title: "Email provider rate limit reached",
      description: "Resend temporarily refused the request because too many messages were attempted. Wait briefly and retry once.",
      code,
    };
  }
  return {
    title: "The provider did not accept the message",
    description: rawMessage || "Open the Vercel function log for the communications dispatch request before retrying.",
    code,
  };
}


function deliverySubject(row = {}) {
  if (row.status === "postponed") return `${row.teamName} | fixture postponed`;
  if (row.status === "cancelled") return `${row.teamName} | fixture cancelled`;
  if (row.status === "unresolved") return `${row.teamName} | fixture update`;
  return `${row.teamName} | matchday details`;
}

export async function loadDeliveryCapabilities() {
  try {
    const response = await fetch("/api/communications/capabilities", {
      headers: { accept: "application/json" },
    });
    const payload = await responsePayload(response);
    if (!response.ok || !payload?.channels) return EMPTY_DELIVERY_CAPABILITIES;
    return {
      ...EMPTY_DELIVERY_CAPABILITIES,
      ...payload,
      channels: {
        ...EMPTY_DELIVERY_CAPABILITIES.channels,
        ...payload.channels,
      },
    };
  } catch {
    return EMPTY_DELIVERY_CAPABILITIES;
  }
}

export function buildDeliveryMessages(rows = [], capabilities = EMPTY_DELIVERY_CAPABILITIES) {
  const messages = [];
  const unavailable = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    (Array.isArray(row.recipients) ? row.recipients : []).forEach((recipient) => {
      const item = {
        clientKey: `${row.id}:${recipient.type}`,
        messageKey: row.id,
        messageHash: row.messageHash,
        fixtureId: row.raw?.id || row.raw?.fixtureId || null,
        teamKey: row.contact?.teamKey || null,
        teamName: row.teamName,
        recipientType: recipient.type,
        recipientLabel: recipient.name,
        recipientHint: maskContactDestination(recipient.destination),
        channel: recipient.channel,
        destination: recipient.destination,
        subject: row.subject || deliverySubject(row),
        message: recipient.message || row.message,
        clubName: row.clubName,
        status: row.status,
        dateLabel: row.dateLabel,
        opposition: row.opposition,
        kickOff: row.ko,
        venue: row.venue,
        pitch: row.pitch,
        format: row.format,
        referee: row.referee,
        templateKey: row.governedTemplateKey || null,
        templateVersion: row.governedTemplateVersion || null,
        templateApprovalRequired: Boolean(row.governedTemplateApprovalRequired),
      };
      if (capabilities.channels?.[recipient.channel]?.enabled) messages.push(item);
      else unavailable.push(item);
    });
  });
  return { messages, unavailable };
}

export async function dispatchCommunicationBatch({ clubId, rows, capabilities, requestKey }) {
  const session = await Auth.getValidSession();
  if (!session?.access_token) {
    throw new Error("Sign in again to send coach messages");
  }
  const prepared = buildDeliveryMessages(rows, capabilities);
  if (!prepared.messages.length) {
    const error = new Error("None of the selected recipients use a configured web-sending channel");
    error.code = "NO_CONFIGURED_RECIPIENTS";
    error.unavailable = prepared.unavailable;
    throw error;
  }

  const response = await fetch("/api/communications/dispatch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      clubId,
      requestKey,
      pilotAcknowledged: Boolean(capabilities.channels?.email?.pilotMode),
      messages: prepared.messages,
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    if (Array.isArray(payload?.results)) {
      return { ...payload, unavailable: prepared.unavailable };
    }
    const error = new Error(payload?.error || "The message batch could not be sent");
    error.code = payload?.code || "COMMUNICATION_DISPATCH_FAILED";
    error.detail = payload;
    throw error;
  }
  return { ...payload, unavailable: prepared.unavailable };
}
