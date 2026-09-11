export const POSTPONEMENT_REASONS = Object.freeze({
  weather: "Weather",
  unsafe_pitch: "Waterlogged or unsafe pitch",
  ground_unavailable: "Ground unavailable",
  opposition_request: "Opposition request",
  league_decision: "League decision",
  other: "Other",
});

// Full-Time lifecycle is a provider fact. Keep the vocabulary in one place so
// every operational consumer makes the same active/inactive decision.
export const INACTIVE_FIXTURE_LIFECYCLE_STATUSES = Object.freeze([
  "postponed",
  "cancelled",
  "abandoned",
  "void",
  "withdrawn",
]);

export function normaliseFixtureLifecycleStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "active";
  if (/cancel(?:led|ed)?/.test(text)) return "cancelled";
  if (/postpon/.test(text)) return "postponed";
  if (/abandon/.test(text)) return "abandoned";
  if (/\bvoid(?:ed)?\b/.test(text)) return "void";
  if (/withdraw/.test(text)) return "withdrawn";
  return text === "active" ? "active" : text;
}

export function isInactiveFixtureLifecycle(value) {
  return INACTIVE_FIXTURE_LIFECYCLE_STATUSES.includes(normaliseFixtureLifecycleStatus(value));
}

export function getFixtureProviderLifecycleStatus(fixture = {}) {
  const status = normaliseFixtureLifecycleStatus(
    fixture.providerLifecycleStatus || fixture.providerStatus || fixture.status,
  );
  // Older fixture records overload `status: away` as venue metadata. It is
  // not a provider lifecycle and must not survive an Away-to-Home reversal.
  return status === "active" || INACTIVE_FIXTURE_LIFECYCLE_STATUSES.includes(status)
    ? status
    : "active";
}

export function isFixtureOperationallyActive(fixture = {}) {
  return !isInactiveFixtureLifecycle(getFixtureProviderLifecycleStatus(fixture))
    && !isInactiveFixtureLifecycle(fixture.status);
}

export function filterOperationalFixtureRecords(records = [], providerFixtures = []) {
  const providerByIdentity = new Map(
    (Array.isArray(providerFixtures) ? providerFixtures : []).map((fixture) => [getFixtureFlowIdentity(fixture), fixture]),
  );
  return (Array.isArray(records) ? records : []).filter((record) => {
    const providerFixture = providerByIdentity.get(getFixtureFlowIdentity(record));
    return isFixtureOperationallyActive(providerFixture || record);
  });
}

function timestamp(now) {
  const value = now || new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid postponement timestamp is required.");
  return parsed.toISOString();
}

export function postponeFixture(fixture = {}, { reason, note = "", actor = "", now } = {}) {
  if (!POSTPONEMENT_REASONS[reason]) throw new Error("Choose a valid postponement reason.");
  const existing = fixture.postponement || {};
  return {
    ...fixture,
    status: "postponed",
    postponement: {
      ...existing,
      reason,
      reasonLabel: POSTPONEMENT_REASONS[reason],
      note: String(note || "").trim(),
      actor: String(actor || "").trim(),
      recordedAt: timestamp(now),
      restoredAt: null,
      originalDate: existing.originalDate || fixture.date || fixture.fixtureDate || "",
      originalPitchId: existing.originalPitchId || fixture.pitchId || "",
      originalPitchLabel: existing.originalPitchLabel || fixture.pitchLabel || "",
      originalKoMins: existing.originalKoMins ?? fixture.koMins ?? null,
      originalKoTime: existing.originalKoTime || fixture.koTime || "",
    },
  };
}

export function restoreFixture(fixture = {}, { actor = "", now } = {}) {
  const postponement = fixture.postponement || {};
  return {
    ...fixture,
    status: "active",
    date: postponement.originalDate || fixture.date,
    pitchId: postponement.originalPitchId || fixture.pitchId,
    pitchLabel: postponement.originalPitchLabel || fixture.pitchLabel,
    koMins: postponement.originalKoMins ?? fixture.koMins,
    koTime: postponement.originalKoTime || fixture.koTime,
    postponement: {
      ...postponement,
      restoredAt: timestamp(now),
      restoredBy: String(actor || "").trim(),
    },
  };
}
import { getFixtureFlowIdentity } from "./fixtureVenueFlow.js";
