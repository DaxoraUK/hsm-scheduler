import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAnnualPlannerAnalyticsModel } from "../../src/lib/analytics/annualPlannerAnalyticsEngine.js";
import { normaliseAnnualPlannerAlternative } from "../../src/lib/coach/coachHubEngine.js";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202607170009_closure_alternatives_notifications_weather_recovery.sql");
const planner = read("src/pages/AnnualPlannerPage.jsx");
const coachHub = read("src/pages/CoachHubPage.jsx");
const dialog = read("src/components/planning/ClosureImpactResolutionDialog.jsx");
const supabase = read("src/lib/supabase.js");
const analyticsSummary = read("src/components/analytics/AnnualPlannerAnalyticsSummary.jsx");
const roadmap = read("docs/roadmaps/ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md");

describe("Ground Control v3.10.9 closure recovery and coach alternatives", () => {
  it("normalises a closure alternative for Coach Hub", () => {
    const alternative = normaliseAnnualPlannerAlternative({
      id: "alt-1",
      status: "offered",
      booking_title: "U14 training",
      team_name: "U14 Spartans",
      proposed_start_at: "2026-11-03T18:00:00Z",
      proposed_end_at: "2026-11-03T19:30:00Z",
      proposed_pitch_name: "Pitch 4",
      proposed_pitch_area_name: "Half B",
    });
    expect(alternative.status).toBe("offered");
    expect(alternative.bookingTitle).toBe("U14 training");
    expect(alternative.proposedPitchAreaName).toBe("Half B");
  });

  it("creates an isolated database record for each coach alternative", () => {
    expect(migration).toContain("create table if not exists public.annual_planner_booking_alternatives");
    expect(migration).toContain("alter table public.annual_planner_booking_alternatives force row level security");
    expect(migration).toContain("annual_planner_booking_alternatives_coach_read");
  });

  it("keeps offered alternatives pending until the coach accepts", () => {
    expect(migration).toContain("status='awaiting_coach'");
    expect(migration).toContain("coach_response_status='pending'");
    expect(migration).toContain("if response_safe='accept' then");
    expect(migration).toContain("status='accepted'");
  });

  it("rechecks pitch and area capacity before an accepted alternative updates the calendar", () => {
    const responseFunction = migration.slice(migration.indexOf("create or replace function public.respond_to_annual_planner_alternative"));
    expect(responseFunction).toContain("private.pitch_area_slot_available");
    expect(responseFunction.indexOf("private.pitch_area_slot_available")).toBeLessThan(responseFunction.indexOf("update public.annual_planner_bookings booking set"));
    expect(responseFunction).toContain("The offered alternative is no longer available");
  });

  it("queues both in-app and email-worker notifications", () => {
    expect(migration).toContain("private.queue_annual_planner_coach_notification");
    expect(migration).toContain("insert into public.coach_hub_messages");
    expect(migration).toContain("insert into public.coach_hub_booking_reminders");
    expect(migration).toContain("reminder_type_value in ('change','cancellation')");
  });

  it("offers every required operator resolution action", () => {
    expect(dialog).toContain('value="offer_alternative"');
    expect(dialog).toContain('value="relocate"');
    expect(dialog).toContain('value="postpone"');
    expect(dialog).toContain('value="cancel"');
    expect(dialog).toContain('value="acknowledge"');
    expect(dialog).toContain("Winter site slot");
  });

  it("opens closure impacts in a dedicated Annual Planner resolution dialog", () => {
    expect(planner).toContain("ClosureImpactResolutionDialog");
    expect(planner).toContain("Review and resolve");
    expect(planner).toContain("awaiting_coach");
    expect(planner).toContain("postponed");
  });

  it("allows coaches to accept or decline without changing the calendar early", () => {
    expect(coachHub).toContain("Closure alternatives");
    expect(coachHub).toContain("Accept and update calendar");
    expect(coachHub).toContain("Declining returns the booking to the operator action queue");
    expect(supabase).toContain("respond_to_annual_planner_alternative");
    expect(supabase).toContain("list_my_annual_planner_alternatives");
  });

  it("returns declined alternatives to the operator action queue", () => {
    expect(migration).toContain("status='action_required',resolution_action='alternative_declined'");
    expect(migration).toContain("coach_response_status='declined'");
  });

  it("adds closure-resolution evidence to the shared analytics model", () => {
    const model = buildAnnualPlannerAnalyticsModel({
      closure_impacts: [
        { id: "impact-1", status: "relocated", created_at: "2026-10-01T12:00:00Z" },
        { id: "impact-2", status: "awaiting_coach", created_at: "2026-10-02T12:00:00Z" },
        { id: "impact-3", status: "cancelled", created_at: "2026-10-03T12:00:00Z" },
      ],
    }, { year: 2026 });
    expect(model.metrics.closureAffectedBookings).toBe(3);
    expect(model.metrics.closureResolvedBookings).toBe(2);
    expect(model.metrics.closureAwaitingCoach).toBe(1);
    expect(model.metrics.closureResolutionPct).toBe(67);
    expect(model.grantNarratives.join(" ")).toContain("affected by facility closures");
    expect(analyticsSummary).toContain("Closure resolution");
  });

  it("adds closure impacts to the main shared analytics RPC", () => {
    expect(migration).toContain("create or replace function public.get_annual_planner_analytics_data");
    expect(migration).toContain("'closure_impacts'");
    expect(planner).toContain("closureImpacts: workspace.closureImpacts");
  });

  it("updates the committed module roadmap", () => {
    expect(roadmap).toContain("v3.10.9");
    expect(roadmap).toContain("Coach alternatives");
    expect(roadmap).toContain("notification");
  });
});
