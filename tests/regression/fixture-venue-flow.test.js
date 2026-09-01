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
      sourceFixtureKey: "row:bolton-youth-league:0:1",
      homeTeam: "Hindley Town U10 Valkyries",
      awayTeam: "Horwich St. Mary's U10 Cobras",
      status: "away",
      isAwayFixture: true,
      requiresScheduling: false,
    };
    const reversed = reverseAwayFixture(imported, { actor: "Club owner", now: "2026-09-01T12:00:00.000Z" });
    const overrides = {
      0: {
        fixtureIdentity: "row:bolton-youth-league:0:1",
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
    expect(flow.home[0]).toMatchObject({ homeTeam: "Horwich St. Mary's U10 Cobras", awayTeam: "Hindley Town U10 Valkyries", requiresScheduling: true });
    expect(flow.away).toHaveLength(0);
  });

  it("derives one effective home fixture from a canonical provider record without changing its identity", () => {
    const canonicalIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=30782776";
    const canonical = {
      canonicalFixtureIdentity: canonicalIdentity,
      sourceFixtureUrl: "https://fulltime.thefa.com/displayFixture.html?id=30782776",
      homeTeam: "Hindley Town U10 Valkyries",
      awayTeam: "Horwich St. Mary's U10 Cobras",
      isAwayFixture: true,
      requiresScheduling: false,
    };
    const override = {
      fixtureIdentity: canonicalIdentity,
      venueRole: "home",
      isAwayFixture: false,
      requiresScheduling: true,
      venueReversal: {
        originalHomeTeam: "Hindley Town U10 Valkyries",
        originalAwayTeam: "Horwich St. Mary's U10 Cobras",
      },
    };

    const effective = applyFixtureOverrides([canonical], { [canonicalIdentity]: override });
    const flow = partitionFixturesForScheduling(effective);

    expect(effective).toHaveLength(1);
    expect(effective[0]).toMatchObject({
      canonicalFixtureIdentity: canonicalIdentity,
      homeTeam: "Horwich St. Mary's U10 Cobras",
      awayTeam: "Hindley Town U10 Valkyries",
    });
    expect(flow.home).toHaveLength(1);
    expect(flow.away).toHaveLength(0);
  });

  it("blocks scheduling when the canonical input contains the same provider fixture twice", () => {
    const duplicatedIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=30661695";
    const duplicated = [
      { canonicalFixtureIdentity: duplicatedIdentity, homeTeam: "HSM U15 Knights", awayTeam: "AFC Egerton U15", requiresScheduling: true },
      { canonicalFixtureIdentity: duplicatedIdentity, homeTeam: "HSM U15 Knights", awayTeam: "AFC Egerton U15", requiresScheduling: true },
    ];

    const flow = partitionFixturesForScheduling(duplicated);

    expect(flow.safe).toBe(false);
    expect(flow.home).toEqual([]);
    expect(flow.away).toEqual([]);
    expect(flow.diagnostics).toEqual([expect.objectContaining({ canonicalFixtureIdentity: duplicatedIdentity, count: 2 })]);
  });

  it("records a provider reversal against the immutable canonical identity", () => {
    const canonicalIdentity = "url:https://fulltime.thefa.com/displayfixture.html?id=30782770";
    const reversed = reverseAwayFixture({
      canonicalFixtureIdentity: canonicalIdentity,
      sourceFixtureUrl: "https://fulltime.thefa.com/displayFixture.html?id=30782770",
      homeTeam: "Turton U10 Turton Tigers",
      awayTeam: "Horwich St. Mary's U10 Avengers",
      isAwayFixture: true,
    }, { actor: "Club owner", now: "2026-09-01T12:00:00.000Z" });

    expect(reversed.venueReversal).toMatchObject({
      canonicalFixtureIdentity: canonicalIdentity,
      originalHomeTeam: "Turton U10 Turton Tigers",
      originalAwayTeam: "Horwich St. Mary's U10 Avengers",
    });
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
