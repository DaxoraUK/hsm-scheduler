// @vitest-environment jsdom

import { describe, expect, test } from "vitest";
import { isHSMHome, parseFullTimeHtml } from "../../src/lib/fullTimeParser.js";

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
});
