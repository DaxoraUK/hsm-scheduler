import { describe, expect, it } from "vitest";
import { partitionFixturesForScheduling, reverseAwayFixture } from "../../src/lib/domain/fixtureVenueFlow.js";

describe("home and away fixture flow", () => {
  it("keeps away fixtures visible but outside pitch scheduling", () => {
    const home = { id: "home", homeTeam: "Club U14", awayTeam: "Visitors", requiresScheduling: true };
    const away = { id: "away", homeTeam: "Hosts", awayTeam: "Club U15", isAwayFixture: true, requiresScheduling: false, kickOff: "11:00" };
    const result = partitionFixturesForScheduling([home, away]);
    expect(result.home).toEqual([home]);
    expect(result.away[0]).toMatchObject({ id: "away", status: "away", pitchLabel: "Away" });
  });

  it("reverses an away fixture into an auditable schedulable home fixture", () => {
    const reversed = reverseAwayFixture({ id: "away", homeTeam: "Hosts", awayTeam: "Club U15", isAwayFixture: true }, { actor: "Club owner", now: "2026-09-01T12:00:00.000Z" });
    expect(reversed).toMatchObject({ homeTeam: "Club U15", awayTeam: "Hosts", status: "active", isAwayFixture: false, requiresScheduling: true });
    expect(reversed.venueReversal).toMatchObject({ originalHomeTeam: "Hosts", originalAwayTeam: "Club U15", reversedAt: "2026-09-01T12:00:00.000Z" });
  });
});
