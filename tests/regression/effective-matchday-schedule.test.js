import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { buildEffectiveMatchdaySchedule, resolveEffectiveFixtureAllocation } from "../../src/lib/domain/effectiveMatchdaySchedule.js";

const homeIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=home-1";
const reversedIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=away-1";

function scheduler(fixtures) {
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

describe("effective matchday schedule", () => {
  test("materialises every canonical fixture once and exposes one effective allocation per scheduled identity", () => {
    const schedule = buildEffectiveMatchdaySchedule({
      providerFixtures: [
        { canonicalFixtureIdentity: homeIdentity, homeTeam: "HSM U12", awayTeam: "Visitors", requiresScheduling: true },
        { canonicalFixtureIdentity: reversedIdentity, homeTeam: "Hosts", awayTeam: "HSM U13", isAwayFixture: true, requiresScheduling: false },
      ],
      manualFixtures: [{ canonicalFixtureIdentity: "manual:cup-final", manual: true, homeTeam: "HSM U14", awayTeam: "Visitors", requiresScheduling: true }],
      intents: {
        [reversedIdentity]: {
          venue: { role: "home" },
          allocation: { mode: "locked", pitchId: "P4", koTime: "11:45", koMins: 705 },
        },
      },
      scheduler,
      revision: 7,
    });

    expect(schedule.safe).toBe(true);
    expect(schedule.revision).toBe(7);
    expect(schedule.fixtures.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual([
      homeIdentity,
      reversedIdentity,
      "manual:cup-final",
    ]);
    expect(schedule.scheduled.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual([
      homeIdentity,
      reversedIdentity,
      "manual:cup-final",
    ]);
    expect(schedule.unresolved).toEqual([]);
    expect(schedule.byIdentity.get(reversedIdentity)).toMatchObject({
      state: "scheduled",
      allocation: { pitchId: "P4", koTime: "11:45", koMins: 705 },
    });
    expect(resolveEffectiveFixtureAllocation(schedule, reversedIdentity)).toMatchObject({
      canonicalFixtureIdentity: reversedIdentity,
      pitchId: "P4",
      koTime: "11:45",
    });
  });

  test("removes excluded identities from all operational results without deleting their provider fixture", () => {
    const schedule = buildEffectiveMatchdaySchedule({
      providerFixtures: [{ canonicalFixtureIdentity: homeIdentity, homeTeam: "HSM U12", awayTeam: "Visitors" }],
      intents: { [homeIdentity]: { exclusion: { reason: "duplicate" } } },
      scheduler,
    });

    expect(schedule.fixtures).toHaveLength(1);
    expect(schedule.excluded.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual([homeIdentity]);
    expect(schedule.scheduled).toEqual([]);
    expect(schedule.unresolved).toEqual([]);
    expect(schedule.byIdentity.get(homeIdentity).state).toBe("excluded");
  });

  test("blocks unsafe output if a canonical identity is duplicated or reported both scheduled and unresolved", () => {
    const duplicate = { canonicalFixtureIdentity: homeIdentity, homeTeam: "HSM U12", awayTeam: "Visitors" };
    const duplicateSchedule = buildEffectiveMatchdaySchedule({
      providerFixtures: [duplicate, { ...duplicate }],
      scheduler,
    });
    const contradictorySchedule = buildEffectiveMatchdaySchedule({
      providerFixtures: [duplicate],
      scheduler: () => ({ scheduled: [duplicate], unresolved: [duplicate] }),
    });

    expect(duplicateSchedule.safe).toBe(false);
    expect(duplicateSchedule.scheduled).toEqual([]);
    expect(duplicateSchedule.diagnostics).toContainEqual(expect.objectContaining({
      code: "DUPLICATE_CANONICAL_FIXTURE",
      canonicalFixtureIdentity: homeIdentity,
    }));
    expect(contradictorySchedule.safe).toBe(false);
    expect(contradictorySchedule.scheduled).toEqual([]);
    expect(contradictorySchedule.unresolved).toEqual([]);
    expect(contradictorySchedule.diagnostics).toContainEqual(expect.objectContaining({
      code: "SCHEDULED_AND_UNRESOLVED",
      canonicalFixtureIdentity: homeIdentity,
    }));
  });

  test("routes the day scheduling hook through an effective schedule instead of replaying raw presentation overrides", () => {
    const hook = readFileSync("src/hooks/useFixtureDayScheduling.js", "utf8");

    expect(hook).toContain("effectiveSchedule");
    expect(hook).toContain("effectiveSchedule?.scheduled");
    expect(hook).not.toContain("applyFixtureOverrides(scheduled");
    expect(hook).not.toContain("toFixturePresentationOverrides(overrides)");
  });
});
