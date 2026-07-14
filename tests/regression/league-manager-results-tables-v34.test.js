/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildLeagueStandings,
  buildMissingResultQueue,
  normaliseLeagueResultsData,
  parseFullTimeResultsCsv,
  reconcileFullTimeResults,
} from "../../src/lib/league/leagueResultsEngine.js";

const mockDb = {
  getLeagueResultsData: vi.fn(async () => ({
    access: { can_manage_results: true, can_manage: true },
    results: [],
    submissions: [],
    adjustments: [],
    published_fixtures: [{
      publication_fixture_id: "pf-1",
      target_type: "schedule_entry",
      target_id: "entry-1",
      fixture_key: "league:division-1:team-1:team-2:1",
      competition_type: "league",
      competition_id: "division-1",
      division_id: "division-1",
      home_team_id: "team-1",
      away_team_id: "team-2",
      scheduled_date: "2025-08-15",
      kick_off: "14:00:00",
    }],
  })),
  recordLeagueFixtureResult: vi.fn(async () => "result-1"),
  reviewLeagueResultSubmission: vi.fn(async () => "result-1"),
  upsertLeagueTableAdjustment: vi.fn(async () => "adjustment-1"),
  revokeLeagueTableAdjustment: vi.fn(async () => null),
};

vi.mock("../../src/lib/supabase.js", () => ({ DB: mockDb }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const migration = readFileSync("supabase/migrations/202607140004_club_operations_stability_results_tables.sql", "utf8");
const pageSource = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const portalSource = readFileSync("src/components/league/LeagueClubPortalPage.jsx", "utf8");
const supabaseSource = readFileSync("src/lib/supabase.js", "utf8");
let LeagueResultsWorkspace;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  LeagueResultsWorkspace = (await import("../../src/components/league/LeagueResultsWorkspace.jsx")).default;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const workspace = {
  league: { id: "league-1", name: "Pilot League" },
  seasons: [{ id: "season-1", name: "2026/27", isCurrent: true }],
  divisions: [{ id: "division-1", name: "Premier Division", winPoints: 3, drawPoints: 1, lossPoints: 0 }],
  teams: [
    { id: "team-1", divisionId: "division-1", name: "Alpha", status: "active" },
    { id: "team-2", divisionId: "division-1", name: "Bravo", status: "active" },
    { id: "team-3", divisionId: "division-1", name: "Charlie", status: "active" },
  ],
  cups: [{ id: "cup-1", name: "League Cup" }],
};

function result(overrides = {}) {
  return {
    id: "result-1",
    fixtureKey: "league:division-1:team-1:team-2:1",
    competitionType: "league",
    competitionId: "division-1",
    divisionId: "division-1",
    homeTeamId: "team-1",
    awayTeamId: "team-2",
    outcomeType: "played",
    homeScore: 2,
    awayScore: 1,
    status: "verified",
    ...overrides,
  };
}

describe("League Operations v3.4 results, tables and stability", () => {
  test("normalises result payloads and preserves dedicated permissions", () => {
    const data = normaliseLeagueResultsData({
      access: { can_manage_results: true, can_manage: false, can_submit: true },
      results: [{ publication_fixture_id: "pf-1", home_team_id: "team-1", away_team_id: "team-2", home_score: 2, away_score: 1 }],
      submissions: [{ publication_fixture_id: "pf-1", outcome_type: "played" }],
      adjustments: [{ team_id: "team-1", points_delta: -3 }],
      published_fixtures: [{ publication_fixture_id: "pf-1", home_team_id: "team-1", away_team_id: "team-2" }],
    });
    expect(data.access).toEqual({ canManageResults: true, canManage: false, canSubmit: true });
    expect(data.results[0]).toEqual(expect.objectContaining({ publicationFixtureId: "pf-1", homeTeamId: "team-1", homeScore: 2 }));
    expect(data.adjustments[0].pointsDelta).toBe(-3);
  });

  test("calculates standings from verified results and auditable adjustments", () => {
    const tables = buildLeagueStandings({
      divisions: workspace.divisions,
      teams: workspace.teams,
      results: [
        result(),
        result({ id: "result-2", fixtureKey: "league:division-1:team-2:team-3:1", homeTeamId: "team-2", awayTeamId: "team-3", homeScore: 0, awayScore: 0 }),
        result({ id: "result-3", fixtureKey: "league:division-1:team-3:team-1:1", homeTeamId: "team-3", awayTeamId: "team-1", outcomeType: "void", homeScore: null, awayScore: null, status: "void" }),
      ],
      adjustments: [{ id: "adj-1", divisionId: "division-1", teamId: "team-1", pointsDelta: -1, goalsForDelta: 0, goalsAgainstDelta: 0, status: "active" }],
    });
    expect(tables).toHaveLength(1);
    expect(tables[0].standings[0]).toEqual(expect.objectContaining({ teamId: "team-1", played: 1, won: 1, points: 2 }));
    expect(tables[0].standings.find((row) => row.teamId === "team-2")).toEqual(expect.objectContaining({ played: 2, drawn: 1, lost: 1, points: 1 }));
  });

  test("missing-result queue treats void and abandoned outcomes as resolved records", () => {
    const fixtures = [
      { publicationFixtureId: "pf-1", targetId: "entry-1", fixtureKey: "league:division-1:team-1:team-2:1", scheduledDate: "2026-08-15" },
      { publicationFixtureId: "pf-2", targetId: "entry-2", fixtureKey: "league:division-1:team-2:team-3:1", scheduledDate: "2026-08-22" },
    ];
    const queue = buildMissingResultQueue(fixtures, [result({ fixtureKey: fixtures[0].fixtureKey, outcomeType: "void", status: "void" })], { today: "2026-09-01" });
    expect(queue.map((row) => row.publicationFixtureId)).toEqual(["pf-2"]);
  });

  test("parses and reconciles common Full-Time result exports", () => {
    const csv = "Date,Home Team,Home Score,Away Score,Away Team\n15/08/2026,Alpha,2,1,Bravo";
    const parsed = parseFullTimeResultsCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toEqual(expect.objectContaining({ date: "2026-08-15", homeScore: 2, awayScore: 1 }));

    const comparison = reconcileFullTimeResults(csv, [{
      publicationFixtureId: "pf-1",
      fixtureKey: "league:division-1:team-1:team-2:1",
      scheduledDate: "2026-08-15",
      homeTeamId: "team-1",
      awayTeamId: "team-2",
    }], [], workspace);
    expect(comparison.matched).toHaveLength(1);
    expect(comparison.matched[0].status).toBe("new");
    expect(comparison.unmatched).toHaveLength(0);
  });

  test("renders one result command workspace with missing-result control", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(React.createElement(LeagueResultsWorkspace, { leagueId: "league-1", workspace }));
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(host.textContent).toContain("Results, tables and cup progression");
    expect(host.textContent).toContain("Missing-result command queue");
    expect(host.textContent).toContain("Alpha v Bravo");
    expect(host.textContent).toContain("League tables");
    await act(async () => root.unmount());
  });

  test("repairs the exact Club Operations RPC and explicitly reloads PostgREST", () => {
    expect(migration).toContain("drop function if exists public.get_league_club_operations_data(uuid)");
    expect(migration).toContain("create function public.get_league_club_operations_data(target_league_id uuid)");
    expect(migration).toContain("pg_notify('pgrst','reload schema')");
    expect(supabaseSource).toContain("LEAGUE_CLUB_OPERATIONS_RPC_MISSING");
    expect(supabaseSource).toContain("schema cache");
  });

  test("enforces results security, roles, walkovers, cup winners and audit history", () => {
    for (const table of ["league_result_submissions", "league_results", "league_table_adjustments"]) expect(migration).toContain(table);
    expect(migration).toContain("force row level security");
    expect(migration).toContain("'owner','admin','fixtures','results'");
    expect(migration).toContain("A result cannot be submitted before the fixture date");
    expect(migration).toContain("The league has already verified this fixture result");
    expect(migration).toContain("Select the team progressing from this cup tie");
    expect(migration).toContain("Superseded by the verified result");
    expect(migration).toContain("walkover_score");
    expect(migration).toContain("private.write_league_audit");
  });

  test("exposes Results & tables to league staff and result submission to clubs", () => {
    expect(pageSource).toContain('["results", "Results & tables", Table2]');
    expect(pageSource).toContain('<option value="results">Results secretary</option>');
    expect(portalSource).toContain('["results", "Results", Table2]');
    expect(portalSource).toContain("submitLeagueFixtureResult");
    expect(portalSource).toContain("Awaiting league verification");
  });
});
