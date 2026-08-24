import { describe, expect, it } from "vitest";
import { buildMatchweekPilotReadiness, hasSavedCurrentMatchweek } from "../../src/lib/pilot/matchweekPilotReadiness.js";

const dates = { satDate: "2026-08-29", sunDate: "2026-08-30", midweekDate: "2026-08-26" };

describe("controlled pilot matchweek readiness", () => {
  it("only accepts history containing every selected matchweek date", () => {
    expect(hasSavedCurrentMatchweek({ history: [{ satDate: dates.satDate, sunDate: dates.sunDate }], scope: "weekend", ...dates })).toBe(true);
    expect(hasSavedCurrentMatchweek({ history: [{ satDate: "2026-08-22", sunDate: "2026-08-23" }], scope: "weekend", ...dates })).toBe(false);
  });

  it("fails closed when demonstration data, unresolved work or unlocked days remain", () => {
    const model = buildMatchweekPilotReadiness({ mode: "test", scope: "weekend", scheduleBuilt: true, fixtureIssues: 1, officialOutstanding: 2, history: [{ satDate: dates.satDate, sunDate: dates.sunDate }], buildDays: [{ enabled: true, hasRun: true, locked: true }, { enabled: true, hasRun: true, locked: false }], ...dates });
    expect(model.ready).toBe(false);
    expect(model.blockers.map((item) => item.id)).toEqual(["live-data", "fixtures", "officials", "locked"]);
  });

  it("reports ready only when the live current plan is resolved, saved and locked", () => {
    const model = buildMatchweekPilotReadiness({ mode: "live", scope: "weekend", scheduleBuilt: true, fixtureIssues: 0, officialOutstanding: 0, officialConflicts: 0, history: [{ satDate: dates.satDate, sunDate: dates.sunDate }], buildDays: [{ enabled: true, hasRun: true, locked: true }, { enabled: true, hasRun: true, locked: true }], ...dates });
    expect(model.ready).toBe(true);
    expect(model.percent).toBe(100);
    expect(model.blockers).toEqual([]);
  });
});
