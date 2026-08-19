export const TEAMFEEPAY_INTEGRATION_STATUS = Object.freeze({
  MOCK: "mock",
  READY_FOR_AUTHORISED_CONNECTION: "ready_for_authorised_connection",
  CONNECTED: "connected",
  ERROR: "error",
});

export const TEAMFEEPAY_CAPABILITIES = Object.freeze([
  {
    key: "club_directory",
    label: "Club directory",
    direction: "TeamFeePay → Daxora",
    purpose: "Create and maintain the club workspace without duplicate setup.",
  },
  {
    key: "people_and_roles",
    label: "People and roles",
    direction: "TeamFeePay → Daxora",
    purpose: "Reuse member, parent, coach and administrator records under agreed consent rules.",
  },
  {
    key: "teams",
    label: "Teams and squads",
    direction: "TeamFeePay → Daxora",
    purpose: "Keep operational teams aligned with TeamFeePay's club structure.",
  },
  {
    key: "events",
    label: "Events and fixtures",
    direction: "Bi-directional",
    purpose: "Enrich TeamFeePay schedules with pitch, site, closure and operational status.",
  },
  {
    key: "operational_alerts",
    label: "Operational alerts",
    direction: "Daxora → TeamFeePay",
    purpose: "Surface closures, reschedules, approvals and coach actions in TeamFeePay workflows.",
  },
  {
    key: "facility_analytics",
    label: "Facility analytics",
    direction: "Daxora → TeamFeePay",
    purpose: "Add utilisation, downtime, capacity and grant-evidence metrics.",
  },
]);

export const DAXORA_PARTNER_ENDPOINTS = Object.freeze([
  {
    method: "GET",
    path: "/v1/partner/capabilities",
    description: "Returns the versioned integration capabilities and supported entity types.",
  },
  {
    method: "POST",
    path: "/v1/partner/sync/preview",
    description: "Validates and previews an inbound club, team, person or event sync without writing data.",
  },
  {
    method: "POST",
    path: "/v1/partner/sync/commit",
    description: "Commits an approved synchronisation batch using idempotency keys.",
  },
  {
    method: "GET",
    path: "/v1/partner/clubs/{clubId}/operations",
    description: "Returns current fixtures, bookings, closures, readiness and action counts.",
  },
  {
    method: "GET",
    path: "/v1/partner/clubs/{clubId}/analytics",
    description: "Returns facility utilisation and operational evidence for an agreed date range.",
  },
  {
    method: "POST",
    path: "/v1/partner/webhooks/teamfeepay",
    description: "Receives authorised TeamFeePay change events after a signed webhook format is agreed.",
  },
]);

export function createPartnerEnvelope({
  eventType,
  source = "teamfeepay",
  sourceId = "",
  occurredAt = new Date().toISOString(),
  data = {},
  idempotencyKey = "",
} = {}) {
  const cleanType = String(eventType || "").trim();
  if (!cleanType) throw new Error("eventType is required");

  return {
    specVersion: "2026-07-21",
    eventType: cleanType,
    source: String(source || "teamfeepay").trim(),
    sourceId: String(sourceId || "").trim(),
    occurredAt,
    idempotencyKey:
      String(idempotencyKey || "").trim() ||
      `${String(source || "teamfeepay").trim()}:${cleanType}:${String(sourceId || "unknown").trim()}:${occurredAt}`,
    data,
  };
}

export function validatePartnerEnvelope(envelope) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") {
    return { valid: false, errors: ["Envelope must be an object."] };
  }
  if (!String(envelope.specVersion || "").trim()) errors.push("specVersion is required.");
  if (!String(envelope.eventType || "").trim()) errors.push("eventType is required.");
  if (!String(envelope.source || "").trim()) errors.push("source is required.");
  if (!String(envelope.idempotencyKey || "").trim()) errors.push("idempotencyKey is required.");
  if (!envelope.data || typeof envelope.data !== "object") errors.push("data must be an object.");
  if (Number.isNaN(Date.parse(String(envelope.occurredAt || "")))) {
    errors.push("occurredAt must be an ISO-compatible date.");
  }
  return { valid: errors.length === 0, errors };
}
