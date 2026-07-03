import { describe, expect, test } from "vitest";
import { getParkingSnapshot } from "../../src/lib/engines/parkingEngine.js";
import {
  analyseParkingPressure,
  getEstimatedCarsForFixture,
  getParkingSettings,
} from "../../src/lib/intelligence/parking/parkingService.js";
import { validateFixtureUpdate } from "../../src/lib/engines/validationEngine.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

describe("parking launch regressions", () => {
  test("zero capacity remains unconfigured instead of falling back to a legacy value", () => {
    const club = makeClub({ capacity: 0 });
    const settings = getParkingSettings(club);
    const snapshot = getParkingSnapshot({
      fixtures: [makeFixture()],
      club,
      pitchCfg: clonePitches(),
    });

    expect(settings.carParkSpaces).toBe(0);
    expect(settings.configured).toBe(false);
    expect(snapshot.capacity).toBe(0);
    expect(snapshot.statusKey).toBe("configure");
    expect(snapshot.statusLabel).toBe("Configure");
  });

  test("parking can be disabled without deleting vehicle assumptions", () => {
    const club = makeClub({
      capacity: 57,
      parkingEnabled: false,
      overrides: { avgCars: { "11v11": 41 } },
    });
    const snapshot = getParkingSnapshot({
      fixtures: [makeFixture()],
      club,
      pitchCfg: clonePitches(),
    });

    expect(club.avgCars["11v11"]).toBe(41);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.statusKey).toBe("disabled");
    expect(snapshot.peakCars).toBe(0);
  });

  test("an explicit zero-car estimate is preserved", () => {
    const fixture = makeFixture({ carEstimate: 0 });
    expect(getEstimatedCarsForFixture(fixture, makeClub(), clonePitches())).toBe(0);
  });

  test("15-minute sampling catches a partial overlap", () => {
    const fixtures = [
      makeFixture({ id: "a", koTime: "15:00", koMins: 15 * 60, pitchId: "P1" }),
      makeFixture({ id: "b", koTime: "16:15", koMins: 16 * 60 + 15, pitchId: "P2" }),
    ];
    const analysis = analyseParkingPressure({
      fixtures,
      club: makeClub({ capacity: 57 }),
      pitchCfg: clonePitches(),
      slotMins: 15,
    });

    const overlap = analysis.slots.find((slot) => slot.label === "16:15");
    expect(overlap?.estimatedCars).toBe(72);
    expect(overlap?.overCapacity).toBe(true);
    expect(analysis.isOverCapacity).toBe(true);
  });

  test("low vehicle demand still warns when the concurrent-game control is exceeded", () => {
    const fixtures = ["P1", "P2", "P3", "P4"].map((pitchId, index) =>
      makeFixture({
        id: `low-${index}`,
        pitchId,
        carEstimate: 1,
        extra: { cfg: { format: "11v11", gameMins: 90, ageOrder: 11 } },
      })
    );
    const snapshot = getParkingSnapshot({
      fixtures,
      club: makeClub({ capacity: 100, maxConcurrent: 3 }),
      pitchCfg: clonePitches(),
    });

    expect(snapshot.peakCars).toBe(4);
    expect(snapshot.isOverCapacity).toBe(false);
    expect(snapshot.isOverConcurrentLimit).toBe(true);
    expect(snapshot.statusKey).toBe("watch");
  });

  test("weekend parking uses the busiest daily peak rather than adding different days together", () => {
    const fixtures = [
      makeFixture({ id: "sat", day: "saturday", carEstimate: 36 }),
      makeFixture({ id: "sun", day: "sunday", carEstimate: 28 }),
    ];
    const snapshot = getParkingSnapshot({
      fixtures,
      club: makeClub({ capacity: 57 }),
      pitchCfg: clonePitches(),
      scope: "weekend",
    });

    expect(snapshot.scope).toBe("weekend");
    expect(snapshot.peakCars).toBe(36);
    expect(snapshot.daySnapshots).toHaveLength(2);
  });

  test("manual schedule moves are blocked when physical parking capacity would be exceeded", () => {
    const fixtures = [
      makeFixture({ id: "first", pitchId: "P1", koTime: "09:00", koMins: 540 }),
      makeFixture({ id: "second", pitchId: "P2", koTime: "11:30", koMins: 690 }),
    ];

    const result = validateFixtureUpdate({
      fixtures,
      fixtureIndex: 1,
      patch: { koTime: "09:00", koMins: 540, endMins: 660 },
      pitchCfg: clonePitches(),
      closedPitches: [],
      club: makeClub({ capacity: 57 }),
      changeType: "schedule",
    });

    expect(result.ok).toBe(false);
    expect(result.type).toBe("parking_capacity");
  });
});
