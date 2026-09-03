import { describe, expect, test } from "vitest";
import {
  buildSchedulingState,
  createManualFixture,
  materialiseEffectiveFixtures,
  mergeFixtureIntent,
  selectEffectiveAllocation,
} from "../../src/lib/domain/schedulingState.js";

const awayIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=away-17";
const homeIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=home-10";

function providerFixture(overrides = {}) {
  return {
    canonicalFixtureIdentity: awayIdentity,
    sourceFixtureUrl: "https://fulltime.thefa.com/displayfixture.html?id=away-17",
    homeTeam: "Visitors U17",
    awayTeam: "HSM U17 Lisbon",
    isAwayFixture: true,
    requiresScheduling: false,
    status: "away",
    date: "2026-09-05",
    ...overrides,
  };
}

function deterministicScheduler(fixtures) {
  return {
    scheduled: fixtures.map((fixture, index) => ({
      ...fixture,
      pitchId: fixture.lockedAllocation?.pitchId || `P${index + 1}`,
      koTime: fixture.lockedAllocation?.koTime || "09:00",
      koMins: fixture.lockedAllocation?.koMins ?? 540,
      endMins: fixture.lockedAllocation?.endMins ?? 630,
    })),
    unresolved: [],
  };
}

describe("canonical scheduling state contract", () => {
  test("venue and locked allocation intent alter one canonical effective fixture", () => {
    let intents = mergeFixtureIntent({}, awayIdentity, {
      venue: { role: "home" },
    });
    intents = mergeFixtureIntent(intents, awayIdentity, {
      allocation: { mode: "locked", pitchId: "P4", koTime: "10:15", koMins: 615, endMins: 705 },
    });

    const effective = materialiseEffectiveFixtures({
      providerFixtures: [providerFixture()],
      intents,
    });

    expect(effective.safe).toBe(true);
    expect(effective.fixtures).toHaveLength(1);
    expect(effective.fixtures[0]).toMatchObject({
      canonicalFixtureIdentity: awayIdentity,
      homeTeam: "HSM U17 Lisbon",
      awayTeam: "Visitors U17",
      isAwayFixture: false,
      requiresScheduling: true,
      lockedAllocation: { pitchId: "P4", koTime: "10:15" },
    });
  });

  test("generated allocation is not promoted to manual intent and is replaced on rebuild", () => {
    const intents = mergeFixtureIntent({}, homeIdentity, {
      allocation: { mode: "unlocked" },
    });
    const fixtures = [{
      canonicalFixtureIdentity: homeIdentity,
      homeTeam: "HSM U10 Cobras",
      awayTeam: "Visitors U10",
      status: "active",
      requiresScheduling: true,
    }];
    let pitch = "P2";
    const scheduler = (input) => ({
      scheduled: input.map((fixture) => ({ ...fixture, pitchId: pitch, koTime: "09:00", koMins: 540, endMins: 600 })),
      unresolved: [],
    });

    const first = buildSchedulingState({ providerFixtures: fixtures, intents, scheduler });
    pitch = "P3a";
    const rebuilt = buildSchedulingState({ providerFixtures: fixtures, intents, scheduler });

    expect(first.scheduled[0].pitchId).toBe("P2");
    expect(rebuilt.scheduled[0].pitchId).toBe("P3a");
    expect(intents[homeIdentity].allocation).toEqual({ mode: "unlocked" });
  });

  test("excluded fixtures have no allocation or unresolved result and retain their provider record", () => {
    const intents = mergeFixtureIntent({}, homeIdentity, {
      exclusion: { reason: "duplicate", recordedAt: "2026-09-03T10:00:00.000Z" },
    });
    const providerFixtures = [{
      canonicalFixtureIdentity: homeIdentity,
      homeTeam: "HSM U10 Cobras",
      awayTeam: "Visitors U10",
      status: "active",
    }];

    const build = buildSchedulingState({ providerFixtures, intents, scheduler: deterministicScheduler });

    expect(build.effective.fixtures).toHaveLength(1);
    expect(build.effective.excluded.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual([homeIdentity]);
    expect(build.scheduled).toEqual([]);
    expect(build.unresolved).toEqual([]);
    expect(selectEffectiveAllocation(build, homeIdentity)).toBeNull();
  });

  test("a canonical identity cannot be both scheduled and unresolved", () => {
    const fixture = {
      canonicalFixtureIdentity: homeIdentity,
      homeTeam: "HSM U10 Cobras",
      awayTeam: "Visitors U10",
      status: "active",
    };

    const build = buildSchedulingState({
      providerFixtures: [fixture],
      scheduler: () => ({ scheduled: [fixture], unresolved: [fixture] }),
    });

    expect(build.safe).toBe(false);
    expect(build.diagnostics).toContainEqual(expect.objectContaining({
      code: "SCHEDULED_AND_UNRESOLVED",
      canonicalFixtureIdentity: homeIdentity,
    }));
  });

  test("manual fixtures receive a stable canonical identity", () => {
    const fixture = createManualFixture({ homeTeam: "HSM U12", awayTeam: "Visitors" }, { id: "cup-final" });
    expect(fixture.canonicalFixtureIdentity).toBe("manual:cup-final");
  });
});
