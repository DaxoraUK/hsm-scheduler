// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  deduplicateFullTimeFixtures,
  isHSMHome,
  parseFullTimeHtml,
} from "../../src/lib/fullTimeParser.js";

describe("FA Full-Time fixture parsing", () => {
  test("retains venue and an assigned referee when the official feed exposes those columns", () => {
    const html = `<table><tr><th>Date</th><th>Home</th><th></th><th>Away</th><th>Venue</th><th>Referee</th></tr><tr><td>22/08/2026 14:30</td><td>Horwich St. Mary's</td><td>v</td><td>Rossendale</td><td>Scholes Bank</td><td>Alex Official</td></tr></table>`;
    expect(parseFullTimeHtml(html, "2026-08-22", { teamAliases: ["Horwich"] })[0]).toMatchObject({ venue: "Scholes Bank", referee: "Alex Official", refStatus: "assigned" });
  });

  test("retains a safe official fixture-detail link for manual league appointment lookup", () => {
    const html = `<table><tr><td>22/08/2026</td><td>14:30</td><td><a href="/displayFixture.html?id=123">Horwich St. Mary's</a></td><td>v</td><td>Rossendale</td></tr></table>`;
    expect(parseFullTimeHtml(html, "2026-08-22", { teamAliases: ["Horwich"] })[0]).toMatchObject({
      sourceFixtureUrl: "https://fulltime.thefa.com/displayFixture.html?id=123",
    });
  });
  test("recognises supported club-name variants", () => {
    expect(isHSMHome("Horwich St. Mary's U14 Spartans")).toBe(true);
    expect(isHSMHome("Horwich St. Mary\\'s", ["Horwich St. Mary's"])).toBe(true);
    expect(isHSMHome("HSM Reserves")).toBe(true);
    expect(isHSMHome("Another Club")).toBe(false);
  });

  test("returns home and away club fixtures on the requested date", () => {
    const html = `
      <table>
        <tr><td>03/07/2026</td><td>10:00</td><td>Horwich St Mary's U14 Spartans</td><td>-</td><td>Visitors A</td></tr>
        <tr><td>03/07/2026</td><td>11:00</td><td>Another Club</td><td>-</td><td>Horwich St Mary's U15</td></tr>
        <tr><td>04/07/2026</td><td>10:00</td><td>HSM Reserves</td><td>-</td><td>Visitors B</td></tr>
      </table>
    `;

    const fixtures = parseFullTimeHtml(html, "2026-07-03");

    expect(fixtures).toHaveLength(2);
    expect(fixtures[0]).toMatchObject({
      homeTeam: "Horwich St Mary's U14 Spartans",
      awayTeam: "Visitors A",
      status: "active",
      refStatus: "TBC",
      venueRole: "home",
      requiresScheduling: true,
    });
    expect(fixtures[1]).toMatchObject({
      homeTeam: "Another Club",
      awayTeam: "Horwich St Mary's U15",
      venueRole: "away",
      isAwayFixture: true,
      requiresScheduling: false,
    });
  });

  test("parses the current Full-Time type, date/time, VS and venue column shape", () => {
    const html = `
      <table>
        <tr><th>Type</th><th>Date / Time</th><th>Home Team</th><th></th><th></th><th>Away Team</th><th>Venue</th></tr>
        <tr><td>U14 Cup</td><td>19/08/26 18:30</td><td>Example Juniors U14</td><td></td><td>VS</td><td>Visitors</td><td>Main Ground</td></tr>
      </table>
    `;
    const fixtures = parseFullTimeHtml(html, "2026-08-19", {
      teamAliases: ["Example Juniors"],
      sourceId: "league-a",
      sourceName: "League A",
    });

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({
      homeTeam: "Example Juniors U14",
      awayTeam: "Visitors",
      date: "2026-08-19",
      kickOff: "18:30",
      isCup: true,
      sourceId: "league-a",
      sourceName: "League A",
    });
  });

  test("deduplicates the same fixture returned by multiple sources", () => {
    const fixture = { date: "2026-08-19", homeTeam: "Example U14", awayTeam: "Visitors", kickOff: "18:30" };
    expect(deduplicateFullTimeFixtures([
      { ...fixture, sourceId: "a" },
      { ...fixture, sourceId: "b" },
    ])).toHaveLength(1);
  });
});
