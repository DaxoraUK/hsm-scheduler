import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAnnualPlannerAnalyticsModel } from "../../src/lib/analytics/annualPlannerAnalyticsEngine.js";
import {
  buildAnnualPlannerFeedUrl,
  buildAnnualPlannerGrantEvidenceCsv,
  buildAnnualPlannerReadiness,
  buildBulkCommandPreview,
  normaliseWaitlistOffer,
  plannerCalendarFeedToPayload,
  waitlistOfferToPayload,
} from "../../src/lib/planning/annualPlannerCompletionEngine.js";

const booking = {
  id: "booking-1",
  title: "U14 training",
  teamName: "U14 Spartans",
  teamKey: "u14-spartans",
  startDate: "2026-09-07",
  startTime: "18:00",
  endTime: "19:30",
  startAt: "2026-09-07T18:00:00Z",
  endAt: "2026-09-07T19:30:00Z",
  status: "confirmed",
  bookingType: "training",
  pitchId: "P4",
  pitchName: "Pitch 4",
  pitchAreaId: "half-a",
  pitchAreaName: "Half A",
};

describe("Ground Control v3.10.12 Annual Planner completion", () => {
  it("normalises a waitlist offer and preserves the named pitch area", () => {
    const offer = normaliseWaitlistOffer({
      id: "offer-1",
      waitlist_entry_id: "wait-1",
      team_key: "U14-SPARTANS",
      team_name: "U14 Spartans",
      start_at: "2026-09-07T18:00:00Z",
      end_at: "2026-09-07T19:30:00Z",
      pitch_id: "P4",
      pitch_name: "Pitch 4",
      pitch_area_id: "half-b",
      pitch_area_name: "Half B",
      status: "offered",
    });
    expect(offer.teamKey).toBe("u14-spartans");
    expect(offer.pitchAreaName).toBe("Half B");
    expect(offer.status).toBe("offered");
  });

  it("builds the operator waitlist-offer payload", () => {
    const payload = waitlistOfferToPayload({
      waitlistEntryId: "wait-1",
      startAt: "2026-09-07T18:00:00Z",
      endAt: "2026-09-07T19:30:00Z",
      pitchId: "P4",
      pitchName: "Pitch 4",
      pitchAreaId: "half-a",
      pitchAreaName: "Half A",
    });
    expect(payload.waitlist_entry_id).toBe("wait-1");
    expect(payload.pitch_area_id).toBe("half-a");
  });

  it("previews a bulk command without changing unselected bookings", () => {
    const preview = buildBulkCommandPreview({
      commandType: "change_status",
      bookingIds: ["booking-1"],
      status: "postponed",
      reason: "Weather",
    }, [booking, { ...booking, id: "booking-2", teamName: "U13 Girls" }]);
    expect(preview.ready).toBe(true);
    expect(preview.count).toBe(1);
    expect(preview.affectedTeams).toEqual(["U14 Spartans"]);
  });

  it("rejects an incomplete pitch-move bulk command", () => {
    const preview = buildBulkCommandPreview({ commandType: "move_pitch", bookingIds: ["booking-1"] }, [booking]);
    expect(preview.ready).toBe(false);
    expect(preview.errors.join(" ")).toContain("target pitch");
  });

  it("creates scoped private calendar feed payloads and URLs", () => {
    const payload = plannerCalendarFeedToPayload({ label: "U14 calendar", scopeType: "team", scopeKey: "u14-spartans", seasonPhase: "regular" });
    expect(payload.scope_type).toBe("team");
    expect(payload.scope_key).toBe("u14-spartans");
    expect(buildAnnualPlannerFeedUrl("abc123", "https://ground-control.example")).toBe("https://ground-control.example/api/planner/calendar?token=abc123");
  });

  it("reports module readiness from real operational evidence", () => {
    const readiness = buildAnnualPlannerReadiness({
      bookings: [booking],
      waitlist: [{ id: "wait-1" }],
      waitlistOffers: [{ id: "offer-1", status: "offered" }],
      calendarFeeds: [{ id: "feed-1" }],
      analytics: { hasData: true, grantNarratives: ["Evidence"] },
      teams: [{ name: "U14 Spartans" }],
      pitches: [{ id: "P4" }],
      winterSites: [{ id: "winter-1" }],
    });
    expect(readiness.ready).toBe(true);
    expect(readiness.percent).toBe(100);
  });

  it("adds offer conversion, unmet demand and bulk-operation measures to shared analytics", () => {
    const model = buildAnnualPlannerAnalyticsModel({
      bookings: [booking],
      requests: [{ created_at: "2026-09-01T12:00:00Z", status: "submitted", preferred_start_at: "2026-09-07T18:00:00Z", preferred_end_at: "2026-09-07T19:30:00Z" }],
      waitlist_offers: [
        { created_at: "2026-09-02T12:00:00Z", status: "accepted" },
        { created_at: "2026-09-03T12:00:00Z", status: "declined" },
      ],
      bulk_commands: [{ created_at: "2026-09-04T12:00:00Z", affected_count: 4 }],
    }, { year: 2026 });
    expect(model.metrics.acceptedWaitlistOffers).toBe(1);
    expect(model.metrics.declinedWaitlistOffers).toBe(1);
    expect(model.metrics.bulkBookingsChanged).toBe(4);
    expect(model.metrics.unmetRequestHours).toBe(1.5);
    expect(model.grantNarratives.join(" ")).toContain("accepted by coaches");
  });

  it("exports the same grant measures used by the shared analytics model", () => {
    const csv = buildAnnualPlannerGrantEvidenceCsv({ year: 2026, metrics: { plannedHours: 100, waitingTeams: 3, acceptedWaitlistOffers: 2 }, grantNarratives: ["Three teams remain without capacity."] });
    expect(csv).toContain("Planned facility hours,100");
    expect(csv).toContain("Waitlist offers accepted,2");
    expect(csv).toContain("Three teams remain without capacity");
  });

  it("adds the Delivery and feeds workspace to the Annual Planner", () => {
    const source = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
    expect(source).toContain("Delivery & feeds");
    expect(source).toContain("AnnualPlannerCompletionWorkspace");
    expect(source).toContain("offerAnnualPlannerWaitlistSlot");
    expect(source).toContain("applyAnnualPlannerBulkCommand");
  });

  it("adds waitlist-offer acceptance to Coach Hub", () => {
    const source = readFileSync("src/pages/CoachHubPage.jsx", "utf8");
    expect(source).toContain("Training waitlist");
    expect(source).toContain("Accept training slot");
    expect(source).toContain("respondToAnnualPlannerWaitlistOffer");
  });

  it("exposes a dedicated Annual Planner ICS endpoint", () => {
    const source = readFileSync("server-api/planner/calendar.js", "utf8");
    expect(source).toContain("get_annual_planner_calendar_by_token");
    expect(source).toContain("annual-planner-calendar.ics");
    expect(source).toContain("text/calendar");
  });

  it("ships database isolation, response and audit functions", () => {
    const sql = readFileSync("supabase/migrations/202607170011_waitlist_offers_bulk_feeds_grant_acceptance.sql", "utf8");
    expect(sql).toContain("annual_planner_waitlist_offers");
    expect(sql).toContain("respond_to_annual_planner_waitlist_offer");
    expect(sql).toContain("apply_annual_planner_bulk_command");
    expect(sql).toContain("get_annual_planner_calendar_by_token");
    expect(sql).toContain("force row level security");
    expect(sql).toContain("record_audit_event");
  });
});
