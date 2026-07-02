// pitchRegistry.js
// Single source of truth for pitch configuration, format compatibility,
// linked pitch relationships, surfaces, and display helpers.

const clean = (value) => String(value || "").trim();
const key = (value) => clean(value).toLowerCase();

export const PITCH_FORMATS = Object.freeze({
  MINI_3V3: "3v3",
  MINI_5V5: "5v5",
  SEVEN_V_SEVEN: "7v7",
  NINE_V_NINE: "9v9",
  YOUTH_11V11: "11v11-youth",
  SMALL_11V11: "11v11-small",
  ADULT_11V11: "11v11",
});

export const DEFAULT_PITCHES = Object.freeze([
  { id: "P1", label: "Pitch 1", desc: "Full 11v11", format: PITCH_FORMATS.ADULT_11V11, siteId: "scholes-bank", innerOf: null, independent: false, surface: "grass" },
  { id: "P1a", label: "Pitch 1a", desc: "9v9 (inside P1)", format: PITCH_FORMATS.NINE_V_NINE, siteId: "scholes-bank", innerOf: "P1", independent: false, surface: "grass" },
  { id: "P2", label: "Pitch 2", desc: "Small 11v11", format: PITCH_FORMATS.SMALL_11V11, siteId: "scholes-bank", innerOf: null, independent: false, surface: "grass" },
  { id: "P2a", label: "Pitch 2a", desc: "7v7 (inside P2)", format: PITCH_FORMATS.SEVEN_V_SEVEN, siteId: "scholes-bank", innerOf: "P2", independent: false, surface: "grass" },
  { id: "P3", label: "Pitch 3", desc: "9v9", format: PITCH_FORMATS.NINE_V_NINE, siteId: "scholes-bank", innerOf: null, independent: false, surface: "grass" },
  { id: "P3a", label: "Pitch 3a", desc: "7v7 (inside P3)", format: PITCH_FORMATS.SEVEN_V_SEVEN, siteId: "scholes-bank", innerOf: "P3", independent: false, surface: "grass" },
  { id: "P4", label: "Pitch 4", desc: "Youth 11v11", format: PITCH_FORMATS.YOUTH_11V11, siteId: "scholes-bank", innerOf: null, independent: false, surface: "grass" },
  { id: "P5", label: "Pitch 5", desc: "7v7", format: PITCH_FORMATS.SEVEN_V_SEVEN, siteId: "scholes-bank", innerOf: null, independent: false, surface: "grass" },
  { id: "3v3", label: "3v3 Area", desc: "3v3 (separate)", format: PITCH_FORMATS.MINI_3V3, siteId: "scholes-bank", innerOf: null, independent: true, surface: "grass" },
  { id: "AST", label: "Astro", desc: "Station Park", format: PITCH_FORMATS.MINI_5V5, siteId: "scholes-bank", innerOf: null, independent: true, astroOnly: true, affectsParking: false, surface: "astro" },
]);

export const FORMAT_COMPATIBILITY = Object.freeze({
  [PITCH_FORMATS.MINI_3V3]: ["3v3"],
  [PITCH_FORMATS.MINI_5V5]: ["5v5", "7v7"],
  [PITCH_FORMATS.SEVEN_V_SEVEN]: ["7v7"],
  [PITCH_FORMATS.NINE_V_NINE]: ["9v9"],
  [PITCH_FORMATS.YOUTH_11V11]: ["11v11-youth", "11v11-small"],
  [PITCH_FORMATS.SMALL_11V11]: ["11v11-small", "11v11"],
  [PITCH_FORMATS.ADULT_11V11]: ["11v11", "11v11-small"],
});

export const FORMAT_PITCH_OPTIONS = Object.freeze({
  [PITCH_FORMATS.MINI_3V3]: ["3v3", "AST"],
  [PITCH_FORMATS.MINI_5V5]: ["P5", "AST", "P3a", "P2a"],
  [PITCH_FORMATS.SEVEN_V_SEVEN]: ["P5", "P3a", "P2a"],
  [PITCH_FORMATS.NINE_V_NINE]: ["P3", "P1a", "P3a"],
  [PITCH_FORMATS.YOUTH_11V11]: ["P4", "P2", "P1"],
  [PITCH_FORMATS.SMALL_11V11]: ["P2", "P4", "P1"],
  [PITCH_FORMATS.ADULT_11V11]: ["P1", "P2"],
});

export const MINI_FORMATS = Object.freeze([PITCH_FORMATS.MINI_3V3, PITCH_FORMATS.MINI_5V5]);

export function inferPitchFormat(pitch = {}) {
  const explicit = clean(pitch.format || pitch.pitchFormat || pitch.gameFormat);
  if (explicit) return explicit;

  const text = key(`${pitch.id || ""} ${pitch.label || ""} ${pitch.desc || ""} ${pitch.type || ""}`);
  if (text.includes("3v3")) return PITCH_FORMATS.MINI_3V3;
  if (text.includes("5v5")) return PITCH_FORMATS.MINI_5V5;
  if (text.includes("7v7")) return PITCH_FORMATS.SEVEN_V_SEVEN;
  if (text.includes("9v9")) return PITCH_FORMATS.NINE_V_NINE;
  if (text.includes("youth")) return PITCH_FORMATS.YOUTH_11V11;
  if (text.includes("small")) return PITCH_FORMATS.SMALL_11V11;
  if (text.includes("11v11")) return PITCH_FORMATS.ADULT_11V11;
  return "";
}

export function inferPitchSurface(pitch = {}) {
  const explicit = key(pitch.surface);
  if (explicit) return explicit;

  const text = key(`${pitch.id || ""} ${pitch.label || ""} ${pitch.desc || ""} ${pitch.type || ""}`);
  if (text.includes("astro")) return "astro";
  if (text.includes("3g")) return "3g";
  if (text.includes("4g")) return "4g";
  return "grass";
}

export function normalisePitch(pitch = {}, fallback = {}) {
  const merged = { ...fallback, ...pitch };
  const id = clean(merged.id || merged.pitchId || merged.label || fallback.id);
  const desc = clean(merged.desc || merged.description || fallback.desc);
  const innerMatch = desc.match(/inside\s+(\w+)/i);
  const innerOf = merged.innerOf !== undefined ? merged.innerOf : innerMatch ? innerMatch[1] : null;
  const surface = inferPitchSurface(merged);

  return {
    ...merged,
    id,
    label: clean(merged.label || merged.name || id),
    desc,
    format: inferPitchFormat(merged),
    siteId: clean(merged.siteId || merged.venueId || merged.groundId || fallback.siteId),
    innerOf: innerOf || null,
    independent: Boolean(merged.independent || id === "3v3" || id === "AST"),
    astroOnly: Boolean(merged.astroOnly || ["astro", "3g", "4g", "artificial"].includes(surface)),
    affectsParking: merged.affectsParking !== false,
    surface,
    closed: Boolean(merged.closed || merged.isClosed),
  };
}

export function normalisePitchRegistry(pitches = DEFAULT_PITCHES) {
  const fallbackMap = new Map(DEFAULT_PITCHES.map((pitch) => [pitch.id, pitch]));
  const source = Array.isArray(pitches) && pitches.length ? pitches : DEFAULT_PITCHES;
  return source.map((pitch) => normalisePitch(pitch, fallbackMap.get(pitch.id) || {}));
}

export function createPitchRegistry(pitches = DEFAULT_PITCHES) {
  const all = normalisePitchRegistry(pitches);
  const byId = new Map(all.map((pitch) => [pitch.id, pitch]));

  const getPitch = (pitchId) => byId.get(pitchId) || null;
  const getLinkedPitchIds = (pitchId) => {
    if (!pitchId) return [];
    const target = getPitch(pitchId);
    const linked = new Set([pitchId]);
    if (target?.innerOf) linked.add(target.innerOf);
    all.forEach((pitch) => {
      if (pitch.innerOf === pitchId) linked.add(pitch.id);
      if (target?.innerOf && pitch.innerOf === target.innerOf) linked.add(pitch.id);
    });
    return [...linked].filter(Boolean);
  };

  return {
    all,
    byId,
    getPitch,
    getLinkedPitchIds,
    getInnerPitches: () => all.filter((pitch) => pitch.innerOf),
    getIndependentPitches: () => all.filter((pitch) => pitch.independent),
    getPitchIdsForFormat: (format) => FORMAT_PITCH_OPTIONS[clean(format)] || [],
  };
}

export function getPitchConflictMap(pitches = DEFAULT_PITCHES) {
  return Object.fromEntries(
    normalisePitchRegistry(pitches)
      .filter((pitch) => pitch.innerOf)
      .map((pitch) => [pitch.id, pitch.innerOf])
  );
}

export function getInnerPitchIds(pitches = DEFAULT_PITCHES) {
  return normalisePitchRegistry(pitches).filter((pitch) => pitch.innerOf).map((pitch) => pitch.id);
}

export function getIndependentPitchIds(pitches = DEFAULT_PITCHES) {
  return normalisePitchRegistry(pitches).filter((pitch) => pitch.independent).map((pitch) => pitch.id);
}

export function getCompatiblePitchFormats(format) {
  const normalised = clean(format).toLowerCase();
  return FORMAT_COMPATIBILITY[normalised] || (normalised ? [normalised] : []);
}

export function getPitchDisplayFormat(pitch = {}) {
  return pitch.displayFormat || pitch.formatLabel || pitch.format || pitch.desc || pitch.type || "Unconfigured";
}

export const pitchRegistry = createPitchRegistry(DEFAULT_PITCHES);
