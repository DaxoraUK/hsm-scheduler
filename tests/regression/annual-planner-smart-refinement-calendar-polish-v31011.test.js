import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAnnualPlannerAnalyticsModel } from "../../src/lib/analytics/annualPlannerAnalyticsEngine.js";
import { buildSmartTrainingAllocationDraft, normaliseTrainingPreference } from "../../src/lib/planning/smartTrainingAllocationEngine.js";

const pitches = [{
  id: "P4",
  label: "Pitch 4",
  format: "11v11-youth",
  trainingCapacity: 3,
  trainingAreas: [
    { id: "half-a", label: "Half A" },
    { id: "half-b", label: "Half B" },
    { id: "zone-c", label: "Zone C" },
  ],
}];

const teams = [
  { name: "U10 Lions", teamType: "youth", ageOrder: 4, format: "7v7" },
  { name: "U12 Tigers", teamType: "youth", ageOrder: 6, format: "9v9" },
  { name: "U14 Spartans", teamType: "youth", ageOrder: 8, format: "11v11-youth" },
];

function preference(team, index, patch = {}) {
  return normaliseTrainingPreference({
    team_key: team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    team_name: team.name,
    season_phase: "regular",
    preferred_days: [1],
    preferred_start_times: ["18:00"],
    preferred_pitch_ids: ["P4"],
    ...patch,
  }, team, index, "regular");
}

describe("Ground Control v3.10.11 smart refinement and calendar polish", () => {
  it("preserves a locked allocation when a draft is rebuilt", () => {
    const first = buildSmartTrainingAllocationDraft({
      teams: teams.slice(0, 2),
      pitches,
      preferences: teams.slice(0, 2).map(preference),
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00", "19:00"],
    });
    const pinned = { ...first.items[0], locked: true };
    const rebuilt = buildSmartTrainingAllocationDraft({
      teams: teams.slice(0, 2),
      pitches,
      preferences: teams.slice(0, 2).map(preference),
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00", "19:00"],
      lockedItems: [pinned],
    });
    expect(rebuilt.items[0].locked).toBe(true);
    expect(rebuilt.items[0].startTime).toBe(pinned.startTime);
    expect(rebuilt.items[0].pitchAreaId).toBe(pinned.pitchAreaId);
    expect(rebuilt.items[0].reasons.join(" ")).toContain("Pinned by the operator");
  });

  it("spreads avoidable demand across start times when fairness is enabled", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams,
      pitches,
      preferences: teams.map(preference),
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00", "19:00", "20:00"],
      fairnessEnabled: true,
    });
    expect(new Set(draft.items.map((item) => item.startTime)).size).toBeGreaterThan(1);
    expect(draft.summary.primeSlotFairnessPct).toBeGreaterThan(0);
  });

  it("flags a meaningful change from the last published allocation", () => {
    const baselineItems = [{
      team_key: "u14-spartans",
      day_of_week: 2,
      start_time: "20:00",
      end_time: "21:00",
      pitch_id: "P4",
      pitch_area_id: "half-a",
    }];
    const draft = buildSmartTrainingAllocationDraft({
      teams: [teams[2]],
      pitches,
      preferences: [preference(teams[2], 0)],
      baselineItems,
      seasonPhase: "regular",
      mode: "assisted",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00"],
      compareHistory: true,
    });
    expect(draft.items[0].changedFromHistoric).toBe(true);
    expect(draft.summary.changedFromHistoric).toBe(1);
  });

  it("explains why a team remains unassigned", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams: [teams[0]],
      pitches: [],
      preferences: [preference(teams[0], 0)],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
    });
    expect(draft.items[0].status).toBe("unassigned");
    expect(draft.items[0].warnings.join(" ").toLowerCase()).toContain("permitted club");
  });

  it("adds refinement controls and last-published comparison to the smart workspace", () => {
    const source = readFileSync("src/components/planning/SmartTrainingAllocationWorkspace.jsx", "utf8");
    expect(source).toContain("Draft refinement");
    expect(source).toContain("Preserve locks on rebuild");
    expect(source).toContain("Balance popular slots");
    expect(source).toContain("Changed from usual");
    expect(source).toContain("allocationItems");
  });

  it("supports copying rules, bulk age defaults and side-by-side coach review", () => {
    const source = readFileSync("src/components/planning/TrainingSchedulingPolicyPanel.jsx", "utf8");
    expect(source).toContain("Copy this rule to another season");
    expect(source).toContain("Create age-group defaults");
    expect(source).toContain("Current approved profile");
    expect(source).toContain("Coach proposal");
  });

  it("adds week view and facility/status filters to the coach calendar", () => {
    const source = readFileSync("src/components/coach/CoachSharedCalendar.jsx", "utf8");
    expect(source).toContain('setView("week")');
    expect(source).toContain("All facilities");
    expect(source).toContain("All statuses");
    expect(source).toContain("Request this day");
  });

  it("adds filtered month and agenda views to the operator calendar", () => {
    const source = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
    expect(source).toContain("Filtered agenda");
    expect(source).toContain("Team, pitch or area");
    expect(source).toContain("All facilities");
    expect(source).toContain("Full Pitch, named areas and alternatives remain filterable");
  });

  it("feeds preference, fairness, historic-change and lock measures into shared analytics", () => {
    const model = buildAnnualPlannerAnalyticsModel({
      allocation_runs: [{
        id: "run-1",
        created_at: "2026-09-01T12:00:00Z",
        status: "published",
        mode: "automatic",
        summary: { preferenceSuccessPct: 80, primeSlotFairnessPct: 90, changedFromHistoric: 2, manualOverrides: 1 },
      }],
      allocation_items: [{ run_id: "run-1", status: "published", score: 95, locked: true }],
    }, { year: 2026 });
    expect(model.metrics.preferenceSuccessPct).toBe(80);
    expect(model.metrics.primeSlotFairnessPct).toBe(90);
    expect(model.metrics.changedFromHistoric).toBe(2);
    expect(model.metrics.protectedAllocationLocks).toBe(1);
    expect(model.grantNarratives.join(" ")).toContain("slot-fairness");
  });

  it("shows the refinement measures in the shared analytics component", () => {
    const source = readFileSync("src/components/analytics/AnnualPlannerAnalyticsSummary.jsx", "utf8");
    expect(source).toContain("Preference success");
    expect(source).toContain("Slot fairness");
    expect(source).toContain("Protected allocations");
  });
});
