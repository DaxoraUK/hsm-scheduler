import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  annualBookingToPayload,
  detectAnnualPlannerConflicts,
  normaliseAnnualBooking,
} from "../../src/lib/planning/annualPlannerEngine.js";
import { buildCoachCalendarEvents } from "../../src/lib/coach/sharedCalendarEngine.js";

const read = (path) => fs.readFileSync(path, "utf8");
const pitchSettings = read("src/components/Settings/PitchSettingsPanel.jsx");
const annualPlanner = read("src/pages/AnnualPlannerPage.jsx");
const coachCalendar = read("src/components/coach/CoachSharedCalendar.jsx");
const migration = read("supabase/migrations/202607170002_pitch_area_calendar_refresh_repair.sql");

const baseBooking = {
  title: "Training",
  bookingType: "training",
  status: "confirmed",
  pitchId: "P4",
  pitchName: "Pitch 4",
  startAt: "2026-08-03T18:00:00.000Z",
  endAt: "2026-08-03T19:30:00.000Z",
};

const pitches = [{
  id: "P4",
  label: "Pitch 4",
  trainingCapacity: 2,
  trainingAreas: [
    { id: "half-a", label: "Half A" },
    { id: "half-b", label: "Half B" },
  ],
}];

describe("Ground Control v3.10.5.1 pitch-area and calendar refresh repair", () => {
  it("normalises object-backed pitch areas without rendering object text", () => {
    expect(pitchSettings).toContain("safeTrainingAreaText");
    expect(pitchSettings).toContain('"[object Object]"');
    expect(pitchSettings).toContain('"object:object"');
    expect(pitchSettings).toContain("Object.entries(value)");
    expect(pitchSettings).toContain("editableTrainingAreas");
  });

  it("preserves spaces while a pitch-area name is being typed", () => {
    expect(pitchSettings).toContain("preserveWhitespace: true");
    expect(pitchSettings).toContain('{ ...area, [field]: value }');
    expect(pitchSettings).toContain('onChange={(event) => updateTrainingArea(selectedIndex, areaIndex, "label", event.target.value)}');
    expect(pitchSettings).not.toContain('updateTrainingArea(selectedIndex, areaIndex, "label", event.target.value.trim())');
  });

  it("persists pitch-area identity through Annual Planner payloads", () => {
    const booking = normaliseAnnualBooking({
      ...baseBooking,
      pitch_area_id: "half-a",
      pitch_area_name: "Half A",
    });
    expect(booking.pitchAreaId).toBe("half-a");
    expect(booking.pitchAreaName).toBe("Half A");
    expect(annualBookingToPayload(booking)).toMatchObject({
      pitch_area_id: "half-a",
      pitch_area_name: "Half A",
    });
  });

  it("allows two simultaneous Pitch 4 bookings when they use different halves", () => {
    const existing = {
      ...baseBooking,
      id: "booking-a",
      teamKey: "team-a",
      pitchAreaId: "half-a",
      pitchAreaName: "Half A",
    };
    const candidate = {
      ...baseBooking,
      id: "booking-b",
      teamKey: "team-b",
      pitchAreaId: "half-b",
      pitchAreaName: "Half B",
    };
    expect(detectAnnualPlannerConflicts(candidate, { bookings: [existing], pitches })).toEqual([]);
  });

  it("blocks a second simultaneous booking on the same named half", () => {
    const existing = {
      ...baseBooking,
      id: "booking-a",
      teamKey: "team-a",
      pitchAreaId: "half-a",
      pitchAreaName: "Half A",
    };
    const candidate = {
      ...baseBooking,
      id: "booking-b",
      teamKey: "team-b",
      pitchAreaId: "half-a",
      pitchAreaName: "Half A",
    };
    expect(detectAnnualPlannerConflicts(candidate, { bookings: [existing], pitches }).map((row) => row.type)).toContain("pitch_area_overlap");
  });

  it("blocks a third simultaneous training booking when pitch capacity is two", () => {
    const bookings = ["half-a", "half-b"].map((area, index) => ({
      ...baseBooking,
      id: `booking-${index}`,
      teamKey: `team-${index}`,
      pitchAreaId: area,
      pitchAreaName: area === "half-a" ? "Half A" : "Half B",
    }));
    const candidate = {
      ...baseBooking,
      id: "booking-c",
      teamKey: "team-c",
      pitchAreaId: "warm-up-zone",
      pitchAreaName: "Warm-up zone",
    };
    expect(detectAnnualPlannerConflicts(candidate, { bookings, pitches }).map((row) => row.type)).toContain("pitch_training_capacity");
  });

  it("shows each booking's half in operator and coach calendars", () => {
    const events = buildCoachCalendarEvents({
      bookings: [{ ...baseBooking, id: "a", pitch_area_id: "half-a", pitch_area_name: "Half A" }],
    });
    expect(events[0].pitchAreaName).toBe("Half A");
    expect(annualPlanner).toContain('item.booking.pitchAreaName ? ` · ${item.booking.pitchAreaName}`');
    expect(annualPlanner).toContain("booking.pitchAreaName");
    expect(coachCalendar).toContain("event.pitchAreaName");
  });

  it("silently refreshes the Annual Planner request queue and keeps a manual fallback", () => {
    expect(annualPlanner).toContain("window.setInterval(shadowRefresh, 6000)");
    expect(annualPlanner).toContain('window.addEventListener("focus", shadowRefresh)');
    expect(annualPlanner).toContain('document.addEventListener("visibilitychange", handleVisibility)');
    expect(annualPlanner).toContain('loadWorkspace({ quiet: true })');
    expect(annualPlanner).toContain("Refreshing requests quietly");
    expect(annualPlanner).toContain("Refresh");
  });

  it("enforces area-aware capacity when saving or approving bookings in Supabase", () => {
    expect(migration).toContain("create or replace function private.pitch_area_slot_available");
    expect(migration).toContain("existing.pitch_area_id = area_value");
    expect(migration).toContain("private.pitch_area_slot_available(target_club_id,next_pitch_id,next_pitch_area_id");
    expect(migration).toContain("request_row.proposed_pitch_area_id");
    expect(migration).toContain("pitch_area_id=pitch_area_value");
    expect(migration).toContain("pitch_area_id,pitch_area_name,start_at,end_at");
  });

  it("counts pending Coach Hub requests against the selected area", () => {
    expect(migration).toContain("pending.preferred_pitch_area_id=area_value");
    expect(migration).toContain("area_used_capacity");
    expect(migration).toContain("The selected pitch area is already allocated during this period");
  });
});
