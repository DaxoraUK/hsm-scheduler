import { describe, expect, test } from "vitest";
import { scheduleSat } from "../../src/lib/scheduler.js";
import {
  appendScheduleMutation,
  buildSchedulingState,
  createScheduleTransaction,
  getProposedSchedule,
  getScheduleTransactionPatches,
  materialiseEffectiveFixtures,
  mergeFixtureAllocationBatch,
  mergeFixtureIntent,
  removeFixtureIntent,
  resolveEffectiveAllocation,
} from "../../src/lib/domain/schedulingState.js";

const identities = ["url:home-a", "url:home-b", "url:away-c"];
const pitches = [
  { id: "P1", label: "Pitch 1", format: "7v7" },
  { id: "P2", label: "Pitch 2", format: "7v7" },
  { id: "P3", label: "Pitch 3", format: "7v7" },
];
const teams = [
  { name: "Home A U10", teamType: "youth", format: "7v7", defaultPitch: "P1", altPitch: "P2", ageOrder: 1, gameMins: 50 },
  { name: "Home B U10", teamType: "youth", format: "7v7", defaultPitch: "P2", altPitch: "P1", ageOrder: 2, gameMins: 50 },
  { name: "Away C U10", teamType: "youth", format: "7v7", defaultPitch: "P3", altPitch: "P1", ageOrder: 3, gameMins: 50 },
];
const providerFixtures = [
  { canonicalFixtureIdentity: identities[0], homeTeam: "Home A U10", awayTeam: "Visitors", status: "active", pitchId: "P1", pitchLabel: "Pitch 1", koTime: "09:00", koMins: 540, endMins: 605 },
  { canonicalFixtureIdentity: identities[1], homeTeam: "Home B U10", awayTeam: "Visitors", status: "active", pitchId: "P2", pitchLabel: "Pitch 2", koTime: "09:00", koMins: 540, endMins: 605 },
  { canonicalFixtureIdentity: identities[2], homeTeam: "Visitors", awayTeam: "Away C U10", status: "away", venueRole: "away", isAwayFixture: true, requiresScheduling: false },
];

function scheduler(fixtures) {
  return scheduleSat(fixtures, false, [], teams, { "7v7": 15 }, 9 * 60, 12 * 60, pitches, 3);
}

describe("canonical scheduling lifecycle", () => {
  test("keeps a Calendar batch, reversal, controls and rebuild on the same canonical fixtures", () => {
    let transaction = createScheduleTransaction({ baseFixtures: providerFixtures.slice(0, 2) });
    transaction = appendScheduleMutation(transaction, { fixtureIdentity: identities[0], patch: { pitchId: "P3", pitchLabel: "Pitch 3", koTime: "09:00", koMins: 540, endMins: 605 } });
    transaction = appendScheduleMutation(transaction, { fixtureIdentity: identities[1], patch: { pitchId: "P1", pitchLabel: "Pitch 1", koTime: "09:00", koMins: 540, endMins: 605 } });

    const proposed = getProposedSchedule(transaction);
    expect(proposed.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual(identities.slice(0, 2));
    expect(proposed.find((fixture) => fixture.canonicalFixtureIdentity === identities[0])).toMatchObject({ pitchId: "P3" });
    expect(proposed.find((fixture) => fixture.canonicalFixtureIdentity === identities[1])).toMatchObject({ pitchId: "P1" });

    let intents = mergeFixtureAllocationBatch({}, getScheduleTransactionPatches(transaction));
    intents = mergeFixtureIntent(intents, identities[2], {
      venue: { role: "home" },
      allocation: { mode: "locked", pitchId: "P2", pitchLabel: "Pitch 2", koTime: "10:15", koMins: 615, endMins: 680 },
      official: { referee: "Canonical Ref", refStatus: "confirmed" },
    });

    const effective = materialiseEffectiveFixtures({ providerFixtures, intents });
    expect(effective.included).toHaveLength(3);
    expect(new Set(effective.included.map((fixture) => fixture.canonicalFixtureIdentity))).toEqual(new Set(identities));
    expect(effective.home.map((fixture) => fixture.canonicalFixtureIdentity)).toContain(identities[2]);
    expect(effective.away.map((fixture) => fixture.canonicalFixtureIdentity)).not.toContain(identities[2]);

    const rebuilds = Array.from({ length: 10 }, () => buildSchedulingState({ providerFixtures, intents, scheduler }));
    const baseline = rebuilds[0];
    expect(baseline.safe).toBe(true);
    expect(baseline.unresolved).toEqual([]);
    expect(baseline.scheduled).toHaveLength(3);
    expect(new Set(baseline.scheduled.map((fixture) => fixture.canonicalFixtureIdentity))).toEqual(new Set(identities));
    rebuilds.forEach((result) => {
      expect(result.scheduled.map((fixture) => [fixture.canonicalFixtureIdentity, fixture.pitchId, fixture.koMins]))
        .toEqual(baseline.scheduled.map((fixture) => [fixture.canonicalFixtureIdentity, fixture.pitchId, fixture.koMins]));
    });

    const reversed = baseline.scheduled.find((fixture) => fixture.canonicalFixtureIdentity === identities[2]);
    const allocation = resolveEffectiveAllocation({ fixture: reversed, derivedAllocation: reversed, intent: intents[identities[2]] });
    expect(allocation).toMatchObject({ canonicalFixtureIdentity: identities[2], pitchId: "P2", koMins: 615, referee: "Canonical Ref" });

    const excludedIntents = mergeFixtureIntent(intents, identities[1], { exclusion: { reason: "Incorrect fixture" } });
    expect(materialiseEffectiveFixtures({ providerFixtures, intents: excludedIntents }).included.map((fixture) => fixture.canonicalFixtureIdentity)).not.toContain(identities[1]);
    expect(materialiseEffectiveFixtures({ providerFixtures, intents: removeFixtureIntent(excludedIntents, identities[1]) }).included.map((fixture) => fixture.canonicalFixtureIdentity)).toContain(identities[1]);
  });
});
