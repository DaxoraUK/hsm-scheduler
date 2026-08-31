export const POSTPONEMENT_REASONS = Object.freeze({
  weather: "Weather",
  unsafe_pitch: "Waterlogged or unsafe pitch",
  ground_unavailable: "Ground unavailable",
  opposition_request: "Opposition request",
  league_decision: "League decision",
  other: "Other",
});

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

export function restoreFixture(fixture = {}, { now } = {}) {
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
    },
  };
}
