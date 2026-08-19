/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("../../src/lib/supabase.js", () => ({
  DB: {
    listLeagueScheduleVersions: vi.fn(async () => ([
      { id: "version-1", version_number: 1, name: "Pilot programme", status: "draft" },
    ])),
    getLeagueScheduleVersion: vi.fn(async () => ({
      version: { id: "version-1", version_number: 1, name: "Pilot programme", status: "draft" },
      entries: [
        {
          id: "fixture-1",
          division_id: "division-1",
          scheduled_date: "2026-08-15",
          kick_off: "14:00",
          venue_id: "venue-1",
          home_team_id: "team-1",
          away_team_id: "team-2",
          placement_status: "placed",
          status: "scheduled",
        },
      ],
    })),
    updateLeagueVenueMapPosition: vi.fn(async () => ({})),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fixtureCommandSource = readFileSync("src/components/league/LeagueFixtureCommandWorkspace.jsx", "utf8");
const leaguePageSource = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const errorBoundarySource = readFileSync("src/components/system/AppErrorBoundary.jsx", "utf8");

let LeagueFixtureCommandWorkspace;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  LeagueFixtureCommandWorkspace = (await import("../../src/components/league/LeagueFixtureCommandWorkspace.jsx")).default;
});

afterEach(() => {
  document.body.innerHTML = "";
});

function workspace() {
  return {
    league: { id: "league-1", name: "Pilot League" },
    divisions: [{ id: "division-1", name: "Premier Division" }],
    clubs: [],
    teams: [
      { id: "team-1", name: "Home FC", status: "active" },
      { id: "team-2", name: "Away FC", status: "active" },
    ],
    venues: [{ id: "venue-1", name: "Main Ground", postcode: "BL1 1AA" }],
    cups: [],
    cupTies: [],
  };
}

function operations() {
  return {
    access: { canManageOfficials: true, canOperate: true, canManage: true },
    officials: [],
    availability: [],
    conflicts: [],
    requirements: [],
    assignments: [],
    postponements: [],
    venuePositions: [],
  };
}

describe("League Manager Fixture Command runtime and navigation hotfix", () => {
  test("renders the default calendar after loading a real schedule version", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(React.createElement(LeagueFixtureCommandWorkspace, {
        leagueId: "league-1",
        workspace: workspace(),
        operations: operations(),
        canManage: true,
        onRefreshOperations: vi.fn(),
      }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(host.textContent).toContain("Fixture Command");
    expect(host.textContent).toContain("August 2026");
    expect(host.textContent).toContain("Home FC");

    await act(async () => root.unmount());
  });

  test("does not shadow the JavaScript Map constructor with the map icon", () => {
    expect(fixtureCommandSource).toContain("Map as MapIcon");
    expect(fixtureCommandSource).toContain("new globalThis.Map()");
    expect(fixtureCommandSource).not.toContain('import {\n  AlertTriangle,\n  CalendarDays,\n  ChevronLeft,\n  ChevronRight,\n  CircleAlert,\n  Filter,\n  Grid3X3,\n  List,\n  Map,');
  });

  test("replaces the horizontally scrolling workspace strip with a responsive grid", () => {
    expect(leaguePageSource).toContain('aria-label="League Manager workspaces"');
    expect(leaguePageSource).toContain("grid-cols-2");
    expect(leaguePageSource).toContain("xl:grid-cols-5");
    expect(leaguePageSource).not.toContain('className="overflow-x-auto pb-1"');
  });

  test("uses product-neutral recovery wording for both club and league workspaces", () => {
    expect(errorBoundarySource).toContain("The Daxora workspace hit an unexpected problem.");
    expect(errorBoundarySource).toContain("club or league data");
    expect(errorBoundarySource).toContain("Reload workspace");
    expect(errorBoundarySource).not.toContain("Reload Ground Control");
  });
});
