import { describe, expect, test } from "vitest";
import { buildHistoryRestoreState } from "../../src/lib/history/historyRestore.js";

describe("matchweek history restore", () => {
  test("restores all saved fixture days and preserves non-active statuses", () => {
    const restored = buildHistoryRestoreState({
      id: 42,
      dateLabel: "12 July 2026",
      fixtureDays: [
        {
          key: "saturday",
          date: "2026-07-11",
          hasRun: true,
          scheduled: [{ id: "sat-1" }],
          postponed: [{ id: "sat-2" }],
          cancelled: [{ id: "sat-3" }],
        },
        {
          key: "sunday",
          date: "2026-07-12",
          hasRun: true,
          scheduled: [{ id: "sun-1" }],
        },
        {
          key: "midweek",
          date: "2026-07-15",
          hasRun: true,
          scheduled: [{ id: "mid-1" }],
        },
      ],
    });

    expect(restored.saturday.date).toBe("2026-07-11");
    expect(restored.saturday.fixtures.map((fixture) => fixture.status)).toEqual([
      "scheduled",
      "postponed",
      "cancelled",
    ]);
    expect(restored.sunday.fixtures).toHaveLength(1);
    expect(restored.midweek.fixtures).toHaveLength(1);
    expect(restored.firstPopulatedDay).toBe("saturday");
  });

  test("supports legacy history entries", () => {
    const restored = buildHistoryRestoreState({
      date: "2026-07-11",
      scheduled: [{ id: "sat-1" }],
      postponedGames: [{ id: "sat-2" }],
      sunScheduled: [{ id: "sun-1" }],
      midweekDate: "2026-07-15",
      midweekScheduled: [{ id: "mid-1" }],
    });

    expect(restored.saturday.fixtures).toHaveLength(2);
    expect(restored.saturday.fixtures[1].status).toBe("postponed");
    expect(restored.sunday.fixtures).toHaveLength(1);
    expect(restored.midweek.date).toBe("2026-07-15");
  });
});
