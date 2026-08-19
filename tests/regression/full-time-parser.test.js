// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import {
  deduplicateFullTimeFixtures,
  isHSMHome,
  parseFullTimeHtml,
} from "../../src/lib/fullTimeParser.js";

describe("FA Full-Time fixture parsing", () => {
  test("recognises supported club-name variants", () => {
    expect(isHSMHome("Horwich St. Mary's U14 Spartans")).toBe(true);
    expect(isHSMHome("HSM Reserves")).toBe(true);
    expect(isHSMHome("Another Club")).toBe(false);
  });

  test("returns only home fixtures on the requested date", () => {
    const html = `
      <table>
        <tr><td>03/07/2026</td><td>10:00</td><td>Horwich St Mary's U14 Spartans</td><td>-</td><td>Visitors A</td></tr>
        <tr><td>03/07/2026</td><td>11:00</td><td>Another Club</td><td>-</td><td>Horwich St Mary's U15</td></tr>
        <tr><td>04/07/2026</td><td>10:00</td><td>HSM Reserves</td><td>-</td><td>Visitors B</td></tr>
      </table>
    `;

    const fixtures = parseFullTimeHtml(html, "2026-07-03");

    expect(fixtures).toHaveLength(1);
    expect(fixtures[0]).toMatchObject({
      homeTeam: "Horwich St Mary's U14 Spartans",
      awayTeam: "Visitors A",
      status: "active",
      refStatus: "TBC",
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
