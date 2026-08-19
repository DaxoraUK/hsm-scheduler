/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { buildLeagueCommandCentre } from "../../src/lib/league/leagueCommandCentre.js";

const mockDb = {
  getLeagueClubOperationsData: vi.fn(async () => ({
    publications: [{ id: "publication-1", status: "published" }],
    acknowledgements: [],
    change_requests: [],
  })),
  getLeagueResultsData: vi.fn(async () => ({ results: [], submissions: [], adjustments: [], published_fixtures: [] })),
  listLeagueScheduleVersions: vi.fn(async () => [{ id: "version-1", status: "published", version_number: 3 }]),
  getLeagueScheduleVersion: vi.fn(async () => ({
    version: { id: "version-1", status: "published", season_id: "season-1" },
    entries: [{
      id: "entry-1",
      version_id: "version-1",
      season_id: "season-1",
      division_id: "division-1",
      home_team_id: "team-1",
      away_team_id: "team-2",
      venue_id: "venue-1",
      scheduled_date: "2026-07-25",
      kick_off: "14:00:00",
      placement_status: "placed",
    }],
  })),
};

vi.mock("../../src/lib/supabase.js", () => ({ DB: mockDb }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

let LeagueCommandCentreWorkspace;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-14T10:00:00Z"));
  LeagueCommandCentreWorkspace = (await import("../../src/components/league/LeagueCommandCentreWorkspace.jsx")).default;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const workspace = {
  league: { id: "league-1", slug: "pilot-league" },
  divisions: [{ id: "division-1", name: "Premier Division" }],
  teams: [{ id: "team-1", name: "Alpha" }, { id: "team-2", name: "Bravo" }],
  venues: [{ id: "venue-1", name: "Central Ground" }],
  fixtures: [],
  cupTies: [],
};

function scheduleVersion() {
  return {
    version: { id: "version-1", seasonId: "season-1", status: "published" },
    entries: [
      { id: "entry-1", versionId: "version-1", seasonId: "season-1", divisionId: "division-1", homeTeamId: "team-1", awayTeamId: "team-2", venueId: "venue-1", scheduledDate: "2026-07-25", kickOff: "14:00", placementStatus: "placed" },
      { id: "entry-2", versionId: "version-1", seasonId: "season-1", divisionId: "division-1", homeTeamId: "team-2", awayTeamId: "team-1", venueId: "", scheduledDate: "", kickOff: "", placementStatus: "unplaced" },
    ],
  };
}

describe("League Operations v3.5 command centre and UX consolidation", () => {
  test("prioritises critical league work and counts schedule-version exceptions", () => {
    const command = buildLeagueCommandCentre({
      workspace,
      scheduleVersion: scheduleVersion(),
      operations: {
        requirements: [{ scopeType: "league", scopeId: "", refereeCount: 1, assistantCount: 0 }],
        assignments: [{ targetType: "schedule_entry", targetId: "entry-1", role: "referee", officialId: "official-1", status: "declined" }],
        postponements: [{ id: "postponement-1", status: "submitted", deadlineOn: "2026-07-10" }],
      },
      clubOperations: {
        publications: [{ id: "publication-1", status: "published" }],
        acknowledgements: [{ id: "ack-1", status: "awaiting" }],
        changeRequests: [{ id: "request-1", status: "submitted" }],
      },
      results: {
        submissions: [{ id: "submission-1", status: "submitted" }],
        publishedFixtures: [{ publicationFixtureId: "pf-1", targetId: "played-1", fixtureKey: "league:division-1:a:b:1", scheduledDate: "2026-07-10" }],
        results: [],
      },
      readiness: { percentage: 75, checks: [{ id: "venues", complete: false, optionalForSetup: false }] },
      today: "2026-07-14",
    });

    expect(command.status).toBe("action_required");
    expect(command.counts).toEqual(expect.objectContaining({
      overduePostponements: 1,
      pendingResults: 1,
      missingResults: 1,
      openChangeRequests: 1,
      officialGaps: 1,
      pendingAcknowledgements: 1,
      unplacedFixtures: 1,
      setupGaps: 1,
    }));
    expect(command.actions[0].severity).toBe("critical");
    expect(command.actions.map((row) => row.id)).toEqual(expect.arrayContaining([
      "overdue-postponements",
      "result-verification",
      "official-replacements",
      "unplaced-fixtures",
    ]));
    expect(command.nextFixtures[0]).toEqual(expect.objectContaining({ homeTeamName: "Alpha", awayTeamName: "Bravo", venueName: "Central Ground" }));
  });

  test("renders raw database schedule rows through the normalised operational window", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(LeagueCommandCentreWorkspace, {
        leagueId: "league-1",
        workspace,
        operations: { requirements: [], assignments: [], postponements: [] },
        readiness: { percentage: 100, checks: [] },
      }));
      await vi.runAllTimersAsync();
    });

    expect(host.textContent).toContain("Operational command centre");
    expect(host.textContent).toContain("Alpha v Bravo");
    expect(host.textContent).toContain("Central Ground");
    expect(mockDb.getLeagueScheduleVersion).toHaveBeenCalledWith("league-1", "version-1");

    await act(async () => root.unmount());
  });

  test("reduces the top-level navigation to five operational areas with deep workspace hand-offs", () => {
    const page = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
    const commandCentre = readFileSync("src/components/league/LeagueCommandCentreWorkspace.jsx", "utf8");
    const fixtureCommand = readFileSync("src/components/league/LeagueFixtureCommandWorkspace.jsx", "utf8");
    const officials = readFileSync("src/components/league/LeagueOfficialsWorkspace.jsx", "utf8");
    const clubs = readFileSync("src/components/league/LeagueClubOperationsWorkspace.jsx", "utf8");
    const results = readFileSync("src/components/league/LeagueResultsWorkspace.jsx", "utf8");

    for (const label of ["Command", "Fixtures", "Competitions", "Clubs", "Administration"]) expect(page).toContain(`"${label}"`);
    expect(page).toContain("NAV_GROUPS.map");
    expect(page).toContain("onNavigate={navigateLeague}");
    expect(commandCentre).toContain('onNavigate?.(item.tab, item.child)');
    expect(fixtureCommand).toContain("initialView");
    expect(officials).toContain("initialTab");
    expect(clubs).toContain("initialView");
    expect(results).toContain("initialTab");
  });
});
