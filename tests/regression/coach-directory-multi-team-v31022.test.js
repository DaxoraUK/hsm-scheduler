import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = read("supabase/migrations/202607160002_coach_directory_multi_team_assignments.sql");
const settings = read("src/components/Settings/CoachHubSettingsPanel.jsx");
const teams = read("src/components/Settings/TeamSettingsPanel.jsx");
const contacts = read("src/lib/communications/contactModel.js");
const communications = read("src/lib/communications/communicationsEngine.js");
const communicationPage = read("src/pages/CommunicationsPage.jsx");
const supabase = read("src/lib/supabase.js");

describe("Ground Control v3.10.2.2 coach directory and multi-team assignments", () => {
  it("repairs the ambiguous person_id trigger variable", () => {
    expect(migration).toContain("resolved_person_id uuid");
    expect(migration).toContain("returning id into resolved_person_id");
    expect(migration).toContain("assignment.person_id <> resolved_person_id");
    expect(migration).not.toContain("declare\n  person_id uuid;");
  });

  it("supports one adult across multiple teams and multiple roles", () => {
    expect(migration).toContain("save_coach_hub_team_assignment");
    expect(migration).toContain("lead_coach");
    expect(migration).toContain("team_secretary");
    expect(migration).toContain("emergency_contact");
    expect(settings).toContain("Teams & roles");
    expect(settings).toContain("Primary team contact");
    expect(settings).toContain("Add team role");
    expect(teams).toContain("Assign more coaches, assistants or team roles");
  });

  it("enforces directory changes through secured RPCs", () => {
    expect(migration).toContain("upsert_coach_hub_person");
    expect(migration).toContain("delete_coach_hub_team_assignment");
    expect(migration).toContain("not public.can_manage_club(target_club_id)");
    expect(migration).toContain("private.club_has_entitlement(target_club_id,'annual_planner')");
    expect(supabase).toContain("upsertCoachHubPerson");
    expect(supabase).toContain("saveCoachHubTeamAssignment");
    expect(supabase).toContain("deleteCoachHubTeamAssignment");
  });

  it("feeds additional team assignments into Communications without duplicates", () => {
    expect(migration).toContain("'additional_contacts'");
    expect(migration).toContain("assignment.source_slot='directory'");
    expect(contacts).toContain("additionalContacts");
    expect(communications).toContain("additionalRecipients");
    expect(communications).toContain("rows.findIndex");
    expect(communicationPage).toContain("liveTeamContacts");
    expect(communicationPage).toContain("DB.loadTeamContacts");
  });
});
