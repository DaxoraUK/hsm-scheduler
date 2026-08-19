import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCoachCalendarEvents,
  buildCoachMonthCalendar,
  eventOccursOnDate,
  normaliseCoachPitchClosure,
} from "../../src/lib/coach/sharedCalendarEngine.js";
import {
  buildCoachRequestDraft,
  buildRequestPayload,
  normaliseCoachHubWorkspace,
} from "../../src/lib/coach/coachHubEngine.js";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/202607170001_shared_calendar_request_workflow.sql");
const coachCalendar = read("src/components/coach/CoachSharedCalendar.jsx");
const requestWizard = read("src/components/coach/CoachRequestWizard.jsx");
const reviewDialog = read("src/components/coach/CoachRequestReviewDialog.jsx");
const annualPlanner = read("src/pages/AnnualPlannerPage.jsx");
const pitchSettings = read("src/components/Settings/PitchSettingsPanel.jsx");
const supabase = read("src/lib/supabase.js");
const calendarApi = read("server-api/coach/calendar.js");

function assignment() {
  return { id: "assignment-1", teamKey: "u14-spartans", teamName: "U14 Spartans", canRequestTraining: true, canRequestFriendlies: true, canRequestChanges: true };
}

describe("Ground Control v3.10.5 shared calendar and request workflow", () => {
  it("places shared blackouts across every affected calendar date", () => {
    const events = buildCoachCalendarEvents({
      blackouts: [{ id: "blackout-1", title: "Summer maintenance", start_at: "2026-08-03T08:00:00Z", end_at: "2026-08-05T22:00:00Z", visibility: "club" }],
    });
    expect(eventOccursOnDate(events[0], "2026-08-03")).toBe(true);
    expect(eventOccursOnDate(events[0], "2026-08-04")).toBe(true);
    expect(eventOccursOnDate(events[0], "2026-08-06")).toBe(false);
    const calendar = buildCoachMonthCalendar(2026, 7, events);
    expect(calendar.find((cell) => cell.dateKey === "2026-08-04")?.events).toHaveLength(1);
  });

  it("normalises existing matchday pitch closures for the shared calendar", () => {
    const closure = normaliseCoachPitchClosure({ id: "P4", pitchId: "P4", pitchName: "Pitch 4", effectiveFrom: "2026-08-10", effectiveTo: "2026-08-12", reason: "Drainage work" });
    expect(closure).toMatchObject({ kind: "pitch_closure", pitchId: "P4", pitchName: "Pitch 4", startDate: "2026-08-10", endDate: "2026-08-12" });
    expect(eventOccursOnDate(closure, "2026-08-11")).toBe(true);
  });

  it("keeps blackouts, pitch closures and closure impacts in the coach workspace", () => {
    const workspace = normaliseCoachHubWorkspace({
      assignments: [assignment()],
      blackouts: [{ id: "b1" }],
      pitch_closures: [{ id: "c1" }],
      closure_impacts: [{ id: "i1" }],
      pitches: [{ id: "P4", label: "Pitch 4", trainingAreas: [{ id: "half-a", label: "Half A" }] }],
    });
    expect(workspace.blackouts).toHaveLength(1);
    expect(workspace.pitchClosures).toHaveLength(1);
    expect(workspace.closureImpacts).toHaveLength(1);
    expect(workspace.pitches[0].trainingAreas[0].label).toBe("Half A");
  });

  it("persists pitch areas, acceptable pitches and flexible time in a guided request", () => {
    const draft = buildCoachRequestDraft({
      id: "request-1",
      assignment_id: "assignment-1",
      request_type: "training",
      preferred_pitch_id: "P4",
      preferred_pitch_name: "Pitch 4",
      preferred_pitch_area_id: "half-a",
      preferred_pitch_area_name: "Half A",
      acceptable_pitch_ids: ["P2", "P4"],
      time_flexible: true,
      flexibility_minutes: 60,
      preferred_start_at: "2026-08-03T18:00:00Z",
      preferred_end_at: "2026-08-03T19:30:00Z",
    }, [assignment()]);
    const payload = buildRequestPayload(draft);
    expect(payload.request_id).toBe("request-1");
    expect(payload.preferred_pitch_area_id).toBe("half-a");
    expect(payload.acceptable_pitch_ids).toEqual(["P2", "P4"]);
    expect(payload.time_flexible).toBe(true);
    expect(payload.flexibility_minutes).toBe(60);
  });

  it("uses a guided availability-aware request wizard rather than a free-text pitch", () => {
    expect(requestWizard).toContain("DB.checkCoachHubRequestAvailability");
    expect(requestWizard).toContain("Pitch options");
    expect(requestWizard).toContain("acceptablePitchIds");
    expect(requestWizard).toContain("timeFlexible");
    expect(requestWizard).toContain("selectedAreas");
    expect(requestWizard).toContain("Available alternatives");
  });

  it("gives coaches month and agenda views with closure and pending filters", () => {
    expect(coachCalendar).toContain('setView("month")');
    expect(coachCalendar).toContain('setView("agenda")');
    expect(coachCalendar).toContain("showUnavailable");
    expect(coachCalendar).toContain("showPending");
    expect(coachCalendar).toContain("Blackouts and pitch closures");
    expect(coachCalendar).toContain("onRequestSlot");
  });

  it("shows pending Coach Hub requests and closures in the operator calendar", () => {
    expect(annualPlanner).toContain("coachRequestCalendarBookings");
    expect(annualPlanner).toContain("selectedDayClosures");
    expect(annualPlanner).toContain("Bookings, coach requests, blackouts and pitch closures share one calendar");
    expect(annualPlanner).toContain("Shared calendar");
  });

  it("records and resolves the impact of a new closure on existing bookings", () => {
    expect(migration).toContain("create table if not exists public.annual_planner_closure_impacts");
    expect(migration).toContain("insert into public.annual_planner_closure_impacts");
    expect(migration).toContain("Facility closure affects a team booking");
    expect(migration).toContain("resolve_annual_planner_closure_impact");
    expect(annualPlanner).toContain("ClosureImpactResolutionDialog");
    expect(annualPlanner).toContain("Review and resolve");
    expect(annualPlanner).toContain("awaiting_coach");
  });

  it("keeps internal closure notes away from coach calendar RPC responses", () => {
    expect(migration).toContain("to_jsonb(blackout)-'internal_note'-'created_by'-'updated_by'");
    expect(migration).toContain("blackout.visibility='club'");
    expect(migration).toContain("case when blackout.visibility='operators' then 'The facility is unavailable during this period'");
  });

  it("supports named pitch areas and simultaneous training capacity in settings", () => {
    expect(pitchSettings).toContain("Bookable training areas");
    expect(pitchSettings).toContain("Simultaneous training teams");
    expect(pitchSettings).toContain("normaliseTrainingAreas");
    expect(pitchSettings).toContain("trainingCapacity");
  });

  it("uses saved club pitches and areas when an operator offers an alternative", () => {
    expect(reviewDialog).toContain("Choose pitch");
    expect(reviewDialog).toContain("Pitch allocation");
    expect(reviewDialog).toContain("pitch_id");
    expect(reviewDialog).toContain("pitch_area_id");
    expect(reviewDialog).not.toContain("setVenueName");
  });

  it("loads shared calendar context and uses the v2 request and closure RPCs", () => {
    expect(supabase).toContain('rpc/get_coach_hub_calendar_context');
    expect(supabase).toContain('rpc/check_coach_hub_request_availability');
    expect(supabase).toContain('rpc/submit_coach_hub_request_v2');
    expect(supabase).toContain('rpc/update_my_coach_hub_request_v2');
    expect(supabase).toContain('rpc/review_coach_hub_request_v2');
    expect(supabase).toContain('rpc/save_annual_planner_blackout_v2');
  });

  it("rechecks closure, pending demand and pitch capacity in Supabase", () => {
    expect(migration).toContain("private.pitch_is_closed");
    expect(migration).toContain("private.pitch_slot_available");
    expect(migration).toContain("pending.status in ('submitted','needs_information','alternative_offered')");
    expect(migration).toContain("private.pitch_training_capacity");
    expect(migration).toContain("remaining_capacity");
  });

  it("publishes bookings, blackouts and pitch closures to external calendar feeds", () => {
    expect(calendarApi).toContain("payload.blackouts");
    expect(calendarApi).toContain("payload.pitch_closures");
    expect(calendarApi).toContain("UNAVAILABLE ·");
    expect(calendarApi).toContain("PITCH CLOSED ·");
    expect(migration).toContain("'blackouts'");
    expect(migration).toContain("'pitch_closures'");
  });

  it("adds coach-facing and internal notes plus closure visibility controls", () => {
    expect(annualPlanner).toContain("Public coach-facing note");
    expect(annualPlanner).toContain("Internal note");
    expect(annualPlanner).toContain("Shared with affected coaches");
    expect(migration).toContain("add column if not exists public_note text");
    expect(migration).toContain("add column if not exists internal_note text");
    expect(migration).toContain("add column if not exists visibility text");
  });
});
