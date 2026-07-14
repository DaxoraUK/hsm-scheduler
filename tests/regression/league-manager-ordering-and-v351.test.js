import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  compareLeagueDivisions,
  getDivisionNameRank,
  orderLeagueDivisions,
} from "../../src/lib/league/leagueOrdering.js";
import { normaliseLeagueWorkspace } from "../../src/lib/league/leagueManagerModel.js";
import { buildLeagueCommandCentre } from "../../src/lib/league/leagueCommandCentre.js";

const page = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202607140005_league_division_ordering_and_v351_ux.sql", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");

describe("League Operations v3.5.1 ordering and navigation refinements", () => {
  test("orders common football divisions in sporting hierarchy rather than import order", () => {
    const divisions = [
      { id: "prem", name: "Premier Division", sortOrder: 0 },
      { id: "d2", name: "Division Two", sortOrder: 1 },
      { id: "d4", name: "Division Four", sortOrder: 2 },
      { id: "d1", name: "Division One", sortOrder: 3 },
      { id: "d3", name: "Division Three", sortOrder: 4 },
    ];

    expect(orderLeagueDivisions(divisions).map((row) => row.name)).toEqual([
      "Premier Division",
      "Division One",
      "Division Two",
      "Division Three",
      "Division Four",
    ]);
    expect(compareLeagueDivisions(divisions[1], divisions[3])).toBeGreaterThan(0);
    expect(getDivisionNameRank("Division 12 North")).toBe(112);
  });

  test("normalises every League Manager workspace with ordered divisions and grouped teams", () => {
    const workspace = normaliseLeagueWorkspace({
      divisions: [
        { id: "d2", name: "Division Two", sort_order: 1 },
        { id: "prem", name: "Premier Division", sort_order: 0 },
        { id: "d1", name: "Division One", sort_order: 2 },
      ],
      teams: [
        { id: "team-b", division_id: "d2", name: "Beta" },
        { id: "team-c", division_id: "prem", name: "Charlie" },
        { id: "team-a", division_id: "prem", name: "Alpha" },
      ],
    });

    expect(workspace.divisions.map((row) => row.id)).toEqual(["prem", "d1", "d2"]);
    expect(workspace.teams.map((row) => row.id)).toEqual(["team-a", "team-c", "team-b"]);
  });

  test("prioritises the signed-in secretary role while retaining the full command picture", () => {
    const command = buildLeagueCommandCentre({
      role: "results",
      workspace: { fixtures: [], divisions: [], teams: [], venues: [], cupTies: [] },
      operations: {
        requirements: [],
        assignments: [{ id: "assignment-1", status: "declined", officialId: "official-1" }],
        postponements: [{ id: "postponement-1", status: "submitted", deadlineOn: "2026-07-10" }],
      },
      clubOperations: { publications: [], acknowledgements: [], changeRequests: [] },
      results: {
        submissions: [{ id: "submission-1", status: "submitted" }],
        publishedFixtures: [],
        results: [],
      },
      readiness: { percentage: 100, checks: [] },
      today: "2026-07-14",
    });

    expect(command.roleFocus?.label).toBe("Results secretary focus");
    expect(command.counts.replacementAssignments).toBe(1);
    expect(command.actions.findIndex((row) => row.id === "result-verification"))
      .toBeLessThan(command.actions.findIndex((row) => row.id === "official-replacements"));
  });

  test("persists navigation, shows queue badges and repairs imported division order at the database boundary", () => {
    expect(page).toContain('url.searchParams.set("lm_area", tab)');
    expect(page).toContain('url.searchParams.set("lm_view", child)');
    expect(page).toContain("tabQueueCount");
    expect(page).toContain('"Fixture records"');
    expect(page).toContain("overflow-x-auto");
    expect(supabase).toContain('rpc/resequence_league_divisions');
    expect(migration).toContain("private.league_division_name_rank");
    expect(migration).toContain("private.resequence_league_divisions_internal");
    expect(migration).toContain("public.resequence_league_divisions");
  });
});
