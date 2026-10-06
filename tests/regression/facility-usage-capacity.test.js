import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildUnifiedFacilityAnalyticsModel, buildUnifiedFacilityCsv } from "../../src/lib/analytics/unifiedFacilityAnalyticsEngine.js";
import UnifiedFacilityReportDocument from "../../src/components/reports/UnifiedFacilityReportDocument.jsx";
import { makeFixture } from "./fixtures.js";

const pitchCfg = [{ id: "P1", label: "Pitch 1", trainingCapacity: 1 }];
const club = { timingSettings: { startHour: 9, startMin: 0, endHour: 12, endMin: 0 } };
const filters = { startDate: "2026-10-10", endDate: "2026-10-10" };
const booking = (overrides = {}) => ({ id: "booking-1", booking_type: "fixture", team_name: "U13 Vulcans", status: "confirmed", pitch_id: "P1", pitch_name: "Pitch 1", start_at: "2026-10-10T09:00:00", end_at: "2026-10-10T10:00:00", ...overrides });
const closure = (start, end, overrides = {}) => ({ id: "closure-1", title: "Maintenance", pitch_id: "P1", start_at: start, end_at: end, ...overrides });
const build = (plannerData = {}, extra = {}) => buildUnifiedFacilityAnalyticsModel({ club, pitchCfg, filters, plannerData, ...extra });

describe("club facility usage and real opening capacity", () => {
  it("keeps a fully unused configured period available for reporting and export", () => {
    const model = build();
    expect(model.facilities[0].unusedHours).toBe(3);
    expect(model.metrics.utilisationPct).toBe(0);
    expect(model.hasData).toBe(true);
  });

  it("allows unused configured pitches and sites to be selected in filters", () => {
    const model = build({}, { pitchCfg: [{ id: "P1", label: "Pitch 1", siteId: "main" }], club: { ...club, sites: [{ id: "main", name: "Main Ground" }] } });
    expect(model.options.pitches).toEqual([{ value: "P1", label: "Pitch 1" }]);
    expect(model.options.sites).toEqual([{ value: "main", label: "Main Ground" }]);
  });

  it.each([
    ["team-name venue", { pitch_id: "", pitch_name: "", venue_name: "Horwich St. Mary's U13 Vulcans" }],
    ["unassigned venue", { pitch_id: "", pitch_name: "Unassigned" }],
    ["away fixture with a stale club pitch", { fixture_venue_role: "away" }],
    ["external winter slot", { season_phase: "winter", site_inventory_id: "winter-site", site_slot_id: "slot-1", pitch_id: "", venue_name: "Sports Centre" }],
  ])("does not count %s as club pitch usage", (_, overrides) => {
    const model = build({ bookings: [booking(overrides)] });
    expect(model.metrics.facilityHours).toBe(0);
    expect(model.facilities.map((row) => row.pitchName)).toEqual(["Pitch 1"]);
    expect(model.nonFacilityRows).toHaveLength(1);
    expect(model.rows).toHaveLength(1);
    expect(model.nonFacilityRows[0].utilisationPct).toBeNull();
  });

  it("preserves home pitch use and includes unused configured pitches in capacity", () => {
    const model = build({ bookings: [booking({ pitch_name: "wrong imported venue label" })] }, { pitchCfg: [...pitchCfg, { id: "P2", label: "Pitch 2" }] });
    expect(model.metrics.facilityHours).toBe(1);
    expect(model.metrics.usableFacilityHours).toBe(6);
    expect(model.metrics.utilisationPct).toBe(17);
    expect(model.facilities.find((row) => row.id === "P1").pitchName).toBe("Pitch 1");
  });

  it("keeps saved away fixtures out of local facility calculations", () => {
    const history = [{ id: "week-1", date: "2026-10-10", fixtureDays: [{ key: "saturday", date: "2026-10-10", hasRun: true, scheduled: [makeFixture({ homeTeam: "Visitors", awayTeam: "U13 Vulcans", extra: { isAwayFixture: true } })], postponed: [], cancelled: [], unresolved: [] }] }];
    const model = build({}, { history });
    expect(model.metrics.facilityHours).toBe(0);
    expect(model.nonFacilityRows[0].facilityScope).toBe("away");
    expect(model.nonFacilityRows[0].teamName).toBe("U13 Vulcans");
  });

  it.each([
    ["disjoint windows", "17:00", "21:00", 7],
    ["overlapping windows", "11:00", "14:00", 5],
  ])("unions %s instead of counting gaps or overlap twice", (_, start, end, hours) => {
    const model = build({ bookings: [booking()], scheduling_policies: [{ scope_type: "club", scope_key: "all", season_phase: "regular", allowed_days: [6], earliest_start_time: start, latest_end_time: end }] });
    expect(model.metrics.configuredFacilityHours).toBe(hours);
  });

  it("ignores closures outside opening hours", () => {
    const model = build({ bookings: [booking()], blackouts: [closure("2026-10-10T19:00:00", "2026-10-10T21:00:00")] });
    expect(model.metrics.closureHours).toBe(0);
    expect(model.metrics.usableFacilityHours).toBe(3);
  });

  it("clips closures crossing the selected range to its opening hours", () => {
    const model = build({ bookings: [booking()], blackouts: [closure("2026-10-09T19:00:00", "2026-10-10T10:00:00")] });
    expect(model.metrics.closureHours).toBe(1);
    expect(model.metrics.usableFacilityHours).toBe(2);
  });

  it("does not double-count overlapping closures", () => {
    const model = build({ bookings: [booking()], blackouts: [closure("2026-10-10T09:00:00", "2026-10-10T11:00:00"), closure("2026-10-10T10:00:00", "2026-10-10T12:00:00", { id: "closure-2", title: "Rain", closure_type: "weather" })] });
    expect(model.metrics.closureHours).toBe(3);
    expect(model.metrics.weatherClosureHours).toBe(2);
    expect(model.metrics.maintenanceClosureHours).toBe(1);
  });

  it.each(["cancelled", "postponed"])("does not record %s fixtures as occupied pitch or team hours", (status) => {
    const model = build({ bookings: [booking({ status })] });
    expect(model.facilities[0].facilityHours).toBe(0);
    expect(model.facilities[0].teamHours).toBe(0);
    expect(model.facilities[0].fixtureHours).toBe(0);
    expect(model.rows[0].status).toBe(status);
    expect(model.rows[0].facilityEquivalentHours).toBe(0);
  });

  it("shows unavailable capacity as N/A in the report and CSV, never fabricated 100%", () => {
    const model = build({ bookings: [booking({ pitch_id: "", venue_name: "Away Ground", fixture_venue_role: "away" })] }, { pitchCfg: [] });
    expect(model.metrics.utilisationPct).toBeNull();
    const csv = buildUnifiedFacilityCsv(model);
    expect(csv).toContain("Utilisation %,N/A");
    expect(csv).toContain("Away Ground");
    expect(csv).not.toContain("100%");
    const html = renderToStaticMarkup(React.createElement(UnifiedFacilityReportDocument, { model, club: { name: "Test club" } }));
    expect(html).toContain("Away / external / unallocated activity");
    expect(html).toContain("N/A");
    expect(html).not.toContain("null%");
  });

  it("scopes capacity and closures to the selected configured pitch", () => {
    const model = build({ bookings: [booking()] }, { pitchCfg: [...pitchCfg, { id: "P2", label: "Pitch 2" }], filters: { ...filters, pitch: "P1" } });
    expect(model.facilities.map((row) => row.id)).toEqual(["P1"]);
    expect(model.metrics.configuredFacilityHours).toBe(3);
  });
});
