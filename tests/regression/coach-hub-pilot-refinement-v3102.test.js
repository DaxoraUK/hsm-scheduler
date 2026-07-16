import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildAnnualPlannerUtilisation,
  buildBookingCostReconciliation,
  buildCoachCommunicationAudience,
  buildCoachEngagementMetrics,
  buildRequestConversation,
  parseDateExceptions,
} from "../../src/lib/coach/coachHubPilotEngine.js";
import { buildAnnualPlannerCoachAudience } from "../../src/lib/communications/coachAudience.js";
import { buildRequestPayload } from "../../src/lib/coach/coachHubEngine.js";
import { expandRecurringBookingDraft } from "../../src/lib/planning/annualPlannerEngine.js";

const migration = readFileSync("supabase/migrations/202607150005_coach_hub_annual_planner_pilot_refinement.sql", "utf8");
const coachPage = readFileSync("src/pages/CoachHubPage.jsx", "utf8");
const annualPage = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
const settings = readFileSync("src/components/Settings/CoachHubSettingsPanel.jsx", "utf8");
const communications = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");
const automation = readFileSync("api/automation/daily.js", "utf8");

function booking(overrides = {}) {
  return {
    id: "b1",
    title: "U14 winter training",
    status: "confirmed",
    teamKey: "u14",
    pitchId: "p1",
    startAt: "2026-11-02T18:00:00Z",
    endAt: "2026-11-02T19:30:00Z",
    costPence: 2500,
    ...overrides,
  };
}

describe("Ground Control v3.10.2 Coach Hub and Annual Planner pilot refinement", () => {
  it("parses recurrence exceptions and excludes them from booking series", () => {
    expect(parseDateExceptions("2026-10-26, 2026-11-02\n2026-10-26")).toEqual(["2026-10-26", "2026-11-02"]);
    const rows = expandRecurringBookingDraft({
      title: "Winter training",
      pitchId: "p1",
      startDate: "2026-10-05",
      startTime: "18:00",
      endTime: "19:30",
      recurrence: "weekly",
      recurrenceUntil: "2026-11-02",
      exceptionDatesText: "2026-10-26",
      holidayPolicy: "custom",
    });
    expect(rows.map((row) => row.startDate)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-11-02"]);
  });

  it("carries coach holiday rules into the secured request payload", () => {
    const payload = buildRequestPayload({
      assignmentId: "a1",
      requestType: "training",
      title: "Winter training",
      date: "2026-10-05",
      startTime: "18:00",
      endTime: "19:30",
      recurrence: "weekly",
      recurrenceUntil: "2026-11-02",
      exceptionDatesText: "2026-10-26; 2026-11-02",
      holidayPolicy: "exclude",
    });
    expect(payload.exception_dates).toEqual(["2026-10-26", "2026-11-02"]);
    expect(payload.holiday_policy).toBe("exclude");
  });

  it("builds ordered request conversations with unread counts", () => {
    const conversation = buildRequestConversation([
      { id: "m2", author_role: "club", author_name: "Scheduler", body: "Try 19:00", created_at: "2026-07-15T10:05:00Z" },
      { id: "m1", author_role: "coach", author_name: "Sam", body: "Can we move?", created_at: "2026-07-15T10:00:00Z", read_at: "2026-07-15T10:01:00Z" },
    ], "coach");
    expect(conversation.rows.map((row) => row.id)).toEqual(["m1", "m2"]);
    expect(conversation.unread).toBe(1);
    expect(conversation.lastMessage.body).toBe("Try 19:00");
  });

  it("creates a deduplicated coach audience from affected bookings and blackouts", () => {
    const audience = buildAnnualPlannerCoachAudience({
      reason: "Pitch 1 closed",
      bookings: [booking(), booking({ id: "b2", teamKey: "u15", startAt: "2026-11-02T20:00:00Z", endAt: "2026-11-02T21:00:00Z" })],
      blackouts: [{ id: "x1", pitchId: "p1", startAt: "2026-11-02T17:00:00Z", endAt: "2026-11-02T19:45:00Z" }],
      selectedBlackoutIds: ["x1"],
    });
    const enriched = buildCoachCommunicationAudience({
      reason: audience.reason,
      teamKeys: audience.teamKeys,
      people: [{ id: "p1", displayName: "Sam", email: "sam@example.com", preferredChannel: "email", status: "active" }],
      assignments: [{ id: "a1", personId: "p1", teamKey: "u14", teamName: "U14", status: "active" }],
    });
    expect(audience.teamKeys).toEqual(["u14"]);
    expect(enriched.readyCount).toBe(1);
    expect(enriched.recipients[0]).toEqual(expect.objectContaining({ name: "Sam", destination: "sam@example.com" }));
  });

  it("measures coach engagement, utilisation and booking-cost reconciliation", () => {
    const engagement = buildCoachEngagementMetrics({
      people: [{ id: "p1", user_id: "u1", verification_status: "verified" }, { id: "p2" }],
      assignments: [{ id: "a1", status: "active" }],
      requests: [{ status: "approved" }, { status: "submitted" }],
      messages: [{ requires_acknowledgement: true, acknowledged_at: "2026-07-15" }],
      reminders: [{ acknowledged_at: "2026-07-15" }],
    });
    const utilisation = buildAnnualPlannerUtilisation({
      bookings: [booking()],
      pitches: [{ id: "p1", label: "Pitch 1" }],
      rangeStart: "2026-11-02T00:00:00Z",
      rangeEnd: "2026-11-03T00:00:00Z",
      openingHour: 8,
      closingHour: 22,
    });
    const finance = buildBookingCostReconciliation([booking(), booking({ id: "b2", costPence: 1500, financeStatus: "reconciled" })]);
    expect(engagement).toEqual(expect.objectContaining({ inviteCoveragePct: 50, verificationPct: 50, requestResolutionPct: 50, acknowledgementPct: 100 }));
    expect(utilisation).toEqual(expect.objectContaining({ bookingCount: 1, usedHours: 1.5 }));
    expect(finance).toEqual(expect.objectContaining({ plannedPence: 4000, reconciledPence: 1500, outstandingPence: 2500, unreconciledCount: 1 }));
  });

  it("ships direct request conversations, team feeds and contact replacement", () => {
    expect(coachPage).toContain("Open conversation");
    expect(coachPage).toContain("School holidays");
    expect(coachPage).toContain("Dates to skip");
    expect(settings).toContain("Replace contact");
    expect(settings).toContain("CoachRequestConversation");
    expect(migration).toContain("create table if not exists public.coach_hub_request_messages");
    expect(migration).toContain("create or replace function public.create_coach_hub_team_calendar_feed");
    expect(migration).toContain("create or replace function public.replace_coach_hub_contact");
  });

  it("adds automatic audiences, utilisation analytics and cost reconciliation to Annual Planner", () => {
    expect(annualPage).toContain("Pilot intelligence");
    expect(annualPage).toContain("Message active coaches");
    expect(annualPage).toContain("Contact affected coaches");
    expect(annualPage).toContain("Apply this change to remaining dates");
    expect(annualPage).toContain("Mark reconciled");
    expect(communications).toContain("Automatic Annual Planner audience.");
    expect(communications).toContain("Affected coach contacts copied");
    expect(migration).toContain("reconcile_annual_planner_booking_cost");
  });

  it("automates booking reminders and tracks acknowledgements without exposing direct table access", () => {
    expect(migration).toContain("alter table public.coach_hub_booking_reminders force row level security");
    expect(migration).toContain("revoke all on table public.coach_hub_request_messages, public.coach_hub_booking_reminders");
    expect(migration).toContain("claim_due_coach_hub_reminders");
    expect(migration).toContain("complete_coach_hub_reminder");
    expect(migration).toContain("message_row.related_type='coach_hub_reminder'");
    expect(automation).toContain("deliverCoachHubReminder");
    expect(automation).toContain("coachRemindersProcessed");
  });

  it("keeps every new interaction free of native browser dialogue calls", () => {
    for (const source of [coachPage, annualPage, settings, communications]) {
      expect(source).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    }
  });
});
