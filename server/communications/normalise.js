import { createHash } from "node:crypto";

export function text(value, max = 4000) {
  return String(value || "").trim().slice(0, max);
}

export function normaliseEmail(value) {
  const email = text(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function normalisePhone(value) {
  const raw = text(value, 80);
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : "";
}

export function normaliseDestination(channel, value) {
  return channel === "email" ? normaliseEmail(value) : normalisePhone(value);
}

export function destinationHint(channel, destination) {
  if (channel === "email") {
    const [local = "", domain = ""] = String(destination).split("@");
    return `${local.slice(0, 1) || "*"}***@${domain}`;
  }
  const digits = String(destination).replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "Contact recorded";
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function sanitiseOutboundMessages(clubId, rows = []) {
  if (!Array.isArray(rows) || !rows.length) {
    throw Object.assign(new Error("Select at least one recipient"), { code: "EMPTY_MESSAGE_BATCH", status: 400 });
  }
  if (rows.length > 100) {
    throw Object.assign(new Error("A maximum of 100 recipients can be processed in one batch"), { code: "MESSAGE_BATCH_TOO_LARGE", status: 400 });
  }

  return rows.map((row, index) => {
    const channel = text(row?.channel, 20).toLowerCase();
    if (!["email", "sms", "whatsapp"].includes(channel)) {
      throw Object.assign(new Error(`Recipient ${index + 1} has an unsupported channel`), { code: "UNSUPPORTED_CHANNEL", status: 400 });
    }
    const destination = normaliseDestination(channel, row?.destination);
    if (!destination) {
      throw Object.assign(new Error(`Recipient ${index + 1} has an invalid ${channel} destination`), { code: "INVALID_DESTINATION", status: 400 });
    }
    const messageBody = text(row?.message, 4000);
    if (messageBody.length < 10) {
      throw Object.assign(new Error(`Recipient ${index + 1} has no usable message`), { code: "INVALID_MESSAGE_BODY", status: 400 });
    }
    const messageKey = text(row?.messageKey || row?.clientKey, 240);
    const messageHash = text(row?.messageHash, 512) || sha256(messageBody);
    const recipientType = ["coach", "assistant"].includes(text(row?.recipientType, 30).toLowerCase())
      ? text(row?.recipientType, 30).toLowerCase()
      : "coach";
    const idempotencyKey = sha256([
      clubId,
      channel,
      destination.toLowerCase(),
      messageHash,
      recipientType,
    ].join("|"));

    return {
      clientKey: text(row?.clientKey || `${messageKey}:${recipientType}`, 240),
      idempotencyKey,
      messageKey,
      messageHash,
      fixtureId: text(row?.fixtureId, 240) || null,
      teamKey: text(row?.teamKey, 160) || null,
      teamName: text(row?.teamName, 180),
      recipientType,
      recipientLabel: text(row?.recipientLabel, 180),
      recipientHint: destinationHint(channel, destination),
      channel,
      destination,
      subject: text(row?.subject || `${text(row?.teamName, 180)} matchday details`, 240),
      messageBody,
      clubName: text(row?.clubName, 180),
      status: text(row?.status, 30).toLowerCase() || "scheduled",
      dateLabel: text(row?.dateLabel, 180),
      opposition: text(row?.opposition, 180),
      kickOff: text(row?.kickOff || row?.ko, 40),
      venue: text(row?.venue, 240),
      pitch: text(row?.pitch, 120),
      format: text(row?.format, 80),
      referee: text(row?.referee, 180),
    };
  });
}
