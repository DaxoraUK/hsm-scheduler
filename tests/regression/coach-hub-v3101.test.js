import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildBlankCoachRequest,
  buildRequestPayload,
  normaliseCoachHubWorkspace,
  normaliseCoachRequest,
} from "../../src/lib/coach/coachHubEngine.js";
import {
  ENTITLEMENTS,
  PLAN_CATALOGUE,
  PLAN_CODES,
  hasEntitlement,
} from "../../src/lib/subscriptions/entitlements.js";

const migration = readFileSync("supabase/migrations/202607150004_coach_hub_team_contacts_requests.sql", "utf8");
const app = readFileSync("src/AppCore.jsx", "utf8");
const coachPage = readFileSync("src/pages/CoachHubPage.jsx", "utf8");
const settingsPanel = readFileSync("src/components/Settings/CoachHubSettingsPanel.jsx", "utf8");
const teamPanel = readFileSync("src/components/Settings/TeamSettingsPanel.jsx", "utf8");
const communications = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");
const invitationApi = readFileSync("api/coach/invite.js", "utf8");
const calendarApi = readFileSync("api/coach/calendar.js", "utf8");
const invitationServer = readFileSync("server/coach/invitations.js", "utf8");
const permissions = readFileSync("src/lib/security/permissions.js", "utf8");

function subscription(planCode, overrides = {}) {
  return {
    planCode,
    features: PLAN_CATALOGUE[planCode].features,
    entitlementOverrides: overrides,
  };
}

describe("Daxora Ground Control v3.10.1 Coach Hub, contacts and requests", () => {
  it("packages Coach Hub with the Annual Planner entitlement", () => {
    expect(PLAN_CATALOGUE[PLAN_CODES.LINK].features).not.toContain(ENTITLEMENTS.COACH_HUB);
    expect(PLAN_CATALOGUE[PLAN_CODES.CORE].features).not.toContain(ENTITLEMENTS.COACH_HUB);
    expect(PLAN_CATALOGUE[PLAN_CODES.PRO].features).toContain(ENTITLEMENTS.COACH_HUB);
    expect(PLAN_CATALOGUE[PLAN_CODES.ELITE].features).toContain(ENTITLEMENTS.COACH_HUB);
    expect(hasEntitlement(subscription(PLAN_CODES.CORE, { annual_planner: true }), ENTITLEMENTS.COACH_HUB)).toBe(true);
    expect(hasEntitlement(subscription(PLAN_CODES.CORE), ENTITLEMENTS.COACH_HUB)).toBe(false);
  });

  it("normalises team-scoped coach data and carries an existing booking through change requests", () => {
    const workspace = normaliseCoachHubWorkspace({
      assignments: [{ id: "a1", team_key: "u14", team_name: "U14 Spartans", can_request_changes: true }],
      bookings: [{ id: "b1", team_key: "u14", title: "Winter training", venue_id: "v1", pitch_id: "p1", pitch_name: "Pitch 1", start_at: "2026-11-02T18:00:00Z", end_at: "2026-11-02T19:30:00Z" }],
      requests: [{ id: "r1", assignment_id: "a1", target_booking_id: "b1", request_type: "change" }],
    });
    const request = normaliseCoachRequest(workspace.requests[0]);
    const draft = { ...buildBlankCoachRequest(workspace.assignments[0], new Date("2026-11-02T12:00:00Z")), targetBookingId: "b1", requestType: "change", date: "2026-11-02", startTime: "19:00", endTime: "20:30" };
    const payload = buildRequestPayload(draft);

    expect(workspace.bookings[0]).toEqual(expect.objectContaining({ venueId: "v1", pitchId: "p1" }));
    expect(request.targetBookingId).toBe("b1");
    expect(payload).toEqual(expect.objectContaining({ target_booking_id: "b1", request_type: "change" }));
  });

  it("uses team contacts as the single record for Coach Hub and Communications", () => {
    expect(migration).toContain("create trigger team_contacts_sync_coach_hub");
    expect(migration).toContain("public.team_contacts");
    expect(migration).toContain("update_my_coach_hub_profile");
    expect(teamPanel).toContain("Open Coach Hub");
    expect(settingsPanel).toContain("Team contacts power communications, Coach Hub access");
    expect(communications).toContain("Shared team contacts.");
    expect(communications).toContain("Settings → Teams");
  });

  it("provides a dedicated coach-only application shell and team-scoped role", () => {
    expect(permissions).toContain('coach: new Set([])');
    expect(permissions).toContain('membership?.accessMode === "coach"');
    expect(app).toContain("<CoachHubPage");
    expect(app).toContain('roleWorkspaceAccess.isCoach');
    expect(coachPage).toContain("My Team Planner");
    expect(coachPage).toContain("My calendar");
    expect(coachPage).toContain("One contact record across Daxora");
    expect(coachPage).toContain("Choose the booking you want to change or cancel");
  });

  it("enforces Coach Hub and request permissions inside Supabase", () => {
    expect(migration).toContain("alter table public.coach_hub_people force row level security");
    expect(migration).toContain("alter table public.coach_hub_team_assignments force row level security");
    expect(migration).toContain("alter table public.coach_hub_requests force row level security");
    expect(migration).toContain("revoke all on table public.coach_hub_people");
    expect(migration).toContain("private.current_coach_person_id");
    expect(migration).toContain("create or replace function public.list_coach_hub_request_queue");
    expect(migration).toContain("not public.can_manage_club(target_club_id)");
    expect(migration).toContain("to_jsonb(person)-'identity_key'");
    expect(migration).toContain("private.club_has_entitlement(person.club_id,'annual_planner')");
    expect(migration).toContain("Choose one of your assigned teams");
    expect(migration).toContain("Friendly requests are not enabled for this team role");
    expect(migration).toContain("booking.id is distinct from target_booking_id_value");
    expect(migration).toContain("annual_planner.booking.created_from_coach_request");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("supports individual invitation delivery and private team calendar feeds", () => {
    expect(invitationApi).toContain("prepare_coach_hub_invitation_delivery");
    expect(invitationApi).toContain("complete_coach_hub_invitation_delivery");
    expect(invitationApi).toContain("parsedInviteUrl.origin !== requestOrigin");
    expect(invitationApi).toContain("COACH_INVITE_ORIGIN_INVALID");
    expect(invitationServer).toContain("Your team workspace is ready");
    expect(invitationServer).toContain("there is no duplicate setup");
    expect(invitationServer).toContain("isLocalHttp");
    expect(calendarApi).toContain("BEGIN:VCALENDAR");
    expect(calendarApi).toContain("get_coach_hub_calendar_by_token");
    expect(calendarApi).toContain("cache-control");
  });

  it("ships approval, alternatives, messages and acknowledgements without native browser prompts", () => {
    expect(migration).toContain("alternative_offered");
    expect(migration).toContain("requires_acknowledgement");
    expect(migration).toContain("mark_coach_hub_message");
    expect(coachPage).toContain("Alternative accepted");
    expect(settingsPanel).toContain("Coach request queue");
    for (const source of [coachPage, settingsPanel]) {
      expect(source).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    }
  });
});
