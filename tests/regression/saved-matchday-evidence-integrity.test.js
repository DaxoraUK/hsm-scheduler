import { expect, test } from "vitest";
import { buildUnifiedFacilityAnalyticsModel } from "../../src/lib/analytics/unifiedFacilityAnalyticsEngine.js";
import { normaliseSavedHistory, buildOperationalEvidence } from "../../src/lib/engines/operationalEvidenceEngine.js";

const filters = { startDate: "2026-09-05", endDate: "2026-09-05" };
const pitchCfg = [{ id: "P1", label: "Pitch 1", format: "11v11" }];
const snapshot = (id, savedAt, fixtures) => ({
  id, savedAt, date: "2026-09-05",
  fixtureDays: [{ key: "saturday", date: "2026-09-05", hasRun: true, scheduled: fixtures }],
});
const fixture = { canonicalFixtureIdentity: "url:one", homeTeam: "U16 Cheetahs", awayTeam: "Visitors", status: "active", format: "11v11", pitchId: "P1", koMins: 485, koTime: "08:05", endMins: 565 };

test("reports use the latest saved day, not both sides of a historical pitch move", () => {
  const history = [snapshot("old", "2026-09-04T10:00:00Z", [fixture]), snapshot("new", "2026-09-04T11:00:00Z", [{ ...fixture, pitchId: "P3", koTime: "11:45", koMins: 705 }])];
  const evidence = buildOperationalEvidence({ entries: normaliseSavedHistory(history), pitchCfg, scope: "saturday" });
  expect(evidence.rows).toHaveLength(1);
  expect(evidence.rows[0]).toMatchObject({ pitchId: "P3", koMins: 705 });
});

test("an empty saved day after exclusion supersedes its older active snapshot", () => {
  const entries = normaliseSavedHistory([snapshot("old", "2026-09-04T10:00:00Z", [fixture]), snapshot("new", "2026-09-04T11:00:00Z", [])]);
  expect(buildOperationalEvidence({ entries, pitchCfg, scope: "saturday" }).rows).toEqual([]);
});

test("Annual Planner mirrors never double-count or resurrect saved matchday fixtures", () => {
  const model = buildUnifiedFacilityAnalyticsModel({ pitchCfg, filters,
    history: [snapshot("saved", "2026-09-04T11:00:00Z", [fixture])],
    plannerData: { bookings: [
      { id: "mirror", source_type: "matchday_saturday", source_id: "url:one", booking_type: "match", status: "confirmed", pitch_id: "P1", start_at: "2026-09-05T08:05:00", end_at: "2026-09-05T09:25:00" },
      { id: "excluded-mirror", source_type: "matchday_saturday", source_id: "url:excluded", booking_type: "match", status: "confirmed", pitch_id: "P1", start_at: "2026-09-05T10:05:00", end_at: "2026-09-05T11:25:00" },
    ] },
  });
  expect(model.metrics.records).toBe(1);
});

test("reports distinguish appointment source from confirmation status", () => {
  const entries = normaliseSavedHistory([snapshot("saved", "2026-09-04T11:00:00Z", [{ ...fixture, referee: "A Ref", officialSource: "League-appointed", refStatus: "Replaced" }])]);
  const row = buildOperationalEvidence({ entries, pitchCfg, scope: "saturday" }).rows[0];
  expect(row).toMatchObject({ refereeSource: "League-appointed", officialStatus: "replaced", officialConfirmed: false });
  const unassigned = normaliseSavedHistory([snapshot("unknown", "2026-09-04T11:00:00Z", [{ ...fixture, refStatus: "League-appointed" }])]);
  expect(buildOperationalEvidence({ entries: unassigned, pitchCfg, scope: "saturday" }).rows[0].officialStatus).toBe("unassigned");
});

test("configured capacity includes unused pitches and excludes the gap between morning and evening", () => {
  const model = buildUnifiedFacilityAnalyticsModel({ pitchCfg, filters, plannerData: {
    scheduling_policies: [{ scope_type: "club", allowed_days: [6], earliest_start_time: "17:00", latest_end_time: "21:00" }],
  } });
  expect(model.metrics.configuredFacilityHours).toBe(7);
  expect(model.metrics.unusedHours).toBe(7);
});

test("downtime counts only the union of closures inside configured opening hours", () => {
  const model = buildUnifiedFacilityAnalyticsModel({ pitchCfg, filters, plannerData: { blackouts: [
    { start_at: "2026-09-04T00:00:00", end_at: "2026-09-05T10:00:00", pitch_id: "P1", closure_type: "weather" },
    { start_at: "2026-09-05T09:00:00", end_at: "2026-09-05T10:30:00", pitch_id: "P1", closure_type: "weather" },
    { start_at: "2026-09-05T17:00:00", end_at: "2026-09-05T23:00:00", pitch_id: "P1", closure_type: "maintenance" },
  ] } });
  expect(model.metrics.configuredFacilityHours).toBe(3);
  expect(model.metrics.closureHours).toBe(2);
  expect(model.metrics.usableFacilityHours).toBe(1);
});
