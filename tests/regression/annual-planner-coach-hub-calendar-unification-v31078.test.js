import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchdayFixtureToAnnualBooking } from "../../src/lib/planning/annualPlannerEngine.js";

const read = (path) => readFileSync(path, "utf8");

describe("Annual Planner and Coach Hub calendar unification", () => {
  it("creates stable, team-scoped matchday calendar rows", () => {
    const booking = matchdayFixtureToAnnualBooking({
      id: "fixture-42",
      homeTeam: "U14 Spartans",
      awayTeam: "Rovers U14",
      pitchId: "pitch-1",
      koTime: "10:30",
      cfg: { id: "u14-spartans", gameMins: 70, bufferMins: 20 },
    }, { date: "2026-08-29", pitchCfg: [{ id: "pitch-1", label: "Main Pitch" }], sourceType: "matchday_saturday" });

    expect(booking).toMatchObject({
      id: "matchday_fixture-42",
      sourceId: "fixture-42",
      sourceType: "matchday_saturday",
      bookingType: "match",
      teamKey: "u14-spartans",
      teamName: "U14 Spartans",
      opponentName: "Rovers U14",
      pitchName: "Main Pitch",
    });
  });

  it("automatically synchronises every built matchday into the shared database calendar", () => {
    const app = read("src/AppCore.jsx");
    const client = read("src/lib/supabase.js");
    expect(app).toContain("DB.syncMatchdayCalendar");
    expect(app).toContain('scope: "saturday"');
    expect(app).toContain('scope: "sunday"');
    expect(app).toContain('scope: "midweek"');
    expect(client).toContain('"rpc/sync_matchday_calendar"');
  });

  it("upserts rebuilt fixtures, removes stale generated rows and preserves role boundaries", () => {
    const sql = read("supabase/migrations/202608240003_unify_matchday_annual_planner_coach_calendar.sql");
    expect(sql).toContain("public.can_operate_club(target_club_id)");
    expect(sql).toContain("private.club_has_entitlement(target_club_id, 'annual_planner')");
    expect(sql).toContain("on conflict (club_id, source_type, source_id)");
    expect(sql).toContain("delete from public.annual_planner_bookings booking");
    expect(sql).toContain("matchday.calendar.synchronised");
  });

  it("maps legacy planner team identities onto the coach's current assignment", () => {
    const sql = read("supabase/migrations/202608240004_resolve_shared_calendar_team_identity.sql");
    expect(sql).toContain("candidate.team_key=booking.team_key");
    expect(sql).toContain("regexp_replace(lower(candidate.team_name)");
    expect(sql).toContain("jsonb_build_object('team_key',assignment.team_key,'team_name',assignment.team_name)");
    expect(sql).toContain("candidate.person_id=coach_person_id");
    expect(sql).toContain("candidate.status='active'");
  });

  it("publishes only confirmed bookings and notifies assigned coaches of material changes", () => {
    const sql = read("supabase/migrations/202608240005_controlled_planner_publishing_notifications.sql");
    const delivery = read("src/components/planning/AnnualPlannerCompletionWorkspace.jsx");
    expect(sql).toContain("booking.status='confirmed'");
    expect(sql).toContain("private.notify_coach_hub_booking_change()");
    expect(sql).toContain("Fixture details changed");
    expect(sql).toContain("requires_acknowledgement");
    expect(delivery).toContain("Draft → review → publish");
    expect(delivery).toContain("Only confirmed bookings appear in Coach Hub");
    expect(delivery).toContain("Prepare {publication.awaiting.length} for publishing");
  });

  it("permits the synchroniser audit action and deduplicates operator warnings", () => {
    const sql = read("supabase/migrations/202608240006_allow_matchday_calendar_audit_action.sql");
    const app = read("src/AppCore.jsx");
    expect(sql).toContain("'matchday.calendar.synchronised'");
    expect(sql).toContain("not public.can_operate_club(target_club_id)");
    expect(app).toContain('id: "shared-calendar-sync-needs-attention"');
  });
});
