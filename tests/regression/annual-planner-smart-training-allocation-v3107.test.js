import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FULL_PITCH_AREA_ID,
} from "../../src/lib/planning/annualPlannerEngine.js";
import {
  buildSmartTrainingAllocationDraft,
  normaliseTrainingPreference,
  trainingPreferenceToPayload,
} from "../../src/lib/planning/smartTrainingAllocationEngine.js";

const teams = [
  { name: "U8 Sharks", teamType: "youth", ageOrder: 2, format: "5v5", defaultPitch: "P4" },
  { name: "U14 Spartans", teamType: "youth", ageOrder: 7, format: "11v11-youth", defaultPitch: "P4" },
];
const pitches = [{ id: "P4", label: "Pitch 4", format: "11v11-youth", trainingCapacity: 2, trainingAreas: [{ id: "half-a", label: "Half A" }, { id: "half-b", label: "Half B" }] }];

function preference(team, index, patch = {}) {
  return normaliseTrainingPreference({
    team_key: team.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    team_name: team.name,
    season_phase: "regular",
    preferred_days: [1],
    preferred_start_times: [index === 0 ? "17:00" : "18:00"],
    preferred_pitch_ids: ["P4"],
    ...patch,
  }, team, index, patch.season_phase || "regular");
}

describe("Ground Control v3.10.7 smart training allocation", () => {
  it("allocates two teams to separate pitch halves without consuming the full pitch", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams,
      pitches,
      preferences: teams.map((team, index) => preference(team, index)),
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["17:00", "18:00"],
    });
    expect(draft.summary.assigned).toBe(2);
    expect(draft.items.every((item) => item.pitchId === "P4")).toBe(true);
    expect(draft.items.every((item) => item.pitchAreaId !== FULL_PITCH_AREA_ID)).toBe(true);
  });


  it("applies the selected season run mode when a team profile inherits it", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams: [teams[0]],
      pitches,
      preferences: [preference(teams[0], 0, { allocation_mode: "inherit" })],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
    });
    expect(draft.items[0].mode).toBe("automatic");
    expect(draft.items[0].status).toBe("proposed");
    expect(draft.summary.publishable).toBe(true);
  });

  it("detects any shared coach across multi-coach team assignments", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams,
      pitches,
      preferences: teams.map((team, index) => preference(team, index, { preferred_start_times: ["18:00"] })),
      assignments: [
        { team_key: "u8-sharks", person_id: "coach-primary", status: "active" },
        { team_key: "u8-sharks", person_id: "coach-shared", status: "active" },
        { team_key: "u14-spartans", person_id: "coach-shared", status: "active" },
      ],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00", "19:00"],
    });
    expect(draft.items[0].startTime).not.toBe(draft.items[1].startTime);
  });

  it("keeps manual teams as recommendations and prevents automatic publication", () => {
    const draft = buildSmartTrainingAllocationDraft({
      teams: [teams[0]],
      pitches,
      preferences: [preference(teams[0], 0, { manual_only: true })],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
    });
    expect(draft.items[0].status).toBe("recommendation");
    expect(draft.summary.publishable).toBe(false);
  });

  it("uses fixed winter-site inventory instead of normal club pitches", () => {
    const winterSiteId = "11111111-1111-4111-8111-111111111111";
    const winterSlotId = "22222222-2222-4222-8222-222222222222";
    const draft = buildSmartTrainingAllocationDraft({
      teams: [teams[1]],
      pitches,
      winterSites: [{ id: winterSiteId, name: "Bolton Arena", active: true }],
      winterSlots: [{ id: winterSlotId, site_id: winterSiteId, label: "3G Half 2", day_of_week: 3, start_time: "19:00", end_time: "20:00", capacity: 1, active: true }],
      preferences: [normaliseTrainingPreference({ team_key: "u14-spartans", team_name: "U14 Spartans", season_phase: "winter", preferred_winter_site_ids: [winterSiteId] }, teams[1], 0, "winter")],
      seasonPhase: "winter",
      mode: "assisted",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
    });
    expect(draft.items[0].siteSlotId).toBe(winterSlotId);
    expect(draft.items[0].resourceLabel).toContain("Bolton Arena");
  });

  it("avoids simultaneous allocations for teams sharing one coach", () => {
    const sharedTimePreferences = teams.map((team, index) => preference(team, index, { preferred_start_times: ["18:00"] }));
    const draft = buildSmartTrainingAllocationDraft({
      teams,
      pitches,
      preferences: sharedTimePreferences,
      assignments: [
        { team_key: "u8-sharks", person_id: "coach-1", status: "active" },
        { team_key: "u14-spartans", person_id: "coach-1", status: "active" },
      ],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00", "19:00"],
    });
    expect(draft.items[0].startTime).not.toBe(draft.items[1].startTime);
  });

  it("serialises team preferences for the secured RPC", () => {
    const payload = trainingPreferenceToPayload(preference(teams[1], 1, { keep_current_allocation: true }));
    expect(payload.team_key).toBe("u14-spartans");
    expect(payload.preferred_days).toEqual([1]);
    expect(payload.keep_current_allocation).toBe(true);
  });

  it("wires the smart allocation workspace into Annual Planner", () => {
    const page = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
    const component = readFileSync("src/components/planning/SmartTrainingAllocationWorkspace.jsx", "utf8");
    expect(page).toContain('tab === "smart"');
    expect(page).toContain("saveAnnualPlannerAllocationRun");
    expect(component).toContain("Manual");
    const engineSource = readFileSync("src/lib/planning/smartTrainingAllocationEngine.js", "utf8");
    expect(engineSource).toContain("Automatic draft");
    expect(component).toContain("Publish recurring allocations");
  });

  it("creates secured preference, run and publication functions", () => {
    const migration = readFileSync("supabase/migrations/202607170006_smart_training_allocation.sql", "utf8");
    expect(migration).toContain("annual_planner_team_preferences");
    expect(migration).toContain("save_annual_planner_allocation_run");
    expect(migration).toContain("publish_annual_planner_allocation_run");
    expect(migration).toContain("private.pitch_area_slot_available");
    expect(migration).toContain("unassigned or manual-only team");
    expect(migration).toContain("allocation_mode in ('inherit','manual','assisted','automatic')");
  });

  it("feeds smart allocation measures into the shared analytics layer", () => {
    const engine = readFileSync("src/lib/analytics/annualPlannerAnalyticsEngine.js", "utf8");
    const summary = readFileSync("src/components/analytics/AnnualPlannerAnalyticsSummary.jsx", "utf8");
    expect(engine).toContain("publishedAllocationRuns");
    expect(engine).toContain("averageAllocationScore");
    expect(summary).toContain("Smart allocation runs");
  });
});
