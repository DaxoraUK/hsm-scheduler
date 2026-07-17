import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { detectAnnualPlannerConflicts } from "../../src/lib/planning/annualPlannerEngine.js";
import {
  calendarEventCategory,
  calendarEventIdentity,
  calendarEventTone,
  COACH_CALENDAR_LEGEND,
} from "../../src/lib/coach/sharedCalendarEngine.js";

const read = (path) => fs.readFileSync(path, "utf8");
const coachCalendar = read("src/components/coach/CoachSharedCalendar.jsx");
const annualPlanner = read("src/pages/AnnualPlannerPage.jsx");
const requestWizard = read("src/components/coach/CoachRequestWizard.jsx");
const migration = read("supabase/migrations/202607170003_pitch_area_split_session_and_calendar_legend.sql");

const pitches = [{
  id: "P4",
  label: "Pitch 4",
  trainingCapacity: 2,
  trainingAreas: [
    { id: "half-a", label: "Half A" },
    { id: "half-b", label: "Half B" },
  ],
}];

const base = {
  title: "U14 training",
  bookingType: "training",
  status: "confirmed",
  teamKey: "u14-spartans",
  teamName: "U14 Spartans",
  pitchId: "P4",
  pitchName: "Pitch 4",
  startAt: "2026-07-31T18:00:00.000Z",
  endAt: "2026-07-31T19:30:00.000Z",
};

describe("Ground Control v3.10.5.2 split pitch areas and calendar legend", () => {
  it("allows a same-team split training session on different named halves", () => {
    const existing = { ...base, id: "half-a-booking", pitchAreaId: "half-a", pitchAreaName: "Half A" };
    const candidate = { ...base, id: "half-b-booking", pitchAreaId: "half-b", pitchAreaName: "Half B" };
    expect(detectAnnualPlannerConflicts(candidate, { bookings: [existing], pitches })).toEqual([]);
  });

  it("still blocks the same team from booking the same half twice", () => {
    const existing = { ...base, id: "first", pitchAreaId: "half-a", pitchAreaName: "Half A" };
    const candidate = { ...base, id: "second", pitchAreaId: "half-a", pitchAreaName: "Half A" };
    const types = detectAnnualPlannerConflicts(candidate, { bookings: [existing], pitches }).map((row) => row.type);
    expect(types).toContain("pitch_area_overlap");
    expect(types).toContain("team_double_booking");
  });

  it("does not relax normal team clashes on different pitches", () => {
    const existing = { ...base, id: "first", pitchAreaId: "half-a", pitchAreaName: "Half A" };
    const candidate = { ...base, id: "second", pitchId: "P5", pitchName: "Pitch 5", pitchAreaId: "half-b", pitchAreaName: "Half B" };
    expect(detectAnnualPlannerConflicts(candidate, { bookings: [existing], pitches }).map((row) => row.type)).toContain("team_double_booking");
  });

  it("gives Half A and Half B distinct calendar identities even if upstream identifiers collide", () => {
    const a = { ...base, kind: "booking", id: "legacy-shared-id", pitchAreaId: "half-a" };
    const b = { ...base, kind: "booking", id: "legacy-shared-id", pitchAreaId: "half-b" };
    expect(calendarEventIdentity(a)).not.toBe(calendarEventIdentity(b));
  });

  it("uses one shared category map for event colours and legend labels", () => {
    expect(COACH_CALENDAR_LEGEND.map((row) => row.key)).toEqual(["approved", "booked", "pending", "fixture", "unavailable"]);
    expect(calendarEventCategory({ status: "confirmed" })).toBe("approved");
    expect(calendarEventCategory({ kind: "request", status: "submitted" })).toBe("pending");
    expect(calendarEventCategory({ bookingType: "friendly", status: "confirmed" })).toBe("fixture");
    expect(calendarEventCategory({ kind: "pitch_closure" })).toBe("unavailable");
    expect(calendarEventTone({ status: "confirmed" })).toContain("bg-emerald-50");
  });

  it("renders both Coach Hub and Annual Planner legends from the shared map", () => {
    expect(coachCalendar).toContain("COACH_CALENDAR_LEGEND.map");
    expect(coachCalendar).toContain("calendarEventIdentity(event)");
    expect(annualPlanner).toContain("COACH_CALENDAR_LEGEND.map");
    expect(annualPlanner).toContain("calendarEventTone(item.booking)");
  });

  it("requires an explicit named area when a shared pitch has configured halves", () => {
    expect(requestWizard).toContain("requiresNamedArea");
    expect(requestWizard).toContain('"Choose a pitch area…"');
    expect(requestWizard).toContain("Each named area is checked separately");
  });

  it("relaxes database team clashes only for different named areas of the same pitch", () => {
    expect(migration.match(/existing\.pitch_area_id<>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("booking.pitch_area_id<>area_value");
    expect(migration).toContain("existing.pitch_id=next_pitch_id");
    expect(migration).toContain("existing.pitch_id=pitch_value");
    expect(migration).toContain("same-team split training is allowed only on different named areas");
  });
});
