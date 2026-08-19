import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeCoachHubWorkspaceIntoContacts,
  resolveCoachHubContactForTeam,
} from "../../src/lib/coachHubContactBridge.js";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const workspace = {
  people: [{
    id: "person-andrew",
    display_name: "Andrew Manville",
    email: "andrew@example.com",
    mobile: "07123456789",
    preferred_channel: "email",
    status: "active",
  }],
  assignments: [{
    id: "assignment-u14",
    person_id: "person-andrew",
    team_key: "u14-spartans",
    team_name: "U14 Spartans",
    staff_role: "manager",
    source_slot: "directory",
    is_primary: true,
    status: "active",
  }],
};

describe("Ground Control v3.10.3 Coach Hub contact join repair", () => {
  it("resolves the exact Teams and roles scenario shown in the fault report", () => {
    expect(resolveCoachHubContactForTeam(
      { name: "U14 Spartans", key: "u14-spartans" },
      [workspace.people, workspace.assignments],
    )).toEqual(expect.objectContaining({
      coachName: "Andrew Manville",
      coachEmail: "andrew@example.com",
      coachPhone: "07123456789",
      managedByCoachHub: true,
    }));
  });

  it("merges the primary assignment even when the protected team row is blank", () => {
    const rows = mergeCoachHubWorkspaceIntoContacts([
      { team_key: "u14-spartans", team_name: "U14 Spartans", coach_name: "" },
    ], workspace);
    expect(rows[0].additional_contacts[0]).toEqual(expect.objectContaining({
      name: "Andrew Manville",
      is_primary: true,
      staff_role: "manager",
    }));
  });

  it("makes the Teams panel read Coach Hub directly instead of relying on stale shared state", () => {
    const teams = read("src/components/Settings/TeamSettingsPanel.jsx");
    expect(teams).toContain("DB.listCoachHubAdminWorkspace(clubId)");
    expect(teams).toContain("resolvedVisibleTeamContact(selectedTeam, selectedIndex");
    expect(teams).toContain("ground-control-coach-hub-contacts-changed");
    expect(teams).toContain("coachHubManagedPrimary: true");
  });

  it("keeps the repository-level merge as a shared Communications and Teams fallback", () => {
    const repository = read("src/lib/supabase.js");
    expect(repository).toContain('import { mergeCoachHubWorkspaceIntoContacts } from "./coachHubContactBridge.js";');
    expect(repository).toContain("return mergeCoachHubWorkspaceIntoContacts(contacts, workspace)");
  });

  it("removes the source-slot filter from the database contact join", () => {
    const migration = read("supabase/migrations/202607160004_coach_hub_contact_join_and_orphan_cleanup.sql");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("'source_slot', assignment.source_slot");
    expect(migration).not.toContain("assignment.source_slot in ('manual','directory')");
    expect(migration).not.toContain("assignment.source_slot = 'directory'");
  });

  it("retires empty bootstrap people and prevents unnamed invitation cards", () => {
    const migration = read("supabase/migrations/202607160004_coach_hub_contact_join_and_orphan_cleanup.sql");
    const coachHub = read("src/components/Settings/CoachHubSettingsPanel.jsx");
    expect(migration).toContain("set status = 'inactive'");
    expect(migration).toContain("trim(coalesce(person.display_name, '')) = ''");
    expect(coachHub).toContain("hasUsablePersonDetails");
    expect(coachHub).toContain("assignedPersonIds");
  });

  it("broadcasts contact changes after Coach Hub refreshes", () => {
    const coachHub = read("src/components/Settings/CoachHubSettingsPanel.jsx");
    expect(coachHub).toContain('new CustomEvent("ground-control-coach-hub-contacts-changed")');
  });
});
