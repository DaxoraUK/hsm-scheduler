import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  mergeCoachHubWorkspaceIntoContacts,
  resolveCoachHubContactForTeam,
} from "../../src/lib/coachHubContactBridge.js";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Ground Control v3.10.2.9 Coach Hub contact authority repair", () => {
  const workspace = {
    people: [{
      id: "person-1",
      display_name: "Andrew Manville",
      email: "coach@example.com",
      mobile: "07123456789",
      preferred_channel: "email",
      status: "active",
    }],
    assignments: [{
      id: "assignment-1",
      person_id: "person-1",
      team_key: "u14-spartans",
      team_name: "U14 Spartans",
      staff_role: "manager",
      source_slot: "coach",
      is_primary: true,
      status: "active",
    }],
  };

  it("returns original coach-slot assignments omitted by the contacts RPC", () => {
    const result = mergeCoachHubWorkspaceIntoContacts(
      [{ team_key: "u14-spartans", team_name: "U14 Spartans", coach_name: "Old contact" }],
      workspace,
    );

    expect(result[0].additional_contacts).toEqual([
      expect.objectContaining({
        name: "Andrew Manville",
        email: "coach@example.com",
        mobile: "07123456789",
        source_slot: "coach",
        is_primary: true,
      }),
    ]);
  });

  it("creates a team contact row when only Coach Hub has the assignment", () => {
    const result = mergeCoachHubWorkspaceIntoContacts([], workspace);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      team_key: "u14-spartans",
      team_name: "U14 Spartans",
    });
    expect(result[0].additional_contacts[0].name).toBe("Andrew Manville");
  });

  it("resolves the primary Coach Hub contact for the matching team", () => {
    expect(resolveCoachHubContactForTeam(
      { id: "u14-spartans", name: "U14 Spartans" },
      [workspace.people, workspace.assignments],
    )).toEqual(expect.objectContaining({
      coachName: "Andrew Manville",
      coachEmail: "coach@example.com",
      coachPhone: "07123456789",
      managedByCoachHub: true,
    }));
  });

  it("makes Coach Hub primary details authoritative over stale Team-form fields", () => {
    const teams = read("src/components/Settings/TeamSettingsPanel.jsx");
    expect(teams).not.toContain("hasPrimaryTeamContact || !assignedPrimary");
    expect(teams).toContain("if (!assignedPrimary)");
    expect(teams).toContain("coachHubManagedPrimary: true");
  });

  it("imports and executes the workspace merge at the repository boundary", () => {
    const repository = read("src/lib/supabase.js");
    expect(repository).toContain('import { mergeCoachHubWorkspaceIntoContacts } from "./coachHubContactBridge.js";');
    expect(repository).toContain('"rpc/list_coach_hub_admin_workspace"');
    expect(repository).toContain("return mergeCoachHubWorkspaceIntoContacts(contacts, workspace)");
  });
});
