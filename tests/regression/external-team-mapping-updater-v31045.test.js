import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { findCfg, scheduleSat } from "../../src/lib/scheduler.js";

describe("v3.10.45 external team mapping and local updater", () => {
  const team = {
    id: "hsm-first",
    name: "HSM 1st Team",
    externalAliases: "Horwich St. Mary's, Horwich St Marys",
    format: "11v11",
    gameMins: 90,
    defaultPitch: "P1",
    altPitch: "P2",
    ageOrder: 1,
  };

  test("maps an official provider name to the club's internal team", () => {
    expect(findCfg("Horwich St. Mary's", [team])).toBe(team);
  });

  test("retains the official name while scheduling under the internal team identity", () => {
    const result = scheduleSat(
      [{ homeTeam: "Horwich St. Mary's", awayTeam: "Rossendale", status: "active" }],
      false, [], [team], { "11v11": 15 }, 8 * 60, 18 * 60,
      [{ id: "P1", label: "Pitch 1", formats: ["11v11"], surface: "grass", independent: true }],
      3
    );
    expect(result.unresolved).toHaveLength(0);
    expect(result.scheduled[0]).toMatchObject({
      homeTeam: "HSM 1st Team",
      sourceHomeTeam: "Horwich St. Mary's",
      teamId: "hsm-first",
    });
  });

  test("the updater verifies checksums and uses isolated extraction", () => {
    const updater = readFileSync("scripts/daxora-release/Install-DaxoraUpdate.ps1", "utf8");
    expect(updater).toContain("Get-FileHash -LiteralPath $Package");
    expect(updater).toContain("Expand-Archive -LiteralPath $Package");
    expect(updater).toContain("staging-");
  });
});
