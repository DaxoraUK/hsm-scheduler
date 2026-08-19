import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const workspaceUi = readFileSync("src/components/league/LeagueScheduleWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");
const migration = readFileSync("supabase/migrations/202607130010_bulk_schedule_editing.sql", "utf8");

describe("League Manager schedule editing UX", () => {
  test("uses compact rows and one explicit batch-save workflow", () => {
    expect(workspaceUi).toContain("Edit the schedule in place, then save all changed fixtures together.");
    expect(workspaceUi).toContain("Save all changes");
    expect(workspaceUi).toContain("Unsaved changes");
    expect(workspaceUi).toContain("Ctrl+S saves all changes");
    expect(workspaceUi).toContain("Schedule version");
    expect(workspaceUi).not.toContain("Fixture placement saved");
  });

  test("groups repeated validation warnings into compact categories", () => {
    expect(workspaceUi).toContain("groupValidationIssues");
    expect(workspaceUi).toContain("Home and away sequences");
    expect(workspaceUi).toContain("categories");
  });

  test("persists changed fixtures atomically through a secured batch RPC", () => {
    expect(supabase).toContain('rpc/update_league_schedule_entries');
    expect(migration).toContain("public.update_league_schedule_entries");
    expect(migration).toContain("public.can_operate_league");
    expect(migration).toContain("jsonb_array_elements");
    expect(migration).toContain("private.assert_league_reference");
    expect(migration).toContain("private.write_league_audit");
    expect(migration).toContain("No more than 1000 schedule entries");
  });
});
