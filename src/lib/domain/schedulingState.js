import {
  getFixtureFlowIdentity,
  validateSchedulingFixtureInput,
} from "./fixtureVenueFlow.js";

function cleanIdentity(value) {
  return String(value || "").trim();
}

function cloneIntent(intent = {}) {
  return {
    ...intent,
    ...(intent.venue ? { venue: { ...intent.venue } } : {}),
    ...(intent.allocation ? { allocation: { ...intent.allocation } } : {}),
    ...(intent.exclusion ? { exclusion: { ...intent.exclusion } } : {}),
    ...(intent.official ? { official: { ...intent.official } } : {}),
    ...(intent.lifecycle ? { lifecycle: { ...intent.lifecycle } } : {}),
  };
}

function mergeNested(existing, patch, key) {
  if (!(key in patch)) return existing?.[key] ? { ...existing[key] } : undefined;
  if (patch[key] == null) return undefined;
  return { ...(existing?.[key] || {}), ...(patch[key] || {}) };
}

function uniqueIdentityDiagnostics(fixtures = []) {
  return validateSchedulingFixtureInput(fixtures).diagnostics || [];
}

function applyIntent(fixture = {}, intent = {}) {
  const venueRole = String(intent?.venue?.role || fixture.venueRole || "").toLowerCase();
  const sourceIsAway = Boolean(
    fixture.isAwayFixture || fixture.venueRole === "away" || fixture.requiresScheduling === false,
  );
  const reverseToHome = venueRole === "home" && sourceIsAway;
  const forceAway = venueRole === "away";
  const allocation = intent?.allocation || {};
  const lockedAllocation = allocation.mode === "locked"
    ? {
      pitchId: allocation.pitchId || "",
      pitchLabel: allocation.pitchLabel || allocation.pitchId || "",
      koTime: allocation.koTime || "",
      koMins: allocation.koMins ?? null,
      endMins: allocation.endMins ?? null,
    }
    : null;
  const official = intent?.official || {};
  const lifecycle = intent?.lifecycle || {};

  return {
    ...fixture,
    ...(reverseToHome ? {
      homeTeam: fixture.awayTeam || fixture.homeTeam,
      awayTeam: fixture.homeTeam || fixture.awayTeam,
      venueRole: "home",
      isAwayFixture: false,
      requiresScheduling: true,
      status: lifecycle.status || "active",
      effectiveVenueReversalApplied: true,
    } : {}),
    ...(forceAway ? {
      venueRole: "away",
      isAwayFixture: true,
      requiresScheduling: false,
      status: lifecycle.status || "away",
    } : {}),
    ...(lifecycle.status ? { status: lifecycle.status } : {}),
    ...(Object.keys(official).length ? official : {}),
    ...(lockedAllocation ? { lockedAllocation } : {}),
    ...(intent?.exclusion ? { excludedFromGroundControl: true, exclusion: { ...intent.exclusion } } : {}),
  };
}

export function createManualFixture(fixture = {}, { id } = {}) {
  const generated = id || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const canonicalFixtureIdentity = `manual:${cleanIdentity(generated)}`;
  return {
    ...fixture,
    id: fixture.id || canonicalFixtureIdentity,
    canonicalFixtureIdentity,
    manual: true,
    status: fixture.status || "active",
    requiresScheduling: fixture.requiresScheduling !== false,
  };
}

export function mergeFixtureIntent(intents = {}, fixtureIdentity, patch = {}) {
  const identity = cleanIdentity(fixtureIdentity);
  if (!identity) return { ...(intents || {}) };
  const current = cloneIntent(intents?.[identity] || {});
  const next = {
    ...current,
    ...patch,
    fixtureIdentity: identity,
  };
  ["venue", "allocation", "exclusion", "official", "lifecycle"].forEach((key) => {
    const merged = mergeNested(current, patch, key);
    if (merged === undefined) delete next[key];
    else next[key] = merged;
  });
  return { ...(intents || {}), [identity]: next };
}

export function materialiseEffectiveFixtures({ providerFixtures = [], manualFixtures = [], intents = {} } = {}) {
  const fixtures = [...providerFixtures, ...manualFixtures].map((fixture) => {
    const identity = getFixtureFlowIdentity(fixture);
    const intent = intents?.[identity] || {};
    return applyIntent({ ...fixture, canonicalFixtureIdentity: fixture.canonicalFixtureIdentity || identity }, intent);
  });
  const diagnostics = uniqueIdentityDiagnostics(fixtures);
  const excluded = fixtures.filter((fixture) => fixture.excludedFromGroundControl);
  const included = fixtures.filter((fixture) => !fixture.excludedFromGroundControl);
  const home = included.filter((fixture) =>
    !fixture.isAwayFixture && fixture.venueRole !== "away" && fixture.requiresScheduling !== false,
  );
  const away = included.filter((fixture) => !home.includes(fixture));

  return {
    safe: diagnostics.length === 0,
    diagnostics,
    fixtures,
    included,
    excluded,
    home,
    away,
  };
}

function resultDiagnostics(scheduled = [], unresolved = []) {
  const scheduledIdentities = new Set(scheduled.map(getFixtureFlowIdentity));
  return unresolved
    .map(getFixtureFlowIdentity)
    .filter((identity) => scheduledIdentities.has(identity))
    .map((canonicalFixtureIdentity) => ({
      code: "SCHEDULED_AND_UNRESOLVED",
      canonicalFixtureIdentity,
    }));
}

export function buildSchedulingState({
  providerFixtures = [],
  manualFixtures = [],
  intents = {},
  scheduler,
} = {}) {
  const effective = materialiseEffectiveFixtures({ providerFixtures, manualFixtures, intents });
  if (!effective.safe) {
    return { safe: false, diagnostics: effective.diagnostics, effective, scheduled: [], unresolved: [] };
  }
  const result = typeof scheduler === "function"
    ? scheduler(effective.home)
    : { scheduled: [], unresolved: effective.home.map((fixture) => ({ ...fixture, reason: "No scheduler configured" })) };
  const scheduled = Array.isArray(result?.scheduled) ? result.scheduled : [];
  const unresolved = Array.isArray(result?.unresolved) ? result.unresolved : [];
  const diagnostics = resultDiagnostics(scheduled, unresolved);
  const resultsByIdentity = new Map();
  scheduled.forEach((fixture) => resultsByIdentity.set(getFixtureFlowIdentity(fixture), { status: "scheduled", fixture }));
  unresolved.forEach((fixture) => resultsByIdentity.set(getFixtureFlowIdentity(fixture), { status: "unresolved", fixture }));

  return {
    safe: diagnostics.length === 0,
    diagnostics,
    effective,
    scheduled: diagnostics.length ? [] : scheduled,
    unresolved: diagnostics.length ? [] : unresolved,
    resultsByIdentity,
  };
}

export function selectEffectiveAllocation(build = {}, fixtureIdentity) {
  const result = build?.resultsByIdentity?.get?.(cleanIdentity(fixtureIdentity));
  return result?.status === "scheduled" ? result.fixture : null;
}
