import { Auth } from "../supabase.js";
import { maskContactDestination } from "./contactModel.js";

export const EMPTY_DELIVERY_CAPABILITIES = Object.freeze({
  webSendingEnabled: false,
  mode: "disabled",
  channels: {
    email: { enabled: false, provider: null, statusTracking: false },
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
        subject: `${row.teamName} matchday details`,
        message: recipient.message || row.message,
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
      messages: prepared.messages,
    }),
  });
  const payload = await responsePayload(response);
  if (!response.ok) {
    const error = new Error(payload?.error || "The message batch could not be sent");
    error.code = payload?.code || "COMMUNICATION_DISPATCH_FAILED";
    error.detail = payload;
    throw error;
  }
  return { ...payload, unavailable: prepared.unavailable };
}
