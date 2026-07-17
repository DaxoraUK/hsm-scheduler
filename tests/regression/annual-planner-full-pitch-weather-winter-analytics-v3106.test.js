import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FULL_PITCH_AREA_ID,
  detectAnnualPlannerConflicts,
  pitchAreaOptions,
} from "../../src/lib/planning/annualPlannerEngine.js";
import { buildAnnualPlannerAnalyticsModel } from "../../src/lib/analytics/annualPlannerAnalyticsEngine.js";

const read = (path) => fs.readFileSync(path, "utf8");
const annualPlanner = read("src/pages/AnnualPlannerPage.jsx");
const coachWizard = read("src/components/coach/CoachRequestWizard.jsx");
const reviewDialog = read("src/components/coach/CoachRequestReviewDialog.jsx");
const analyticsPage = read("src/pages/AnalyticsPage.jsx");
const supabase = read("src/lib/supabase.js");
const migration = read("supabase/migrations/202607170005_full_pitch_weather_winter_analytics.sql");

const pitch = {
  id: "pitch-4",
  label: "Pitch 4",
  trainingCapacity: 2,
  trainingAreas: [
    { id: "half-a", label: "Half A" },
    { id: "half-b", label: "Half B" },
  ],
};

const base = {
  id: "booking-a",
  title: "U14 training",
  bookingType: "training",
  status: "confirmed",
  teamKey: "u14",
  teamName: "U14",
  pitchId: "pitch-4",
  pitchName: "Pitch 4",
  startAt: "2026-08-03T18:00:00.000Z",
  endAt: "2026-08-03T19:00:00.000Z",
};

describe("Ground Control v3.10.6 full pitch, weather, winter and analytics", () => {
  it("adds an explicit Full Pitch option before named areas", () => {
    expect(pitchAreaOptions(pitch)).toEqual([
      { id: FULL_PITCH_AREA_ID, label: "Full Pitch" },
      { id: "half-a", label: "Half A" },
      { id: "half-b", label: "Half B" },
    ]);
  });

  it("allows Half A and Half B to operate at the same time", () => {
    const conflicts = detectAnnualPlannerConflicts(
      { ...base, id: "booking-b", teamKey: "u8", teamName: "U8", pitchAreaId: "half-b", pitchAreaName: "Half B" },
      {
        bookings: [{ ...base, pitchAreaId: "half-a", pitchAreaName: "Half A" }],
        pitches: [pitch],
      },
    );
    expect(conflicts).toEqual([]);
  });

  it("blocks Full Pitch when either half is occupied", () => {
    const conflicts = detectAnnualPlannerConflicts(
      { ...base, id: "friendly", bookingType: "friendly", teamKey: "u16", pitchAreaId: FULL_PITCH_AREA_ID, pitchAreaName: "Full Pitch" },
      {
        bookings: [{ ...base, pitchAreaId: "half-a", pitchAreaName: "Half A" }],
        pitches: [pitch],
      },
    );
    expect(conflicts.some((row) => row.type === "full_pitch_overlap")).toBe(true);
  });

  it("blocks named areas while a Full Pitch booking exists", () => {
    const conflicts = detectAnnualPlannerConflicts(
      { ...base, id: "half-b", teamKey: "u8", pitchAreaId: "half-b", pitchAreaName: "Half B" },
      {
        bookings: [{ ...base, id: "friendly", bookingType: "friendly", pitchAreaId: FULL_PITCH_AREA_ID, pitchAreaName: "Full Pitch" }],
        pitches: [pitch],
      },
    );
    expect(conflicts.some((row) => row.type === "full_pitch_overlap")).toBe(true);
  });

  it("builds shared grant evidence from delivered, weather and winter activity", () => {
    const model = buildAnnualPlannerAnalyticsModel({
      bookings: [
        { ...base, id: "complete", status: "completed" },
        { ...base, id: "weather", status: "cancelled", disruptionStatus: "weather_cancelled", startAt: "2026-09-01T18:00:00Z", endAt: "2026-09-01T19:30:00Z" },
        { ...base, id: "winter", status: "confirmed", seasonPhase: "winter", siteInventoryId: "site-1", siteSlotId: "slot-1", pitchId: "winter-slot:slot-1", pitchName: "3G Half 1", costPence: 2500, startAt: "2026-11-02T18:00:00Z", endAt: "2026-11-02T19:00:00Z" },
      ],
      winter_sites: [{ id: "site-1", name: "Bolton Arena", provider_type: "external", cost_pence: 5000, active: true }],
      winter_slots: [{ id: "slot-1", site_id: "site-1", label: "3G Half 1", capacity: 1, active: true }],
    }, { year: 2026 });
    expect(model.metrics.deliveredHours).toBe(1);
    expect(model.metrics.weatherLostHours).toBe(1.5);
    expect(model.metrics.winterHours).toBe(1);
    expect(model.metrics.externalWinterCostPence).toBe(7500);
    expect(model.grantNarratives.join(" ")).toContain("lost or postponed");
  });

  it("adds operator weather and winter workspaces to Annual Planner", () => {
    expect(annualPlanner).toContain("WinterSiteWorkspace");
    expect(annualPlanner).toContain("WeatherDisruptionDialog");
    expect(annualPlanner).toContain("recordAnnualPlannerWeatherDisruption");
    expect(annualPlanner).toContain('["winter", "Winter sites"');
  });

  it("supports Full Pitch and fixed winter slots in coach requests", () => {
    expect(coachWizard).toContain("FULL_PITCH_AREA_ID");
    expect(coachWizard).toContain("Fixed winter site slot");
    expect(coachWizard).toContain("siteSlotId");
    expect(coachWizard).toContain("Full Pitch blocks every named area");
  });

  it("allows operators to approve a changed allocation or winter slot", () => {
    expect(reviewDialog).toContain("Approve / allocate");
    expect(reviewDialog).toContain("Full Pitch");
    expect(reviewDialog).toContain("fixed winter slot");
    expect(reviewDialog).toContain("site_slot_id");
  });

  it("uses one Annual Planner analytics source in module insights and main Analytics", () => {
    expect(annualPlanner).toContain("AnnualPlannerAnalyticsSummary");
    expect(analyticsPage).toContain("DB.getAnnualPlannerAnalyticsData");
    expect(analyticsPage).toContain("AnnualPlannerAnalyticsSummary");
    expect(supabase).toContain("get_annual_planner_analytics_data");
  });

  it("creates secure winter inventory and weather disruption database functions", () => {
    expect(migration).toContain("create table if not exists public.annual_planner_sites");
    expect(migration).toContain("create table if not exists public.annual_planner_site_slots");
    expect(migration).toContain("alter table public.annual_planner_sites force row level security");
    expect(migration).toContain("record_annual_planner_weather_disruption");
    expect(migration).toContain("get_coach_hub_winter_inventory");
    expect(migration).toContain("get_annual_planner_analytics_data");
  });

  it("keeps Full Pitch authoritative in the database allocation function", () => {
    expect(migration).toContain("__full_pitch__");
    expect(migration).toContain("Full Pitch blocks every named area");
    expect(migration).toContain("The full pitch is unavailable because another booking or area allocation overlaps");
  });
});
