import { expect, test } from "vitest";
import * as flow from "../../src/lib/domain/fixtureVenueFlow.js";

const imported = { sourceFixtureKey: "feed:fixture-77", homeTeam: "Hosts", awayTeam: "Knights",
  status: "away", isAwayFixture: true, venueRole: "away", requiresScheduling: false,
  koTime: "14:00", venue: "Hosts Ground" };

test("undoes a saved reversal without changing source identity or other fixtures", () => {
  const reversed = flow.reverseAwayFixture(imported);
  expect(typeof flow.restoreAwayFixture).toBe("function");
  const restored = flow.restoreAwayFixture({ ...reversed, koTime: "09:00", koMins: 540, endMins: 630, pitchId: "P1", referee: "Keep this edit" });
  expect(restored).toMatchObject({ sourceFixtureKey: "feed:fixture-77", homeTeam: "Hosts", awayTeam: "Knights",
    status: "away", isAwayFixture: true, requiresScheduling: false, pitchId: "", koTime: "14:00", endMins: null,
    venueReversal: null, referee: "Keep this edit" });
  const overrides = { saved: { ...restored, fixtureIdentity: "feed:fixture-77" } };
  const rehydrated = flow.applyFixtureOverrides([imported, { ...imported, sourceFixtureKey: "feed:other", awayTeam: "Cobras" }], overrides);
  expect(rehydrated[0].isAwayFixture).toBe(true);
  expect(rehydrated[1].awayTeam).toBe("Cobras");
  expect(flow.partitionFixturesForScheduling(rehydrated).home).toEqual([]);
});

test.each(["postponed", "cancelled"])("does not activate an Away %s game during reversal or scheduling partition", (status) => {
  const fixture = { ...imported, status };
  expect(flow.partitionFixturesForScheduling([fixture]).away[0].status).toBe(status);
  const reversed = flow.reverseAwayFixture(fixture);
  expect(reversed.status).toBe(status);
  expect(flow.restoreAwayFixture(reversed).status).toBe(status);
});

test("can undo legacy reversals whose audit metadata only contains original team names", () => {
  expect(typeof flow.restoreAwayFixture).toBe("function");
  const restored = flow.restoreAwayFixture({ ...imported, homeTeam: "Knights", awayTeam: "Hosts", isAwayFixture: false,
    status: "active", pitchId: "P1", venueReversal: { originalHomeTeam: "Hosts", originalAwayTeam: "Knights" } });
  expect(restored).toMatchObject({ homeTeam: "Hosts", awayTeam: "Knights", status: "away", pitchId: "", venueReversal: null });
});
