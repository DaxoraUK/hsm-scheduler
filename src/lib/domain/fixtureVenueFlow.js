function clockToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function getFixtureFlowIdentity(fixture = {}) {
  const explicit = fixture.sourceFixtureUrl ? `url:${String(fixture.sourceFixtureUrl).trim().toLowerCase()}` : (fixture.sourceFixtureKey || fixture.fixtureId || fixture.fullTimeId || fixture.id);
  if (explicit != null && String(explicit).trim()) return String(explicit).trim();
  return [
    fixture.date || fixture.fixtureDate || "",
    fixture.homeTeam || "",
    fixture.awayTeam || "",
    fixture.koTime || fixture.kickOff || "",
  ].join("|").toLowerCase();
}

const ALLOCATION_FIELDS = ["pitchId", "pitchLabel", "koMins", "koTime", "endMins"];

export function applyFixtureOverrides(fixtures = [], overrides = {}, { preserveValidatedAllocation = false } = {}) {
  const stableOverrides = new Map(
    Object.values(overrides || {})
      .filter((override) => override?.fixtureIdentity)
      .map((override) => [String(override.fixtureIdentity), override]),
  );
  const identityCounts = new Map();
  fixtures.forEach((fixture) => {
    const identity = getFixtureFlowIdentity(fixture);
    identityCounts.set(identity, (identityCounts.get(identity) || 0) + 1);
  });

  return fixtures.map((fixture, index) => {
    const identity = getFixtureFlowIdentity(fixture);
    // A stable override is only safe when the imported set has one row for
    // that identity. Duplicate source rows must remain independently indexed
    // until reconciliation removes the duplicate; otherwise one action fans
    // out to every matching fixture.
    const stable = identityCounts.get(identity) === 1 ? stableOverrides.get(identity) : null;
    const indexed = overrides?.[index];
    // Once an override names a fixture, its old array position is not a
    // second target. Scheduling sorts rows and moves inactive rows to the end.
    const legacy = indexed && (!indexed.fixtureIdentity || indexed.fixtureIdentity === identity)
      ? indexed : {};
    const { fixtureIdentity: _fixtureIdentity, ...patch } = { ...legacy, ...(stable || {}) };
    const allocationOverrideInput = Object.fromEntries(
      ALLOCATION_FIELDS.filter((field) => Object.hasOwn(patch, field)).map((field) => [field, patch[field]]),
    );
    // The scheduler has already accepted or replaced this exact allocation
    // request. Do not undo its result when deriving the displayed schedule.
    // A newer edit differs from the consumed request and still applies now.
    if (preserveValidatedAllocation && Object.hasOwn(fixture, "manualAllocationApplied")
      && JSON.stringify(fixture.allocationOverrideInput) === JSON.stringify(allocationOverrideInput)) {
      ALLOCATION_FIELDS.forEach((field) => delete patch[field]);
    }
    return {
      ...fixture, ...patch,
      ...(Object.keys(patch).length ? { manualOverrideApplied: true } : {}),
      ...(Object.keys(allocationOverrideInput).length ? { allocationOverrideInput } : {}),
    };
  });
}

export function deduplicateFixtureSet(fixtures = []) {
  const output = [];
  const indexes = new Map();
  fixtures.forEach((fixture) => {
    const identity = fixture?.sourceFixtureUrl ? `url:${String(fixture.sourceFixtureUrl).trim().toLowerCase()}` : (fixture?.sourceFixtureKey || fixture?.fixtureId || fixture?.fullTimeId || fixture?.id);
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

export function updateFixtureOverride(overrides = {}, index, field, value, fixtureIdentity = "") {
  if (!fixtureIdentity) {
    return { ...overrides, [index]: { ...(overrides[index] || {}), [field]: value } };
  }
  const next = { ...overrides };
  let existing = {};
  Object.entries(overrides).forEach(([key, override]) => {
    if (override?.fixtureIdentity === fixtureIdentity) {
      existing = { ...existing, ...override };
      delete next[key];
    }
  });
  // Upgrade genuinely positional legacy edits only when they have no owner.
  if (overrides[index] && !overrides[index].fixtureIdentity) {
    existing = { ...overrides[index], ...existing };
    delete next[index];
  }
  next[`fixture:${fixtureIdentity}`] = { ...existing, [field]: value, fixtureIdentity };
  return next;
}

export function mergeFixtureScheduleResults(all = [], scheduled = [], away = []) {
  const retained = all.filter((fixture) => fixture?.status === "postponed" || fixture?.status === "cancelled");
  return deduplicateFixtureSet([...scheduled, ...away, ...retained]);
}

export function shouldApplyFixtureImport({ fixtures = [], partial = false, existing = [] } = {}) {
  if (partial) return false;
  return fixtures.length > 0 || existing.length === 0;
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

export function partitionFixturesForScheduling(fixtures = []) {
  const home = [];
  const away = [];
  fixtures.forEach((fixture) => {
    if (fixture?.isAwayFixture || fixture?.venueRole === "away" || fixture?.requiresScheduling === false) away.push(prepareAwayFixture(fixture));
    else home.push(fixture);
  });
  return { home, away };
}

export function reverseAwayFixture(fixture = {}, { actor = "", now = new Date().toISOString() } = {}) {
  const reversedAt = new Date(now).toISOString();
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
      actor: String(actor || "").trim(),
      reversedAt,
    },
  };
}
