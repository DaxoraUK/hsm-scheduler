import { describe, expect, it } from "vitest";
import { getInitialMatchWeekend } from "../../src/lib/date/weekendCalendar.js";

describe("fresh-login matchweek selection", () => {
  it("opens the current or immediately upcoming weekend", () => {
    expect(getInitialMatchWeekend(new Date(2026, 7, 31, 9))).toEqual({
      saturday: "2026-09-05",
      sunday: "2026-09-06",
    });
    expect(getInitialMatchWeekend(new Date(2026, 8, 6, 9))).toEqual({
      saturday: "2026-09-05",
      sunday: "2026-09-06",
    });
  });
});
