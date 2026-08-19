import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyPolicyToTrainingPreference,
  coachTrainingPreferenceToPayload,
  normaliseTrainingSchedulingPolicy,
  resolveTrainingSchedulingPolicy,
  validateTrainingPreferenceAgainstPolicy,
} from "../../src/lib/planning/trainingPolicyEngine.js";
import {
  buildSmartTrainingAllocationDraft,
  normaliseTrainingPreference,
} from "../../src/lib/planning/smartTrainingAllocationEngine.js";

describe("Ground Control v3.10.8 master rules and coach preferences", () => {
  it("starts with weekday-only club defaults", () => {
    const policy = normaliseTrainingSchedulingPolicy({ season_phase: "regular" });
    expect(policy.allowedDays).toEqual([1, 2, 3, 4, 5]);
    expect(policy.weekendAllowed).toBe(false);
    expect(policy.coachEditPolicy).toBe("approval");
  });

  it("resolves age-group rules after the club default", () => {
    const policy = resolveTrainingSchedulingPolicy({
      seasonPhase: "regular",
      team: { name: "U14 Spartans", teamType: "youth" },
      policies: [
        { season_phase: "regular", scope_type: "club", scope_key: "all", allowed_days: [1, 2, 3, 4, 5], default_duration_minutes: 90 },
        { season_phase: "regular", scope_type: "age_group", scope_key: "u14", allowed_days: [1, 3], default_duration_minutes: 75 },
      ],
    });
    expect(policy.allowedDays).toEqual([1, 3]);
    expect(policy.defaultDurationMinutes).toBe(75);
    expect(policy.inheritedFrom).toContain("Age group: u14");
  });

  it("prevents coaches selecting weekends when the club disables them", () => {
    const policy = normaliseTrainingSchedulingPolicy({ allowed_days: [1, 2, 3, 4, 5], weekend_allowed: false });
    const errors = validateTrainingPreferenceAgainstPolicy({ seasonPhase: "regular", preferredDays: [6], preferredStartTimes: ["18:00"] }, policy);
    expect(errors.join(" ")).toContain("Weekend training is disabled");
  });

  it("inherits permitted days and duration into a new team profile", () => {
    const policy = normaliseTrainingSchedulingPolicy({ allowed_days: [2, 4], default_duration_minutes: 60, preferred_start_times: ["18:00"] });
    const preference = applyPolicyToTrainingPreference({ teamKey: "u8-sharks", teamName: "U8 Sharks", seasonPhase: "regular" }, policy);
    expect(preference.preferredDays).toEqual([2, 4]);
    expect(preference.requiredDurationMinutes).toBe(60);
    expect(preference.preferredStartTimes).toEqual(["18:00"]);
  });

  it("keeps automatic drafts off weekends even when a team preference asks for Saturday", () => {
    const team = { name: "U14 Spartans", teamType: "youth", ageOrder: 7, format: "11v11-youth" };
    const policy = { season_phase: "regular", scope_type: "club", scope_key: "all", allowed_days: [1, 2, 3, 4, 5], weekend_allowed: false, preferred_start_times: ["18:00"] };
    const preference = normaliseTrainingPreference({ team_key: "u14-spartans", team_name: "U14 Spartans", season_phase: "regular", preferred_days: [6], preferred_start_times: ["18:00"] }, team, 0, "regular", policy);
    const draft = buildSmartTrainingAllocationDraft({
      teams: [team],
      pitches: [{ id: "P4", label: "Pitch 4", format: "11v11-youth", trainingAreas: [{ id: "half-a", label: "Half A" }] }],
      preferences: [preference],
      policies: [policy],
      seasonPhase: "regular",
      mode: "automatic",
      startDate: "2026-09-01",
      endDate: "2027-05-31",
      defaultStartTimes: ["18:00"],
    });
    expect([1, 2, 3, 4, 5]).toContain(draft.items[0].dayOfWeek);
  });

  it("leaves a winter team unassigned when only a blocked weekend slot exists", () => {
    const siteId = "11111111-1111-4111-8111-111111111111";
    const team = { name: "U10 Greens", teamType: "youth", ageOrder: 4 };
    const policy = { season_phase: "winter", scope_type: "club", scope_key: "all", allowed_days: [1, 2, 3, 4, 5], weekend_allowed: false };
    const draft = buildSmartTrainingAllocationDraft({
      teams: [team],
      winterSites: [{ id: siteId, name: "Winter Arena" }],
      winterSlots: [{ id: "22222222-2222-4222-8222-222222222222", site_id: siteId, day_of_week: 6, start_time: "18:00", end_time: "19:00", active: true }],
      policies: [policy],
      seasonPhase: "winter",
      mode: "automatic",
      startDate: "2026-10-01",
      endDate: "2027-03-31",
    });
    expect(draft.items[0].status).toBe("unassigned");
    expect(draft.items[0].warnings.join(" ").toLowerCase()).toContain("club");
  });

  it("serialises only coach-editable preferences for secure submission", () => {
    const payload = coachTrainingPreferenceToPayload({
      teamKey: "u14-spartans",
      teamName: "U14 Spartans",
      seasonPhase: "regular",
      preferredDays: [1, 3],
      preferredStartTimes: ["18:00"],
      unavailableDays: [4],
      requiredDurationMinutes: 90,
      minimumAreaMode: "named_area",
    });
    expect(payload.team_key).toBe("u14-spartans");
    expect(payload.preferred_days).toEqual([1, 3]);
    expect(payload.override_fields).toContain("preferredDays");
  });

  it("wires master rules and coach review into Annual Planner", () => {
    const page = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
    const workspace = readFileSync("src/components/planning/SmartTrainingAllocationWorkspace.jsx", "utf8");
    const policyPanel = readFileSync("src/components/planning/TrainingSchedulingPolicyPanel.jsx", "utf8");
    expect(page).toContain("saveAnnualPlannerSchedulingPolicy");
    expect(page).toContain("reviewCoachTrainingPreferenceProposal");
    expect(workspace).toContain("TrainingSchedulingPolicyPanel");
    expect(policyPanel).toContain("Allow weekend training");
    expect(policyPanel).toContain("Coach preference review");
  });

  it("adds coach-managed preferences inside Coach Hub", () => {
    const page = readFileSync("src/pages/CoachHubPage.jsx", "utf8");
    const component = readFileSync("src/components/coach/CoachTrainingPreferences.jsx", "utf8");
    expect(page).toContain('"training", "Training preferences"');
    expect(page).toContain("submitMyCoachTrainingPreference");
    expect(component).toContain("Inherited from:");
    expect(component).toContain("Club approval required");
  });

  it("creates secured policy and coach proposal database functions", () => {
    const migration = readFileSync("supabase/migrations/202607170007_training_master_rules_and_coach_preferences.sql", "utf8");
    expect(migration).toContain("annual_planner_scheduling_policies");
    expect(migration).toContain("annual_planner_coach_preference_proposals");
    expect(migration).toContain("save_annual_planner_scheduling_policy");
    expect(migration).toContain("submit_my_coach_training_preference");
    expect(migration).toContain("team_key_value text:=trim");
    expect(migration).not.toContain("team_key_value text:=lower");
    expect(migration).toContain("review_coach_training_preference_proposal");
    expect(migration).toContain("Weekend training is disabled by the club");
    expect(migration).toContain("private.record_coach_hub_audit_event");
  });
});
