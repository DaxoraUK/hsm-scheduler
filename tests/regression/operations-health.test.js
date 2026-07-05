import { describe, expect, test } from "vitest";
import { calculateOperationsHealth } from "../../src/lib/engines/operationsHealthEngine.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

describe("operations health regressions", () => {
  test("overall score uses domain scores instead of defaulting to 100 when blockers exist", () => {
    const fixtures = [
      makeFixture({
        id: "first",
        pitchId: "P1",
        referee: "A. Green",
        refStatus: "confirmed",
        carEstimate: 36,
      }),
      makeFixture({
        id: "second",
        pitchId: "P2",
        referee: "A. Green",
        refStatus: "confirmed",
        carEstimate: 32,
      }),
    ];

    const health = calculateOperationsHealth({
      fixtures,
      active: fixtures,
      officialConflicts: [{
        id: "official-conflict",
        a: fixtures[0],
        b: fixtures[1],
      }],
      refWarnings: 0,
      pitchCfg: clonePitches(),
      club: makeClub({ capacity: 57 }),
      hasRun: true,
    });

    expect(health.domains.find((domain) => domain.id === "officials")?.status).toBe("danger");
    expect(health.domains.find((domain) => domain.id === "parking")?.status).toBe("danger");
    expect(health.score).toBeLessThan(100);
    expect(health.score).toBeGreaterThan(0);
    expect(health.status).toBe("danger");
    expect(health.label).toBe("Needs action");
  });
});
