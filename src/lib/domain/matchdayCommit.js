import { getFixtureFlowIdentity, validateSchedulingFixtureInput } from "./fixtureVenueFlow.js";
import { validateProposedSchedule } from "./scheduleTransaction.js";

export function selectHydratedMatchday(state, legacyIntents = {}) {
  return Number(state?.revision) > 0
    ? { intents: state.intents || {}, manualFixtures: state.manual_fixtures || [] }
    : { intents: legacyIntents, manualFixtures: state?.manual_fixtures || [] };
}

// Evidence is immutable output, never input to mergeFixtureIntent.
export function prepareMatchdayCommit({ scope, date, build, intents = {}, manualFixtures = [], pitchCfg = [], closedPitches = [], changedIdentities = [], action = "schedule.saved", club = {} } = {}) {
  if (!scope || !date || !build?.safe) throw new Error("Canonical matchday input is unsafe or missing.");
  const scheduled = build.scheduled || [];
  const unresolved = build.unresolved || [];
  const away = build.away || build.effective?.away || [];
  const fixtures = [...scheduled, ...unresolved, ...away];
  if (!validateSchedulingFixtureInput(fixtures).safe) throw new Error("Duplicate canonical identity in saved matchday.");
  const validation = validateProposedSchedule({ fixtures: scheduled, pitchCfg, closedPitches });
  if (validation.blocking.length) throw new Error(validation.blocking.map((item) => `${item.type}: ${item.fixtureIdentity}`).join("; "));
  for (const identity of changedIdentities) {
    const requested = intents[identity]?.allocation;
    if (requested?.mode !== "locked") continue;
    const actual = scheduled.find((fixture) => getFixtureFlowIdentity(fixture) === identity);
    if (!actual || (requested.pitchId && requested.pitchId !== actual.pitchId) || (requested.koTime && requested.koTime !== actual.koTime)) {
      throw new Error(`Requested allocation could not be honoured: ${identity}`);
    }
  }
  return {
    intents, manualFixtures,
    evidence: {
      action, date, dateLabel: `${scope} ${date}`, canonicalIdentities: fixtures.map(getFixtureFlowIdentity).sort(),
      parking: { capacity: club.carParkSpaces, avgCars: club.avgCars, maxConcurrent: club.maxConcurrent, enabled: club.features?.parkingEnabled },
      fixtureDays: [{ key: scope, label: scope, date, hasRun: true, scheduled: [...scheduled, ...away], unresolved }],
    },
  };
}
