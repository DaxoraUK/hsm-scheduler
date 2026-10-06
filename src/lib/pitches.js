// pitches.js
// Backwards-compatible pitch helpers. New pitch authority lives in
// lib/registry/pitchRegistry.js.

import { normalisePitch, normalisePitchRegistry } from "./registry/pitchRegistry.js";

export const sortPitches = (arr) =>
  [...arr].sort((a, b) => (a.id || "").localeCompare(b.id || "", undefined, { numeric: true }));

export const migratePitch = (pitch) => normalisePitch(pitch);

export const migratePitches = (arr = []) => normalisePitchRegistry(arr);

export function createNextPitchIdentity(pitches = []) {
  const rows = Array.isArray(pitches) ? pitches : [];
  const usedIds = new Set(rows.map((pitch) => String(pitch?.id || "").trim().toLowerCase()).filter(Boolean));
  const usedLabels = new Set(rows.map((pitch) => String(pitch?.label || pitch?.name || "").trim().toLowerCase()).filter(Boolean));

  let number = 1;
  while (usedIds.has(`p${number}`) || usedLabels.has(`pitch ${number}`)) number += 1;

  return { id: `P${number}`, label: `Pitch ${number}` };
}
export function createPlayingAreaId(existingAreas = []) {
  const used = new Set(existingAreas.map(area => area?.id));
  let id;
  do {
    id = `playing-area-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
  } while (used.has(id));
  return id;
}
