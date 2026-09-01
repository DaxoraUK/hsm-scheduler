function clockToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function getFixtureFlowIdentity(fixture = {}) {
  const explicit = fixture.canonicalFixtureIdentity || (fixture.sourceFixtureUrl ? `url:${String(fixture.sourceFixtureUrl).trim().toLowerCase()}` : (fixture.sourceFixtureKey || fixture.fixtureId || fixture.fullTimeId || fixture.id));
  if (explicit != null && String(explicit).trim()) return String(explicit).trim();
  return [
    fixture.date || fixture.fixtureDate || "",
    fixture.homeTeam || "",
    fixture.awayTeam || "",
    fixture.koTime || fixture.kickOff || "",
  ].join("|").toLowerCase();
}

export function getFixtureIdentityAliases(fixture = {}) {
  const aliases = [
    fixture.canonicalFixtureIdentity,
    fixture.sourceFixtureUrl ? `url:${String(fixture.sourceFixtureUrl).trim().toLowerCase()}` : "",
    fixture.sourceFixtureKey,
    fixture.fixtureId,
    fixture.fullTimeId,
    fixture.id,
    ...(Array.isArray(fixture.legacyFixtureIdentities) ? fixture.legacyFixtureIdentities : []),
  ].map((value) => String(value || "").trim()).filter(Boolean);
  return [...new Set(aliases)];
}

export function applyFixtureOverrides(fixtures = [], overrides = {}) {
  const stableOverrides = new Map(
    Object.values(overrides || {})
      .filter((override) => override?.fixtureIdentity)
      .map((override) => [String(override.fixtureIdentity), override]),
  );

  return fixtures.map((fixture, index) => {
    const stable = getFixtureIdentityAliases(fixture).map((identity) => stableOverrides.get(identity)).find(Boolean);
    const legacy = stable ? {} : overrides?.[index] || {};
    const { fixtureIdentity: _fixtureIdentity, ...patch } = { ...legacy, ...(stable || {}) };
    const appliesVenueReversal = patch.venueRole === "home" && Boolean(patch.venueReversal);
    const shouldReverseTeams = appliesVenueReversal && !fixture.effectiveVenueReversalApplied;
    return {
      ...fixture,
      ...patch,
      ...(shouldReverseTeams ? {
        homeTeam: fixture.awayTeam || fixture.homeTeam,
        awayTeam: fixture.homeTeam || fixture.awayTeam,
        effectiveVenueReversalApplied: true,
      } : {}),
      ...(Object.keys(patch).length ? { manualOverrideApplied: true } : {}),
    };
  });
}

export function deduplicateFixtureSet(fixtures = []) {
  const output = [];
  const indexes = new Map();
  fixtures.forEach((fixture) => {
    const identity = getFixtureFlowIdentity(fixture);
    const key = identity == null ? "" : String(identity).trim();
    if (!key || !indexes.has(key)) {
      if (key) indexes.set(key, output.length);
      output.push(fixture);
      return;
    }
    const index = indexes.get(key);
    const merged = { ...output[index] };
    Object.entries(fixture || {}).forEach(([field, value]) => {
      if (value !== undefined && value !== null && value !== "") merged[field] = value;
    });
    output[index] = merged;
  });
  return output;
}

export function prepareAwayFixture(fixture = {}) {
  const koTime = fixture.koTime || fixture.kickOff || "";
  return {
    ...fixture,
    status: "away",
    venueRole: "away",
    isAwayFixture: true,
    requiresScheduling: false,
    pitchId: "",
    pitchLabel: "Away",
    koTime,
    koMins: fixture.koMins ?? clockToMinutes(koTime),
  };
}

export function validateSchedulingFixtureInput(fixtures = []) {
  const identities = new Map();
  fixtures.forEach((fixture) => {
    const canonicalFixtureIdentity = getFixtureFlowIdentity(fixture);
    if (!canonicalFixtureIdentity) return;
    identities.set(canonicalFixtureIdentity, (identities.get(canonicalFixtureIdentity) || 0) + 1);
  });
  const diagnostics = [...identities.entries()]
    .filter(([, count]) => count > 1)
    .map(([canonicalFixtureIdentity, count]) => ({
      code: "DUPLICATE_CANONICAL_FIXTURE",
      canonicalFixtureIdentity,
      count,
    }));
  return { safe: diagnostics.length === 0, diagnostics };
}

export function partitionFixturesForScheduling(fixtures = []) {
  const validation = validateSchedulingFixtureInput(fixtures);
  if (!validation.safe) return { home: [], away: [], ...validation };
  const home = [];
  const away = [];
  fixtures.forEach((fixture) => {
    if (fixture?.isAwayFixture || fixture?.venueRole === "away" || fixture?.requiresScheduling === false) away.push(prepareAwayFixture(fixture));
    else home.push(fixture);
  });
  return { home, away, ...validation };
}

export function reverseAwayFixture(fixture = {}, { actor = "", now = new Date().toISOString() } = {}) {
  const reversedAt = new Date(now).toISOString();
  const canonicalFixtureIdentity = fixture.canonicalFixtureIdentity || (fixture.sourceFixtureUrl ? `url:${String(fixture.sourceFixtureUrl).trim().toLowerCase()}` : "");
  return {
    ...fixture,
    homeTeam: fixture.awayTeam || fixture.homeTeam,
    awayTeam: fixture.homeTeam || fixture.awayTeam,
    status: "active",
    venueRole: "home",
    isAwayFixture: false,
    requiresScheduling: true,
    pitchId: "",
    pitchLabel: "",
    venueReversal: {
      originalHomeTeam: fixture.homeTeam || "",
      originalAwayTeam: fixture.awayTeam || "",
      ...(canonicalFixtureIdentity ? { canonicalFixtureIdentity } : {}),
      actor: String(actor || "").trim(),
      reversedAt,
    },
  };
}
