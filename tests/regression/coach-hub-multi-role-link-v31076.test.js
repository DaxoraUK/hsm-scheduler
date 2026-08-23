import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("Coach Hub multi-role access linking", () => {
  const migration = read("supabase/migrations/202608230011_multi_role_coach_hub_link.sql");
  const reconciliation = read("supabase/migrations/202608230012_coach_hub_identity_reconciliation.sql");
  const api = read("src/lib/supabase.js");
  const page = read("src/pages/CoachHubPage.jsx");
  const settings = read("src/components/Settings/CoachHubSettingsPanel.jsx");

  test("links only authenticated team-scoped coaches and managers", () => {
    expect(migration).toContain("ensure_my_coach_hub_role_access");
    expect(migration).toContain("member_role.role_code in ('coach', 'team_manager')");
    expect(migration).toContain("member_role.scope_type = 'team'");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("This Coach Hub contact belongs to another account");
  });

  test("repairs existing role assignments before loading private Coach Hub data", () => {
    expect(api).toContain("async ensureMyCoachHubRoleAccess(clubId)");
    expect(page).toContain("await DB.ensureMyCoachHubRoleAccess(clubId)");
    expect(page.indexOf("await DB.ensureMyCoachHubRoleAccess(clubId)")).toBeLessThan(page.indexOf("DB.getCoachHubWorkspace(clubId"));
  });

  test("role revocation removes the matching Coach Hub assignment", () => {
    expect(migration).toContain("club_member_roles_sync_coach_hub");
    expect(migration).toContain("new.status = 'active'");
    expect(migration).toContain("set status = 'inactive', is_primary = false");
  });

  test("owners can archive a coach while retaining historical records", () => {
    expect(migration).toContain("archive_coach_hub_person");
    expect(migration).toContain("not public.can_manage_club(target_club_id)");
    expect(settings).toContain("Remove person");
    expect(settings).toContain("Historical requests and audit records are retained.");
    expect(api).toContain("async archiveCoachHubPerson(clubId, personId)");
  });

  test("identity and assignment reconciliation is safe to repeat", () => {
    expect(reconciliation).toContain("person.identity_key=identity_value");
    expect(reconciliation).toContain("pg_advisory_xact_lock");
    expect(reconciliation).toContain("on conflict(club_id,identity_key) do update");
    expect(reconciliation).toContain("target_assignment.id is not null");
    expect(reconciliation).toContain("on conflict(club_id,person_id,team_key,staff_role) do update");
  });
});
