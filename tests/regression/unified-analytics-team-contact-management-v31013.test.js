import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildUnifiedFacilityAnalyticsModel, buildUnifiedFacilityCsv } from "../../src/lib/analytics/unifiedFacilityAnalyticsEngine.js";
import { makeFixture } from "./fixtures.js";

function savedMatchday() {
  return {
    id: "week-1",
    date: "2026-09-05",
    dateLabel: "Saturday 5 September 2026",
    savedAt: "2026-09-05T14:00:00.000Z",
    fixtureDays: [{
      key: "saturday",
      label: "Saturday",
      date: "2026-09-05",
      dateLabel: "Saturday 5 September",
      hasRun: true,
      scheduled: [makeFixture({ id: "fixture-1", homeTeam: "First Team", pitchId: "P1", koTime: "14:00", koMins: 840 })],
      postponed: [],
      cancelled: [],
      unresolved: [],
    }],
  };
}

const pitches = [
  { id: "P1", label: "Main Pitch", trainingCapacity: 1 },
  { id: "P4", label: "Training Pitch", trainingCapacity: 2 },
];

const plannerData = {
  scheduling_policies: [{ scope_type: "club", scope_key: "all", season_phase: "regular", allowed_days: [1, 2, 3, 4], earliest_start_time: "18:00", latest_end_time: "21:00" }],
  bookings: [
    { id: "train-a", title: "U14 training", booking_type: "training", status: "completed", team_key: "u14", team_name: "U14 Spartans", pitch_id: "P4", pitch_name: "Training Pitch", pitch_area_id: "half-a", pitch_area_name: "Half A", start_at: "2026-09-07T18:00:00Z", end_at: "2026-09-07T19:00:00Z", participant_count: 18 },
    { id: "train-b", title: "U13 training", booking_type: "training", status: "confirmed", team_key: "u13", team_name: "U13 Girls", pitch_id: "P4", pitch_name: "Training Pitch", pitch_area_id: "half-b", pitch_area_name: "Half B", start_at: "2026-09-07T18:00:00Z", end_at: "2026-09-07T19:00:00Z", participant_count: 16 },
    { id: "friendly-1", title: "U14 friendly", booking_type: "friendly", status: "confirmed", team_key: "u14", team_name: "U14 Spartans", pitch_id: "P1", pitch_name: "Main Pitch", start_at: "2026-09-08T18:30:00Z", end_at: "2026-09-08T20:00:00Z" },
  ],
  blackouts: [{ id: "closure-1", title: "Maintenance", pitch_id: "P1", start_at: "2026-09-09T18:00:00Z", end_at: "2026-09-09T20:00:00Z" }],
  waitlist: [{ id: "wait-1", status: "waiting" }],
};

function build(filters = {}) {
  return buildUnifiedFacilityAnalyticsModel({
    history: [savedMatchday()],
    plannerData,
    club: { name: "Horwich St Mary's", timingSettings: { startHour: 8, startMin: 30, endHour: 18, endMin: 0 } },
    pitchCfg: pitches,
    teamCfg: [{ key: "u14", name: "U14 Spartans", ageGroup: "U14" }, { key: "u13", name: "U13 Girls", ageGroup: "U13" }, { key: "first", name: "First Team", teamType: "adult" }],
    filters: { startDate: "2026-09-01", endDate: "2026-09-30", ...filters },
  });
}

describe("Ground Control v3.10.13 unified analytics, reports and team contacts", () => {
  it("combines saved fixtures with Annual Planner training and friendlies", () => {
    const model = build();
    expect(model.rows.some((row) => row.usageType === "fixture")).toBe(true);
    expect(model.rows.filter((row) => row.usageType === "training")).toHaveLength(2);
    expect(model.rows.some((row) => row.usageType === "friendly")).toBe(true);
    expect(model.metrics.teamHours).toBeGreaterThan(model.metrics.facilityHours);
  });

  it("counts two simultaneous halves as two team-hours but one pitch-equivalent hour", () => {
    const model = build({ usageType: "training" });
    const pitch = model.facilities.find((row) => row.id === "P4");
    expect(pitch.teamHours).toBe(2);
    expect(pitch.facilityHours).toBe(1);
  });

  it("supports whole-club usage filters", () => {
    const model = build({ usageType: "friendly", pitch: "P1", team: "u14" });
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].usageType).toBe("friendly");
  });

  it("subtracts closures from usable capacity and records waiting demand", () => {
    const model = build();
    expect(model.metrics.closureHours).toBe(2);
    expect(model.metrics.waitingTeams).toBe(1);
    expect(model.grantNarratives.join(" ")).toContain("unavailable");
  });

  it("exports fixture, training, closure and utilisation evidence to CSV", () => {
    const csv = buildUnifiedFacilityCsv(build());
    expect(csv).toContain("Unified facility usage report");
    expect(csv).toContain("Pitch-equivalent hours");
    expect(csv).toContain("Training Pitch");
    expect(csv).toContain("Closure hours");
  });

  it("makes unified facility usage the main Analytics view", () => {
    const source = readFileSync("src/pages/AnalyticsPage.jsx", "utf8");
    expect(source).toContain('useState("facilities")');
    expect(source).toContain("UnifiedFacilityAnalyticsDashboard");
    expect(source).toContain("Matchday detail");
  });

  it("adds the combined facility report to Reports", () => {
    const page = readFileSync("src/pages/ReportsPage.jsx", "utf8");
    const engine = readFileSync("src/lib/reports/reportingEngine.js", "utf8");
    expect(page).toContain("UnifiedFacilityReportDocument");
    expect(page).toContain('reportType === "facilities"');
    expect(engine).toContain('id: "facilities"');
  });

  it("replaces the dead team-contact badge with edit and unassign actions", () => {
    const source = readFileSync("src/components/Settings/CoachHubSettingsPanel.jsx", "utf8");
    expect(source).toContain("Edit contact");
    expect(source).toContain("Edit role");
    expect(source).toContain("Open team");
    expect(source).toContain("Unassign");
    expect(source).not.toContain(">Team contact</span>");
  });

  it("preserves team-sourced assignments and retains the shared person when unassigned", () => {
    const sql = readFileSync("supabase/migrations/202607180001_unified_analytics_team_contact_management.sql", "utf8");
    expect(sql).toContain("existing.source_slot in ('coach', 'assistant')");
    expect(sql).toContain("shared_person_retained");
    expect(sql).toContain("coach_email = ''");
    expect(sql).toContain("assistant_enabled = false");
    expect(sql).toContain("scheduling_policies");
    expect(sql).not.toContain("delete from public.coach_hub_people");
  });

  it("passes the active club into unified Reports data loading", () => {
    const source = readFileSync("src/AppCore.jsx", "utf8");
    expect(source).toContain("<ReportsPage");
    expect(source).toContain("activeClubId={activeClubId}");
  });
});
