// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { getConfiguredFixtureSources } from "../../src/hooks/useFixtureFetcher.js";
import { parseFullTimeDate, parseFullTimeHtml } from "../../src/lib/fullTimeParser.js";
import {
  buildFullTimeFeedDocument,
  BBDFL_FIXTURE_FEEDS,
  LANCASHIRE_AMATEUR_FIXTURE_FEEDS,
  normaliseFullTimeFeedId,
} from "../../src/lib/fullTimeFeed.js";

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
    expect(BBDFL_FIXTURE_FEEDS).toEqual([{ id: "167398131", name: "BBDFL - Horwich St. Mary's club fixtures" }]);
  });

  test("normalises feed sources without requiring a legacy page URL", () => {
    expect(getConfiguredFixtureSources({ enabled: true, sources: [{ feedId: "694052039", name: "Division One" }] })[0]).toMatchObject({
      feedId: "694052039",
      name: "Division One",
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
