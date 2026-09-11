// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { parseFullTimeHtml } from "../../src/lib/fullTimeParser.js";
import { getPersistedFullTimeFixturesForDay, reconcileFullTimeFixtureSnapshot } from "../../src/hooks/useFixtureFetcher.js";
import { buildEffectiveMatchdaySchedule } from "../../src/lib/domain/effectiveMatchdaySchedule.js";
import { filterOperationalFixtureRecords } from "../../src/lib/domain/fixtureLifecycle.js";

const identity = "url:https://fulltime.thefa.com/displayfixture.html?id=30205862";

function providerFixture(overrides = {}) {
  return {
    canonicalFixtureIdentity: identity,
    sourceFixtureUrl: "https://fulltime.thefa.com/displayfixture.html?id=30205862",
    sourceId: "lal",
    date: "2026-09-12",
    kickOff: "14:30",
    homeTeam: "Horwich St Mary's Reserves",
    awayTeam: "Bolton Wyresdale",
    venueRole: "home",
    requiresScheduling: true,
    status: "active",
    providerLifecycleStatus: "active",
    ...overrides,
  };
}

function scheduler(fixtures) {
  return {
    scheduled: fixtures.map((fixture) => ({
      ...fixture,
      pitchId: "P2",
      pitchLabel: "Pitch 2",
      koTime: "14:30",
      koMins: 870,
      endMins: 960,
    })),
    unresolved: [],
  };
}

describe("Full-Time provider lifecycle eligibility", () => {
  test("parses postponed, cancelled and abandoned provider rows as distinct inactive lifecycle facts", () => {
    const rows = [
      ["12/09/2026 14:30", "Horwich St Mary's Reserves", "v", "Bolton Wyresdale", "Postponed"],
      ["12/09/2026 14:30", "Horwich St Mary's Reserves", "v", "Bolton Wyresdale", "Cancelled"],
      ["12/09/2026 14:30", "Horwich St Mary's Reserves", "v", "Bolton Wyresdale", "Abandoned"],
    ];

    const statuses = rows.map((cells) => parseFullTimeHtml(
      `<table><tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr></table>`,
      "2026-09-12",
      { teamAliases: ["Horwich St Mary's"] },
    )[0]?.status);

    expect(statuses).toEqual(["postponed", "cancelled", "abandoned"]);
  });

  test("reconciles a postponed Full-Time fixture onto the existing canonical record before it reaches scheduling", () => {
    const active = providerFixture();
    const postponed = providerFixture({ status: "postponed", providerLifecycleStatus: "postponed" });
    const reconciled = reconcileFullTimeFixtureSnapshot([active], [postponed], "2026-09-01");
    const schedule = buildEffectiveMatchdaySchedule({ providerFixtures: reconciled.snapshot, scheduler });

    expect(reconciled.snapshot).toHaveLength(1);
    expect(reconciled.snapshot[0]).toMatchObject({ canonicalFixtureIdentity: identity, status: "postponed" });
    expect(reconciled.changes).toContainEqual(expect.objectContaining({ autoApplied: true, fields: expect.arrayContaining(["status"]) }));
    expect(schedule.fixtures.map((fixture) => fixture.canonicalFixtureIdentity)).toEqual([identity]);
    expect(schedule.scheduled).toEqual([]);
    expect(schedule.unresolved).toEqual([]);
    expect(schedule.byIdentity.get(identity)).toMatchObject({ state: "inactive" });
  });

  test("restores or moves the same provider identity once, while cancelled and abandoned fixtures consume no operational allocation", () => {
    const postponed = providerFixture({ status: "postponed", providerLifecycleStatus: "postponed" });
    const restoredAndMoved = providerFixture({ date: "2026-09-19", status: "active", providerLifecycleStatus: "active" });
    const restored = reconcileFullTimeFixtureSnapshot([postponed], [restoredAndMoved], "2026-09-01").snapshot;

    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ canonicalFixtureIdentity: identity, date: "2026-09-19", status: "active" });
    expect(buildEffectiveMatchdaySchedule({ providerFixtures: restored, scheduler }).scheduled).toHaveLength(1);

    ["cancelled", "abandoned"].forEach((status) => {
      const schedule = buildEffectiveMatchdaySchedule({
        providerFixtures: [providerFixture({ status, providerLifecycleStatus: status })],
        scheduler,
      });
      expect(schedule.scheduled).toEqual([]);
      expect(schedule.unresolved).toEqual([]);
      expect(schedule.byIdentity.get(identity)).toMatchObject({ state: "inactive" });
    });
  });

  test("rehydrates the authoritative provider snapshot instead of replaying an old active operational record", () => {
    const postponed = providerFixture({ status: "postponed", providerLifecycleStatus: "postponed" });
    const persisted = getPersistedFullTimeFixturesForDay({
      enabled: true,
      sources: [{ id: "lal", url: "https://fulltime.thefa.com/displayTeam.html?id=123", enabled: true, fixtureSnapshot: [postponed] }],
    }, "2026-09-12", "saturday");
    const schedule = buildEffectiveMatchdaySchedule({ providerFixtures: persisted, scheduler });

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ canonicalFixtureIdentity: identity, status: "postponed" });
    expect(schedule.scheduled).toEqual([]);
    expect(schedule.unresolved).toEqual([]);
  });

  test("removes an old rendered allocation as soon as its authoritative provider fixture becomes postponed", () => {
    const oldAllocation = { ...providerFixture(), pitchId: "P2", koMins: 870, endMins: 960 };
    const postponed = providerFixture({ status: "postponed", providerLifecycleStatus: "postponed" });

    expect(filterOperationalFixtureRecords([oldAllocation], [postponed])).toEqual([]);
  });
});
