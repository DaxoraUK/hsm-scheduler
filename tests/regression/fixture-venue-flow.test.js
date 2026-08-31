import { describe, expect, it } from "vitest";
import {
  applyFixtureOverrides,
  partitionFixturesForScheduling,
  reverseAwayFixture,
} from "../../src/lib/domain/fixtureVenueFlow.js";

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

  it("keeps a reversed home override when the imported source is rebuilt", () => {
    const imported = {
      sourceFixtureKey: "full-time:away-1",
      homeTeam: "Hosts",
      awayTeam: "Club U15",
      status: "away",
      isAwayFixture: true,
      requiresScheduling: false,
    };
    const reversed = reverseAwayFixture(imported, { actor: "Club owner", now: "2026-09-01T12:00:00.000Z" });
    const overrides = {
      0: {
        fixtureIdentity: "full-time:away-1",
        homeTeam: reversed.homeTeam,
        awayTeam: reversed.awayTeam,
        status: reversed.status,
        venueRole: reversed.venueRole,
        isAwayFixture: reversed.isAwayFixture,
        requiresScheduling: reversed.requiresScheduling,
        venueReversal: reversed.venueReversal,
      },
    };

    const rebuilt = applyFixtureOverrides([imported], overrides);
    const flow = partitionFixturesForScheduling(rebuilt);
    expect(flow.home).toHaveLength(1);
    expect(flow.home[0]).toMatchObject({ homeTeam: "Club U15", awayTeam: "Hosts", requiresScheduling: true });
    expect(flow.away).toHaveLength(0);
  });

  it("keeps an ordinary away fixture away when no override exists", () => {
    const imported = {
      sourceFixtureKey: "full-time:away-2",
      homeTeam: "Hosts",
      awayTeam: "Club U16",
      status: "away",
      isAwayFixture: true,
      requiresScheduling: false,
    };
    const rebuilt = applyFixtureOverrides([imported], {});
    const flow = partitionFixturesForScheduling(rebuilt);
    expect(flow.home).toHaveLength(0);
    expect(flow.away[0]).toMatchObject({ sourceFixtureKey: "full-time:away-2", status: "away", isAwayFixture: true });
  });

  it("matches a persisted reversal by source identity after import ordering changes", () => {
    const imported = { sourceFixtureKey: "away-ordered", homeTeam: "Hosts", awayTeam: "Club U17", isAwayFixture: true, requiresScheduling: false };
    const reversedOverride = {
      0: {
        fixtureIdentity: "away-ordered",
        homeTeam: "Club U17",
        awayTeam: "Hosts",
        status: "active",
        venueRole: "home",
        isAwayFixture: false,
        requiresScheduling: true,
      },
    };
    const rebuilt = applyFixtureOverrides([
      { sourceFixtureKey: "new-first", homeTeam: "Club U12", awayTeam: "Visitors", requiresScheduling: true },
      imported,
    ], reversedOverride);
    const flow = partitionFixturesForScheduling(rebuilt);
    expect(flow.home.map((fixture) => fixture.sourceFixtureKey)).toEqual(["new-first", "away-ordered"]);
  });

  it("preserves normal home and away partitioning alongside a reversed fixture", () => {
    const home = { sourceFixtureKey: "home-1", homeTeam: "Club U12", awayTeam: "Visitors", requiresScheduling: true };
    const away = { sourceFixtureKey: "away-1", homeTeam: "Hosts", awayTeam: "Club U13", isAwayFixture: true, requiresScheduling: false };
    const overrides = {
      1: {
        fixtureIdentity: "away-1",
        homeTeam: "Club U13",
        awayTeam: "Hosts",
        status: "active",
        venueRole: "home",
        isAwayFixture: false,
        requiresScheduling: true,
      },
    };
    const flow = partitionFixturesForScheduling(applyFixtureOverrides([home, away], overrides));
    expect(flow.home.map((fixture) => fixture.sourceFixtureKey)).toEqual(["home-1", "away-1"]);
    expect(flow.away).toHaveLength(0);
  });
});
