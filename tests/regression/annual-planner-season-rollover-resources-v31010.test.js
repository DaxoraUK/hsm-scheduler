import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  annualBookingToPayload,
  detectAnnualPlannerConflicts,
  normaliseAnnualBooking,
} from "../../src/lib/planning/annualPlannerEngine.js";
import {
  buildSeasonRolloverPreview,
  normalisePlannerResource,
  normaliseWaitlistEntry,
  plannerResourceToPayload,
  waitlistEntryToPayload,
} from "../../src/lib/planning/seasonalResourceEngine.js";
import { buildAnnualPlannerAnalyticsModel } from "../../src/lib/analytics/annualPlannerAnalyticsEngine.js";

describe("Ground Control v3.10.10 seasonal rollover, waitlist and resources", () => {
  it("normalises shared resource quantity and operational buffers", () => {
    const resource = normalisePlannerResource({ name: "Portable goals", quantity: 4, setup_buffer_minutes: 15, clear_down_buffer_minutes: 30 });
    expect(resource.quantity).toBe(4);
    expect(resource.setupBufferMinutes).toBe(15);
    expect(resource.clearDownBufferMinutes).toBe(30);
    expect(plannerResourceToPayload(resource).resource_type).toBe("equipment");
  });

  it("normalises waitlist demand and serialises half-hour preferences", () => {
    const entry = normaliseWaitlistEntry({
      team_key: "u14-spartans",
      team_name: "U14 Spartans",
      preferred_days: [1, 3],
      preferred_start_times: ["18:00:00", "18:30:00"],
      priority: 80,
    });
    expect(entry.preferredStartTimes).toEqual(["18:00", "18:30"]);
    expect(waitlistEntryToPayload(entry).priority).toBe(80);
  });

  it("previews the latest published allocation for rollover", () => {
    const preview = buildSeasonRolloverPreview({
      fromSeasonPhase: "regular",
      preferences: [{ team_key: "u14", season_phase: "regular" }],
      allocationRuns: [{ id: "run-1", season_phase: "regular", status: "published", published_at: "2026-06-01" }],
      allocationItems: [{ run_id: "run-1", team_key: "u14", status: "published" }],
    });
    expect(preview.ready).toBe(true);
    expect(preview.preferenceCount).toBe(1);
    expect(preview.allocationCount).toBe(1);
  });

  it("persists participants, buffers and resource requirements with bookings", () => {
    const booking = normaliseAnnualBooking({
      title: "Training",
      start_at: "2026-09-01T18:00:00Z",
      end_at: "2026-09-01T19:00:00Z",
      participant_count: 20,
      setup_buffer_minutes: 15,
      clear_down_buffer_minutes: 15,
      resource_requirements: [{ resource_id: "resource-1", quantity: 2 }],
    });
    const payload = annualBookingToPayload(booking);
    expect(payload.participant_count).toBe(20);
    expect(payload.setup_buffer_minutes).toBe(15);
    expect(payload.resource_requirements).toEqual([{ resource_id: "resource-1", quantity: 2 }]);
  });

  it("blocks a resource reservation that exceeds shared quantity", () => {
    const candidate = {
      title: "Second session",
      bookingType: "training",
      status: "confirmed",
      startAt: "2026-09-01T18:00:00Z",
      endAt: "2026-09-01T19:00:00Z",
      resourceRequirements: [{ resourceId: "goals", quantity: 1 }],
    };
    const conflicts = detectAnnualPlannerConflicts(candidate, {
      resources: [{ id: "goals", name: "Portable goals", quantity: 1, active: true }],
      bookings: [{
        id: "existing",
        title: "First session",
        bookingType: "training",
        status: "confirmed",
        startAt: "2026-09-01T18:15:00Z",
        endAt: "2026-09-01T19:15:00Z",
        resourceRequirements: [{ resourceId: "goals", quantity: 1 }],
      }],
    });
    expect(conflicts.some((row) => row.type === "resource_capacity")).toBe(true);
  });

  it("uses setup buffers when checking pitch overlap", () => {
    const conflicts = detectAnnualPlannerConflicts({
      title: "Setup session",
      bookingType: "training",
      status: "confirmed",
      pitchId: "pitch-4",
      pitchAreaId: "half-a",
      startAt: "2026-09-01T18:00:00Z",
      endAt: "2026-09-01T19:00:00Z",
      setupBufferMinutes: 30,
    }, {
      pitches: [{ id: "pitch-4", trainingCapacity: 2, trainingAreas: [{ id: "half-a", label: "Half A" }, { id: "half-b", label: "Half B" }] }],
      bookings: [{
        id: "earlier",
        title: "Earlier",
        bookingType: "training",
        status: "confirmed",
        pitchId: "pitch-4",
        pitchAreaId: "half-a",
        startAt: "2026-09-01T17:00:00Z",
        endAt: "2026-09-01T17:45:00Z",
      }],
    });
    expect(conflicts.some((row) => row.type === "pitch_area_overlap")).toBe(true);
  });

  it("adds waitlist and resource evidence to the shared analytics layer", () => {
    const model = buildAnnualPlannerAnalyticsModel({
      resources: [{ id: "goals", active: true }],
      waitlist: [{ id: "wait-1", status: "waiting", created_at: "2026-09-01" }],
      season_rollovers: [{ id: "roll-1", created_at: "2026-09-01" }],
    }, { year: 2026 });
    expect(model.metrics.activeResources).toBe(1);
    expect(model.metrics.waitingTeams).toBe(1);
    expect(model.metrics.seasonRollovers).toBe(1);
  });

  it("uses a grouped responsive smart-allocation header instead of one cramped row", () => {
    const workspace = readFileSync("src/components/planning/SmartTrainingAllocationWorkspace.jsx", "utf8");
    expect(workspace).toContain("Planning setup");
    expect(workspace).toContain("Draft date range");
    expect(workspace).toContain("Draft action");
    expect(workspace).not.toContain("mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5");
  });

  it("adds the Resources and rollover workspace to Annual Planner", () => {
    const page = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
    const component = readFileSync("src/components/planning/SeasonalResourceWorkspace.jsx", "utf8");
    expect(page).toContain("Resources & rollover");
    expect(page).toContain("SeasonalResourceWorkspace");
    expect(component).toContain("Seasonal rollover");
    expect(component).toContain("Training waitlist");
    expect(component).toContain("Shared resources");
  });

  it("adds database authority for buffered bookings, resources, waitlists and rollovers", () => {
    const migration = readFileSync("supabase/migrations/202607170010_season_rollover_waitlist_resources_buffers.sql", "utf8");
    const supabase = readFileSync("src/lib/supabase.js", "utf8");
    expect(migration).toContain("annual_planner_resources");
    expect(migration).toContain("annual_planner_waitlist_entries");
    expect(migration).toContain("annual_planner_season_rollovers");
    expect(migration).toContain("pitch_area_buffered_slot_available");
    expect(migration).toContain("save_annual_planner_booking_v4");
    expect(supabase).toContain("rpc/save_annual_planner_booking_v4");
    expect(supabase).toContain("rpc/create_annual_planner_season_rollover");
  });
});
