import { describe, expect, test } from "vitest";
import {
  getWeekendForDate,
  parseLocalDate,
  toDateInputValue,
} from "../../src/lib/date/weekendCalendar.js";
import {
  getCurrentOrNextMidweekDate,
  getInitialMidweekDate,
  getInitialMidweekWindow,
  parseLocalDateInput,
  timeValueToMinutes,
} from "../../src/lib/date/matchweekCalendar.js";
import {
  addPitchClosure,
  getActiveClosedPitchIds,
  isPitchClosureActive,
  reopenPitchClosures,
} from "../../src/lib/domain/pitchClosures.js";
import {
  getWorkspaceFeatures,
  isParkingEnabled,
  withWorkspaceFeature,
} from "../../src/lib/settings/workspaceSettings.js";

describe("calendar boundaries", () => {
  test("Sunday belongs to the weekend that started the previous day", () => {
    expect(getWeekendForDate(new Date(2026, 6, 5))).toEqual({
      saturday: "2026-07-04",
      sunday: "2026-07-05",
    });
  });

  test("local date parsing rejects impossible dates", () => {
    expect(parseLocalDate("2026-02-29")).toBeNull();
    expect(parseLocalDateInput("2026-02-29")).toBeNull();
    expect(toDateInputValue(new Date(2026, 6, 3))).toBe("2026-07-03");
  });

  test("weekend dates resolve to the next Monday for midweek operations", () => {
    expect(getCurrentOrNextMidweekDate(new Date(2026, 6, 4))).toBe("2026-07-06");
    expect(getCurrentOrNextMidweekDate(new Date(2026, 6, 5))).toBe("2026-07-06");
  });

  test("midweek defaults are safe when browser storage is unavailable", () => {
    expect(getInitialMidweekDate(new Date(2026, 6, 4))).toBe("2026-07-06");
    expect(getInitialMidweekWindow()).toEqual({ start: "18:00", end: "21:30" });
  });

  test("invalid clock values are rejected instead of entering scheduling state", () => {
    expect(timeValueToMinutes("18:30", -1)).toBe(1110);
    expect(timeValueToMinutes("25:90", -1)).toBe(-1);
    expect(timeValueToMinutes("invalid", -1)).toBe(-1);
  });
});

describe("pitch closure lifecycle", () => {
  test("range closures are active inclusively and can be reopened", () => {
    const records = addPitchClosure([], {
      pitchId: "P2",
      mode: "range",
      effectiveFrom: "2026-07-03",
      effectiveTo: "2026-07-05",
      reason: "Waterlogged",
    });

    expect(isPitchClosureActive(records[0], "2026-07-03")).toBe(true);
    expect(isPitchClosureActive(records[0], "2026-07-05")).toBe(true);
    expect(isPitchClosureActive(records[0], "2026-07-06")).toBe(false);
    expect(getActiveClosedPitchIds(records, "2026-07-04")).toEqual(["P2"]);

    const reopened = reopenPitchClosures(records, ["P2"], "2026-07-04", {
      reopenedBy: "Test user",
    });
    expect(getActiveClosedPitchIds(reopened, "2026-07-04")).toEqual([]);
  });

  test("a replacement closure retires the overlapping previous record", () => {
    const first = addPitchClosure([], {
      pitchId: "P3",
      mode: "untilReopened",
      effectiveFrom: "2026-07-03",
    });
    const second = addPitchClosure(first, {
      pitchId: "P3",
      mode: "matchday",
      effectiveFrom: "2026-07-04",
    });

    expect(second).toHaveLength(2);
    expect(second.filter((record) => !record.reopenedAt)).toHaveLength(1);
  });
});

describe("workspace features", () => {
  test("parking defaults on and can be toggled without mutating the source object", () => {
    const club = { name: "Test Club" };
    const updated = withWorkspaceFeature(club, "parkingEnabled", false);

    expect(getWorkspaceFeatures(club).parkingEnabled).toBe(true);
    expect(isParkingEnabled(updated)).toBe(false);
    expect(club.features).toBeUndefined();
  });
});
