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
import { applyFixtureOverrides } from "../../src/lib/domain/fixtureVenueFlow.js";

describe("Daxora Ground Control v3.10.44 official Full-Time browser feeds", () => {
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
