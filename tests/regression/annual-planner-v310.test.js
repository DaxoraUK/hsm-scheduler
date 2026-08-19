import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildAnnualPlannerSnapshot,
  detectAnnualPlannerConflicts,
  expandRecurringBookingDraft,
  matchdayFixtureToAnnualBooking,
} from "../../src/lib/planning/annualPlannerEngine.js";
import { buildTimelineMoveCandidate } from "../../src/lib/engines/timelineDragEngine.js";
import { ENTITLEMENTS, PLAN_CATALOGUE, PLAN_CODES } from "../../src/lib/subscriptions/entitlements.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

const page = readFileSync("src/pages/AnnualPlannerPage.jsx", "utf8");
const shell = readFileSync("src/layout/ProductShell.jsx", "utf8");
const app = readFileSync("src/AppCore.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202607150003_annual_pitch_booking_training_friendlies.sql", "utf8");
const timelineCard = readFileSync("src/components/Operations/shared/MatchdayTimelineCard.jsx", "utf8");
const subscriptionGate = readFileSync("src/components/SubscriptionGate.jsx", "utf8");
const subscriptionPanel = readFileSync("src/components/Settings/SubscriptionSettingsPanel.jsx", "utf8");

describe("Daxora Ground Control v3.10 annual pitch booking, training and friendlies planner", () => {
  it("expands recurring training safely across the requested period", () => {
    const rows = expandRecurringBookingDraft({
      title: "Winter training",
      bookingType: "training",
      status: "confirmed",
      pitchId: "P1",
      startDate: "2026-10-05",
      startTime: "18:00",
      endTime: "19:30",
      recurrence: "weekly",
      recurrenceUntil: "2026-10-26",
    });

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.startDate)).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(new Set(rows.map((row) => row.seriesId)).size).toBe(1);
  });

  it("blocks pitch and team double-bookings and summarises the year", () => {
    const existing = {
      id: "existing",
      title: "U14 training",
      bookingType: "training",
      status: "confirmed",
      teamKey: "u14",
      teamName: "U14",
      pitchId: "P1",
      pitchName: "Pitch 1",
      startDate: "2026-11-03",
      startTime: "18:00",
      endTime: "19:30",
      costPence: 2500,
    };
    const conflicts = detectAnnualPlannerConflicts({ ...existing, id: "candidate", title: "Friendly", startTime: "18:30", endTime: "20:00" }, { bookings: [existing] });
    const snapshot = buildAnnualPlannerSnapshot({ bookings: [existing], year: 2026 });

    expect(conflicts.map((item) => item.type)).toContain("pitch_double_booking");
    expect(conflicts.map((item) => item.type)).toContain("team_double_booking");
    expect(snapshot.metrics).toEqual(expect.objectContaining({ active: 1, hours: 1.5, costPence: 2500 }));
  });

  it("protects annual bookings inside the Matchday drag validation engine", () => {
    const fixtures = [makeFixture({ pitchId: "P2a", koMins: 600, koTime: "10:00" })];
    const resourceBooking = {
      id: "winter-training",
      title: "Winter training",
      bookingType: "training",
      status: "confirmed",
      pitchId: "P1",
      pitchName: "Pitch 1",
      startDate: "2026-11-07",
      startTime: "10:00",
      endTime: "12:00",
    };
    const candidate = buildTimelineMoveCandidate({
      fixtures,
      fixtureIndex: 0,
      pitchCfg: clonePitches(),
      club: makeClub(),
      pitchId: "P1",
      koMins: 600,
      start: 480,
      end: 1020,
      matchDate: "2026-11-07",
      resourceBookings: [resourceBooking],
    });

    expect(candidate.blocked).toBe(true);
    expect(candidate.type).toBe("annual_planner_conflict");
    expect(candidate.message).toContain("Winter training");
  });

  it("converts current matchday fixtures into protected annual-planner resources", () => {
    const booking = matchdayFixtureToAnnualBooking(makeFixture({ id: "match-1", pitchId: "P1", koMins: 540, koTime: "09:00" }), {
      date: "2026-08-22",
      pitchCfg: clonePitches(),
    });
    expect(booking).toEqual(expect.objectContaining({ bookingType: "match", status: "confirmed", startDate: "2026-08-22", pitchId: "P1" }));
    expect(booking.sourceType).toBe("matchday");
  });

  it("packages the module as a Core add-on and includes it in Pro and Elite", () => {
    expect(PLAN_CATALOGUE[PLAN_CODES.CORE].features).not.toContain(ENTITLEMENTS.ANNUAL_PLANNER);
    expect(PLAN_CATALOGUE[PLAN_CODES.PRO].features).toContain(ENTITLEMENTS.ANNUAL_PLANNER);
    expect(PLAN_CATALOGUE[PLAN_CODES.ELITE].features).toContain(ENTITLEMENTS.ANNUAL_PLANNER);
    expect(migration).toContain("where code in ('pro', 'elite')");
    expect(migration).toContain("'annual_planner'");
    expect(migration).toContain("available_addons");
  });

  it("ships the annual command workspace and shared Matchday conflict integration", () => {
    expect(shell).toContain('["planner", "Annual Planner", CalendarRange, NAV_TARGETS.PLANNER');
    expect(shell).toContain('badge: "Add-on"');
    expect(subscriptionGate).toContain('Review Annual Planner add-on');
    expect(subscriptionPanel).toContain('Annual Planner available as a paid bolt-on');
    expect(app).toContain('mainPage === "planner"');
    expect(app).toContain("<AnnualPlannerPage");
    expect(page).toContain("Pitch Booking, Training & Friendlies");
    expect(page).toContain("Ground Control fixtures are shown as protected facility bookings");
    expect(page).toContain("Create ${occurrences.length} bookings");
    expect(page).toContain("Changes are submitted for owner or administrator approval.");
    expect(page).toContain("includeCosts: canViewCosts");
    expect(timelineCard).toContain("DB.listAnnualPlannerWorkspace");
    expect(timelineCard).toContain("resourceBookings: annualPlannerResources.bookings");
    expect(migration).toContain("force row level security");
    expect(migration).toContain("public.can_operate_club");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("show_costs_to_schedulers");
    expect(migration).toContain("if require_approval and not can_manage then next_status := 'requested'");
    expect(migration).toContain("approved_by = case when next_status = 'confirmed' then actor_id else null end");
    expect(migration).toContain("blackout.venue_id is null or next_venue_id is null or blackout.venue_id = next_venue_id");
    expect(migration).toContain("raise exception 'Blackout not found'");
    expect(migration).toContain("private.club_has_entitlement(target_club_id, 'annual_planner')");
  });
});
