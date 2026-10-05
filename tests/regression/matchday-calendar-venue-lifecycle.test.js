import { describe, expect, test } from "vitest";
import { matchdayFixtureToAnnualBooking, buildAnnualPlannerSnapshot, detectAnnualPlannerConflicts } from "../../src/lib/planning/annualPlannerEngine.js";
import { normaliseCoachBooking, buildCoachHubMetrics } from "../../src/lib/coach/coachHubEngine.js";
import { calendarEventCategory, calendarEventLabel, buildCoachCalendarEvents } from "../../src/lib/coach/sharedCalendarEngine.js";
import { reverseAwayFixture, restoreAwayFixture } from "../../src/lib/domain/fixtureVenueFlow.js";

const options = { date: "2026-10-10", sourceType: "matchday_saturday", pitchCfg: [{ id: "P1", label: "Pitch 1", siteId: "ground", siteName: "Club ground" }] };
const fixture = { id: "generated-1", sourceFixtureUrl: "https://fulltime.thefa.com/fixture/123", sourceFixtureKey: "legacy-key", homeTeam: "Visitors", awayTeam: "Cobras", venueRole: "away", isAwayFixture: true, requiresScheduling: false, status: "away", venueName: "Away ground", koTime: "10:30", koMins: 630, cfg: { id: "cobras", gameMins: 80 } };
const project = (row) => matchdayFixtureToAnnualBooking(row, options);

describe("matchday calendar venue and lifecycle", () => {
  test("uses canonical provider identity, not generated id, KO or pitch", () => {
    expect(project(fixture).sourceId).toBe("url:https://fulltime.thefa.com/fixture/123");
    expect(project({ ...fixture, id: "generated-9", koTime: "14:30", koMins: 870, pitchId: "P1" }).sourceId).toBe(project(fixture).sourceId);
    expect(project({ ...fixture, sourceFixtureUrl: "https://fulltime.thefa.com/fixture/456" }).sourceId).not.toBe(project(fixture).sourceId);
  });
  test("Away stays visible to its own coach, without reserving a club pitch", () => {
    const booking = project({ ...fixture, pitchId: "P1", pitchLabel: "Away" });
    expect(booking).toMatchObject({ teamKey: "cobras", teamName: "Cobras", opponentName: "Visitors", fixtureVenueRole: "away", status: "confirmed", venueName: "Away ground", pitchId: "", pitchName: "", venueId: "" });
    expect(buildAnnualPlannerSnapshot({ bookings: [booking], year: 2026 }).metrics.hours).toBe(0);
    expect(calendarEventLabel(normaliseCoachBooking(booking))).toBe("Away fixture");
  });
  test.each(["postponed", "cancelled"])("retains %s Home and Away entries without allocation tasks", (status) => {
    const away = project({ ...fixture, status, pitchId: "P1" });
    const home = project({ ...fixture, status, homeTeam: "Cobras", awayTeam: "Visitors", venueRole: "home", isAwayFixture: false, requiresScheduling: true, pitchId: "P1" });
    for (const row of [away, home]) {
      expect(row).toMatchObject({ status, pitchId: "", pitchName: "" });
      expect(calendarEventCategory(normaliseCoachBooking(row))).toBe("inactive");
      expect(calendarEventLabel(normaliseCoachBooking(row))).toContain(status === "postponed" ? "Postponed" : "Cancelled");
      expect(buildCoachCalendarEvents({ bookings: [normaliseCoachBooking(row)] })).toHaveLength(1);
    }
  });
  test("reversal and undo update the same booking identity and coach team", () => {
    const reversed = { ...reverseAwayFixture(fixture), pitchId: "P1", pitchLabel: "Pitch 1", koTime: "11:00", koMins: 660 };
    expect(project(reversed)).toMatchObject({ sourceId: project(fixture).sourceId, teamName: "Cobras", opponentName: "Visitors", fixtureVenueRole: "home", status: "confirmed", pitchId: "P1", venueName: "Club ground" });
    expect(project(restoreAwayFixture(reversed))).toMatchObject({ sourceId: project(fixture).sourceId, fixtureVenueRole: "away", teamName: "Cobras", pitchId: "" });
  });
  test("unknown kick-off is explicitly TBC rather than a fabricated 09:00 or midnight", () => {
    const booking = project({ ...fixture, koMins: null, koTime: "TBC" });
    expect(booking.fixtureTimeKnown).toBe(false);
    expect(normaliseCoachBooking(booking).fixtureTimeKnown).toBe(false);
  });
  test("unallocated Home is provisional rather than published as confirmed", () => {
    const home = project({ ...fixture, venueRole: "home", isAwayFixture: false, requiresScheduling: true, status: "active" });
    expect(home.status).toBe("provisional");
  });
  test("inactive calendar history is not promoted as the next team activity", () => {
    const metrics = buildCoachHubMetrics({ bookings: [
      { id: "postponed", status: "postponed", startAt: "2026-10-10T08:00:00Z", endAt: "2026-10-10T09:00:00Z" },
      { id: "away", status: "confirmed", fixtureVenueRole: "away", startAt: "2026-10-10T10:00:00Z", endAt: "2026-10-10T11:00:00Z" },
    ] }, new Date("2026-10-05T12:00:00Z"));
    expect(metrics.nextBooking.id).toBe("away");
    expect(metrics.upcomingCount).toBe(1);
  });
  test("Away occupies its team's time but not a club pitch", () => {
    const away = project(fixture);
    const candidate = { teamKey: "cobras", teamName: "Cobras", pitchId: "P1", startAt: away.startAt, endAt: away.endAt, status: "confirmed" };
    const conflicts = detectAnnualPlannerConflicts(candidate, { bookings: [away] });
    expect(conflicts.some((row) => row.type === "team_double_booking")).toBe(true);
    expect(conflicts.some((row) => row.type === "pitch_double_booking")).toBe(false);
  });
});
