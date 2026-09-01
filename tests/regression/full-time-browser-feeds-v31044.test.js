// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { deduplicateFixtureSet, getConfiguredFixtureSources, reconcileFullTimeFixtureSnapshot } from "../../src/hooks/useFixtureFetcher.js";
import { parseFullTimeDate, parseFullTimeHtml } from "../../src/lib/fullTimeParser.js";
import {
  buildFullTimeFeedDocument,
  BBDFL_FIXTURE_FEEDS,
  LANCASHIRE_AMATEUR_FIXTURE_FEEDS,
  normaliseFullTimeFeedId,
} from "../../src/lib/fullTimeFeed.js";
import { applyFixtureOverrides, partitionFixturesForScheduling } from "../../src/lib/domain/fixtureVenueFlow.js";
import { scheduleSat } from "../../src/lib/scheduler.js";
import { PITCHES, TEAM_CONFIG_DEFAULT } from "../../src/lib/constants.js";

describe("Daxora Ground Control v3.10.44 official Full-Time browser feeds", () => {
  test("keeps Cobras, Avengers and Knights on one canonical source identity when Full-Time changes KO without a fixture URL", () => {
    const options = { sourceId: "bolton-youth-league", teamAliases: ["Horwich St. Mary's"] };
    const sourceHtml = (times) => `<table><tbody>
      <tr><td colspan="5">Sat 05 Sept 2026</td></tr>
      <tr><td></td><td>Horwich St. Mary's U10 Cobras</td><td>v</td><td>Hindley Town U10 Valkyries</td><td>${times[0]}</td></tr>
      <tr><td></td><td>Horwich St. Mary's U10 Avengers</td><td>v</td><td>Turton U10 Turton Tigers</td><td>${times[1]}</td></tr>
      <tr><td></td><td>Horwich St. Mary's U15 Knights</td><td>v</td><td>AFC Egerton U15 AFC Egerton</td><td>${times[2]}</td></tr>
    </tbody></table>`;

    const before = parseFullTimeHtml(sourceHtml(["09:00", "09:15", "10:30"]), "2026-09-05", options);
    const after = parseFullTimeHtml(sourceHtml(["10:00", "10:45", "11:15"]), "2026-09-05", options);

    expect(before).toHaveLength(3);
    expect(after).toHaveLength(3);
    expect(after.map((fixture) => fixture.sourceFixtureKey)).toEqual(before.map((fixture) => fixture.sourceFixtureKey));

    const once = reconcileFullTimeFixtureSnapshot([], before, "2026-08-01").snapshot;
    const refreshed = reconcileFullTimeFixtureSnapshot(once, after, "2026-08-01");
    const repeated = Array.from({ length: 20 }).reduce(
      (snapshot) => reconcileFullTimeFixtureSnapshot(snapshot, after, "2026-08-01").snapshot,
      once,
    );
    const flow = partitionFixturesForScheduling(repeated);
    const scheduled = scheduleSat(
      flow.home,
      false,
      [],
      TEAM_CONFIG_DEFAULT,
      { "7v7": 15, "11v11-youth": 15 },
      8 * 60 + 30,
      13 * 60,
      PITCHES,
      3,
    );

    expect(refreshed.changes).toHaveLength(3);
    expect(repeated).toHaveLength(3);
    expect(new Set(repeated.map((fixture) => fixture.sourceFixtureKey))).toEqual(new Set(before.map((fixture) => fixture.sourceFixtureKey)));
    expect(flow.home).toHaveLength(3);
    expect(flow.away).toHaveLength(0);
    expect(scheduled.scheduled).toHaveLength(3);
    expect(scheduled.scheduled.map((fixture) => fixture.homeTeam)).toEqual(["U10 Cobras", "U10 Avengers", "U15 Knights"]);
  });

  test("stops a rebuild with duplicated legacy snapshot rows instead of appending generated fixtures", () => {
    const namedFixtures = [
      ["U10 Cobras", "Hindley Town U10 Valkyries", "0:1"],
      ["U10 Avengers", "Turton U10 Turton Tigers", "0:2"],
      ["U15 Knights", "AFC Egerton U15 AFC Egerton", "0:3"],
    ];
    const legacy = namedFixtures.flatMap(([homeTeam, awayTeam]) => ["09:00", "10:00"].map((kickOff) => ({
      date: "2026-09-05",
      homeTeam,
      awayTeam,
      kickOff,
      sourceFixtureKey: `2026-09-05|${homeTeam.toLowerCase()}|${awayTeam.toLowerCase()}|${kickOff}`,
    })));
    const incoming = namedFixtures.map(([homeTeam, awayTeam, sourceRowIndex]) => ({
      date: "2026-09-05",
      homeTeam,
      awayTeam,
      kickOff: "11:15",
      sourceRowIndex,
      sourceId: "bolton-youth-league",
      sourceFixtureKey: `row:bolton-youth-league:${sourceRowIndex}`,
    }));

    const result = reconcileFullTimeFixtureSnapshot(legacy, incoming, "2026-08-01");

    expect(result.safe).toBe(false);
    expect(result.snapshot).toHaveLength(6);
    expect(result.collisions).toHaveLength(3);
    expect(result.collisions.map((collision) => collision.incoming.homeTeam)).toEqual(["U10 Cobras", "U10 Avengers", "U15 Knights"]);
  });

  test("accepts numeric IDs and official code-snippet URLs only", () => {
    expect(normaliseFullTimeFeedId("694052039")).toBe("694052039");
    expect(normaliseFullTimeFeedId("https://fulltime.thefa.com/js/cs1.html?cs=694052039")).toBe("694052039");
    expect(normaliseFullTimeFeedId("https://example.com/js/cs1.html?cs=694052039")).toBe("");
    expect(normaliseFullTimeFeedId("69405<script>")).toBe("");
  });

  test("uses the official Full-Time website embed contract", () => {
    const document = buildFullTimeFeedDocument("694052039");
    expect(document).toContain("var lrcode='694052039'");
    expect(document).toContain("https://fulltime.thefa.com/client/api/cs1.js");
  });

  test("ships the verified Lancashire Amateur fixture feeds rather than result feeds", () => {
    expect(LANCASHIRE_AMATEUR_FIXTURE_FEEDS.map((feed) => feed.id)).toEqual([
      "329570196", "694052039", "853774480", "17848835", "632766284",
    ]);
  });

  test("includes the verified BBDFL club fixture feed", () => {
    expect(BBDFL_FIXTURE_FEEDS).toEqual([{ id: "167398131", name: "BBDFL U14 - Horwich St. Mary's fixtures" }]);
  });

  test("retains future fixtures outside Full-Time's rolling maximum while refreshing matching fixtures", () => {
    const previous = [
      { date: "2026-09-05", homeTeam: "HSM U14", awayTeam: "A", kickOff: "10:00" },
      { date: "2026-10-03", homeTeam: "HSM U14", awayTeam: "B", kickOff: "10:00" },
    ];
    const incoming = [{ date: "2026-09-05", homeTeam: "HSM U14", awayTeam: "A", kickOff: "10:30" }];
    const result = reconcileFullTimeFixtureSnapshot(previous, incoming, "2026-08-19");
    expect(result.snapshot).toEqual([
      expect.objectContaining({ date: "2026-09-05", kickOff: "10:00" }),
      expect.objectContaining({ date: "2026-10-03", awayTeam: "B" }),
    ]);
    expect(result.changes).toEqual([expect.objectContaining({ fields: ["kickOff"] })]);
  });

  test("repeated source rebuilds are idempotent by stable fixture identity", () => {
    const fixture = {
      sourceFixtureKey: "2026-09-05|hsm u15 knights|afc egerton u15|10:00",
      date: "2026-09-05",
      homeTeam: "HSM U15 Knights",
      awayTeam: "AFC Egerton U15",
      kickOff: "10:00",
    };
    const once = reconcileFullTimeFixtureSnapshot([], [fixture], "2026-08-19").snapshot;
    const twice = reconcileFullTimeFixtureSnapshot(once, [fixture], "2026-08-19").snapshot;
    const twenty = Array.from({ length: 20 }).reduce(
      (snapshot) => reconcileFullTimeFixtureSnapshot(snapshot, [fixture], "2026-08-19").snapshot,
      [],
    );
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twenty).toHaveLength(1);
  });

  test("provider kick-off changes upsert the same source row when its fixture URL is stable", () => {
    const previous = [{ sourceFixtureUrl: "https://fulltime.thefa.com/displayFixture.html?id=42", sourceFixtureKey: "old-key", date: "2026-09-05", homeTeam: "U10 Avengers", awayTeam: "Visitors", kickOff: "09:00" }];
    const incoming = [{ sourceFixtureUrl: "https://fulltime.thefa.com/displayFixture.html?id=42", sourceFixtureKey: "new-key", date: "2026-09-05", homeTeam: "U10 Avengers", awayTeam: "Visitors", kickOff: "10:00" }];
    const result = reconcileFullTimeFixtureSnapshot(previous, incoming, "2026-08-19");
    expect(result.snapshot).toHaveLength(1);
    expect(result.snapshot[0]).toMatchObject({ kickOff: "09:00", sourceFixtureUrl: previous[0].sourceFixtureUrl });
  });

  test("upserts duplicate imported rows by source identity without collapsing legitimate repeats", () => {
    const duplicate = { sourceFixtureKey: "source-row-1", date: "2026-09-05", homeTeam: "U15 Knights", awayTeam: "AFC Egerton U15", kickOff: "10:00" };
    const legitimateRepeat = { sourceFixtureKey: "source-row-2", date: "2026-09-05", homeTeam: "U15 Knights", awayTeam: "AFC Egerton U15", kickOff: "12:00" };
    expect(deduplicateFixtureSet([duplicate, { ...duplicate, venue: "Updated" }, legitimateRepeat])).toEqual([
      expect.objectContaining({ sourceFixtureKey: "source-row-1", venue: "Updated" }),
      legitimateRepeat,
    ]);
  });

  test("keeps reversed home metadata when the same source fixture is rebuilt", () => {
    const source = {
      sourceFixtureKey: "reverse-1",
      date: "2026-09-05",
      homeTeam: "Hosts",
      awayTeam: "HSM U15 Crusaders",
      kickOff: "10:00",
      venueRole: "home",
      isAwayFixture: false,
      requiresScheduling: true,
      venueReversal: { originalHomeTeam: "HSM U15 Crusaders", originalAwayTeam: "Hosts" },
    };
    const fixture = applyFixtureOverrides([{ ...source, venueRole: "away", isAwayFixture: true, requiresScheduling: false }], {
      0: {
        fixtureIdentity: "reverse-1",
        venueRole: "home",
        isAwayFixture: false,
        requiresScheduling: true,
        venueReversal: source.venueReversal,
      },
    });
    expect(fixture).toHaveLength(1);
    expect(fixture[0]).toMatchObject({ venueRole: "home", isAwayFixture: false, requiresScheduling: true });
  });

  test("normalises feed sources without requiring a legacy page URL", () => {
    expect(getConfiguredFixtureSources({ enabled: true, sources: [{ feedId: "694052039", name: "Division One" }] })[0]).toMatchObject({
      feedId: "694052039",
      name: "Division One",
    });
  });

  test("upgrades an existing BBDFL source with its U14 label and Horwich fallback alias", () => {
    expect(getConfiguredFixtureSources({ enabled: true, sources: [{
      id: "bbdfl-existing",
      name: "BBDFL - Horwich St. Mary's club fixtures",
      feedId: "167398131",
      teamAliases: "Horwich St. Mary's, Horwich St Mary's",
    }] })[0]).toMatchObject({
      name: "BBDFL U14 - Horwich St. Mary's fixtures",
      teamAliases: ["Horwich St. Mary's", "Horwich St Mary's", "Horwich"],
    });
  });

  test("parses the compact grouped-date table rendered by official feeds", () => {
    const html = `<table><tbody>
      <tr><td colspan="5">Sat 22 Aug 2026 14:30</td></tr>
      <tr><td></td><td>Horwich St. Mary's</td><td>v</td><td>Rossendale Football Club LAL</td><td>Scholes Bank</td></tr>
      <tr><td></td><td>Other Club</td><td>v</td><td>Another Club</td><td>Elsewhere</td></tr>
    </tbody></table>`;
    expect(parseFullTimeDate("Sat 05 Sept 2026 14:30")).toBe("2026-09-05");
    expect(parseFullTimeHtml(html, "2026-08-22", { teamAliases: ["Horwich St. Mary's"] })).toMatchObject([{
      date: "2026-08-22",
      kickOff: "14:30",
      homeTeam: "Horwich St. Mary's",
      awayTeam: "Rossendale Football Club LAL",
    }]);
  });
});
