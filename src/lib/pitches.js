// pitches.js
// Backwards-compatible pitch helpers. New pitch authority lives in
// lib/registry/pitchRegistry.js.

import { normalisePitch, normalisePitchRegistry } from "./registry/pitchRegistry.js";

export const sortPitches = (arr) =>
  [...arr].sort((a, b) => (a.id || "").localeCompare(b.id || "", undefined, { numeric: true }));

export const migratePitch = (pitch) => normalisePitch(pitch);

export const migratePitches = (arr = []) => normalisePitchRegistry(arr);
