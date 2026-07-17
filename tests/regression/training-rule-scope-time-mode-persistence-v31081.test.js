import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildHalfHourTimeOptions,
  normaliseTrainingSchedulingPolicy,
  resolveTrainingSchedulingPolicy,
  trainingSchedulingPolicyToPayload,
} from "../../src/lib/planning/trainingPolicyEngine.js";

describe("Ground Control v3.10.8.1 scheduling rule UX and persistence", () => {
  it("builds selectable half-hour starts that finish inside the master window", () => {
    expect(buildHalfHourTimeOptions({ earliestStartTime: "17:30", latestEndTime: "21:00", durationMinutes: 60 }))
      .toEqual(["17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]);
  });

  it("normalises preferred starts to available half-hour choices", () => {
    const policy = normaliseTrainingSchedulingPolicy({
      earliest_start_time: "17:30",
      latest_end_time: "21:00",
      default_duration_minutes: 90,
      preferred_start_times: ["18:00", "18:15", "19:30", "20:00"],
    });
    expect(policy.preferredStartTimes).toEqual(["18:00", "19:30"]);
  });

  it("resolves a specific-team rule after age and team-type defaults", () => {
    const policy = resolveTrainingSchedulingPolicy({
      seasonPhase: "regular",
      team: { key: "u14-spartans", name: "U14 Spartans", teamType: "youth" },
      policies: [
        { season_phase: "regular", scope_type: "club", scope_key: "all", default_duration_minutes: 90 },
        { season_phase: "regular", scope_type: "team_type", scope_key: "youth", default_duration_minutes: 75 },
        { season_phase: "regular", scope_type: "age_group", scope_key: "u14", default_duration_minutes: 60 },
        { season_phase: "regular", scope_type: "team", scope_key: "u14-spartans", default_duration_minutes: 105 },
      ],
    });
    expect(policy.defaultDurationMinutes).toBe(105);
    expect(policy.inheritedFrom).toContain("Team: u14-spartans");
  });

  it("serialises the saved season allocation mode with the club rule", () => {
    const payload = trainingSchedulingPolicyToPayload({
      seasonPhase: "regular",
      scopeType: "club",
      scopeKey: "all",
      allocationMode: "automatic",
      preferredStartTimes: ["18:00", "18:30", "19:00"],
    });
    expect(payload.allocation_mode).toBe("automatic");
    expect(payload.preferred_start_times).toEqual(["18:00", "18:30", "19:00"]);
  });

  it("wires functional scope and half-hour selectors into admin and coach views", () => {
    const panel = readFileSync("src/components/planning/TrainingSchedulingPolicyPanel.jsx", "utf8");
    const coach = readFileSync("src/components/coach/CoachTrainingPreferences.jsx", "utf8");
    const workspace = readFileSync("src/components/planning/SmartTrainingAllocationWorkspace.jsx", "utf8");
    const selector = readFileSync("src/components/planning/HalfHourTimeSelector.jsx", "utf8");
    expect(panel).toContain("Specific team");
    expect(panel).toContain("Applies to");
    expect(panel).toContain("HalfHourTimeSelector");
    expect(coach).toContain("HalfHourTimeSelector");
    expect(workspace).toContain("Saved season default");
    expect(workspace).toContain("Unsaved - save the Club default master rule");
    expect(selector).toContain("30-minute intervals");
  });

  it("adds database support for team scope, half-hour validation and mode persistence", () => {
    const migration = readFileSync("supabase/migrations/202607170008_scheduling_rule_scope_time_mode_persistence.sql", "utf8");
    expect(migration).toContain("scope_type in ('club','team_type','age_group','team')");
    expect(migration).toContain("allocation_mode in ('manual','assisted','automatic')");
    expect(migration).toContain("extract(minute from selected_time)::integer % 30");
    expect(migration).toContain("assignment_row.team_key");
    expect(migration).toContain("allocation_mode=excluded.allocation_mode");
  });
});
