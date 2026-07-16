import fs from "node:fs";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  "supabase/migrations/202607160008_coach_hub_person_id_ambiguity_repair.sql",
  "utf8",
);

const repairedFunctions = [
  "get_coach_hub_workspace",
  "submit_coach_hub_request",
  "respond_to_coach_hub_alternative",
  "update_my_coach_hub_profile",
  "create_coach_hub_calendar_feed",
  "verify_my_coach_hub_contact",
  "create_coach_hub_team_calendar_feed",
];

describe("Ground Control v3.10.3.4 Coach Hub person_id ambiguity repair", () => {
  it("replaces every affected self-service function", () => {
    for (const functionName of repairedFunctions) {
      expect(migration).toContain(`create or replace function public.${functionName}`);
    }
  });

  it("renames all seven conflicting local variables", () => {
    expect(migration).not.toMatch(/declare\s+person_id\s+uuid/i);
    expect(migration.match(/declare coach_person_id uuid/g)).toHaveLength(7);
  });

  it("uses the renamed identifier throughout workspace loading", () => {
    expect(migration).toMatch(/person\.id=coach_person_id/);
    expect(migration).toMatch(/assignment\.person_id=coach_person_id/);
    expect(migration).toMatch(/request_row\.person_id=coach_person_id/);
    expect(migration).toMatch(/message_row\.person_id=coach_person_id/);
  });

  it("keeps coach request ownership scoped correctly", () => {
    expect(migration).toMatch(/person_id=coach_person_id and club_id=target_club_id and status='active'/);
    expect(migration).toMatch(/values\(target_club_id,coach_person_id,assignment\.id/);
    expect(migration).toMatch(/person_id=coach_person_id and status='alternative_offered'/);
  });

  it("retains the Coach Hub-safe self-service audit helper", () => {
    expect(migration).toMatch(/private\.record_coach_hub_audit_event\(target_club_id,'coach_hub\.request\.submitted'/);
    expect(migration).toMatch(/private\.record_coach_hub_audit_event\(target_club_id,'coach_hub\.profile\.updated'/);
    expect(migration).toMatch(/private\.record_coach_hub_audit_event\(target_club_id,'coach_hub\.contact\.verified'/);
  });

  it("repairs personal and team calendar feed ownership", () => {
    expect(migration).toMatch(/values\(target_club_id,coach_person_id,encode/);
    expect(migration).toMatch(/values\(target_club_id,coach_person_id,safe_team_key/);
  });

  it("reapplies the discovered pgcrypto schema", () => {
    expect(migration).toMatch(/extension_row\.extname = 'pgcrypto'/);
    expect(migration).toMatch(/alter function public\.create_coach_hub_calendar_feed\(uuid,text\)/);
    expect(migration).toMatch(/alter function public\.create_coach_hub_team_calendar_feed\(uuid,text,text\)/);
  });

  it("reloads PostgREST", () => {
    expect(migration).toContain("notify pgrst, 'reload schema';");
  });
});
