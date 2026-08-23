import { describe, expect, test } from "vitest";
import { neutraliseSpreadsheetFormula } from "../../src/lib/export/spreadsheetSafety.js";
import { escapeCsv } from "../../src/lib/reports/csvExport.js";
import { toCsv } from "../../src/lib/settings/dataExchange.js";
import { leagueAnalyticsToCsv } from "../../src/lib/league/leagueAnalyticsEngine.js";

describe("spreadsheet export safety", () => {
  test.each(["=1+1", "+SUM(A1:A2)", "@command", "-2+3", "  =hidden", "\t@hidden"])(
    "neutralises formula-like text %s",
    (value) => {
      expect(neutraliseSpreadsheetFormula(value)).toBe(`'${value}`);
      expect(escapeCsv(value)).toBe(`'${value}`);
    },
  );

  test("preserves numeric values and ordinary text", () => {
    expect(neutraliseSpreadsheetFormula(-12)).toBe(-12);
    expect(neutraliseSpreadsheetFormula("Horwich St Mary's")).toBe("Horwich St Mary's");
  });

  test("protects settings and league analytics exports", () => {
    expect(toCsv([{ name: "=CMD()" }], [{ key: "name", label: "Name" }])).toContain("'=CMD()");
    const csv = leagueAnalyticsToCsv({
      clubRows: [{ name: "=CMD()" }],
    }, "clubs");
    expect(csv).toContain("'=CMD()");
  });
});
