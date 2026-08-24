import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { TEAM_CONFIG_DEFAULT } from "../../src/lib/constants.js";
import { resolveFixtureTeam, scheduleSat } from "../../src/lib/scheduler.js";
import { generateTestFixtures } from "../../src/lib/testData/testFixtureGenerator.js";
import { clonePitches } from "./fixtures.js";

const buffers = {
  "3v3": 15,
  "5v5": 15,
  "7v7": 15,
  "9v9": 15,
  "11v11-youth": 30,
  "11v11": 30,
};

describe("P0 fixture team identity preservation", () => {
  test("generated fixtures carry stable identity and retain it across repeated schedule builds", () => {
    for (let run = 0; run < 100; run += 1) {
      const generated = generateTestFixtures({
        dayKey: "saturday",
        seed: `identity-stress-${run}`,
        scenario: "standard",
        club: { name: "Horwich St Mary's FC" },
        teams: TEAM_CONFIG_DEFAULT,
      });
      expect(generated.every((fixture) => fixture.homeTeamKey)).toBe(true);

      const result = scheduleSat(
        generated,
        false,
        [],
        TEAM_CONFIG_DEFAULT,
        buffers,
        8 * 60 + 30,
        11 * 60 + 30,
        clonePitches(),
        3,
      );

      for (const fixture of [...result.scheduled, ...result.unresolved]) {
        const expected = TEAM_CONFIG_DEFAULT.find((team) =>
          fixture.homeTeamKey === team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        );
        expect(resolveFixtureTeam(fixture, TEAM_CONFIG_DEFAULT)).toBe(expected);
        expect(fixture.homeTeam).toBe(expected.name);
        if (expected.format !== "11v11") {
          expect(fixture.reason || "").not.toContain("adult 14:00");
          expect(fixture.fixedKO).not.toBe(true);
        }
      }
    }
  });

  test("editing or regenerating demonstration data invalidates the matching built schedule", () => {
    const app = readFileSync("src/AppCore.jsx", "utf8");
    expect(app).toContain("setTestSatAndInvalidate");
    expect(app).toContain("setTestSunAndInvalidate");
    expect(app).toContain("setTestMidweekAndInvalidate");
    expect(app).toContain("setSatHasRun(false)");
    expect(app).toContain("setSunHasRun(false)");
    expect(app).toContain("setMidweekHasRun(false)");
  });
});
