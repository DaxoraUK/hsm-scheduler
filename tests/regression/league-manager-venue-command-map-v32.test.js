/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildVenueOperationalSummaries,
  clusterVenueMarkers,
  filterFixturesForVenueScope,
  groupLeagueVenues,
} from "../../src/lib/league/leagueVenueIntelligence.js";

vi.mock("../../src/lib/supabase.js", () => ({
  DB: {
    listLeagueScheduleVersions: vi.fn(async () => ([{ id: "version-1", version_number: 1, name: "Programme", status: "draft" }])),
    getLeagueScheduleVersion: vi.fn(async () => ({
      version: { id: "version-1", version_number: 1, name: "Programme", status: "draft" },
      entries: [
        { id: "f1", division_id: "d1", scheduled_date: "2026-08-15", kick_off: "14:00", venue_id: "v1", home_team_id: "t1", away_team_id: "t2", placement_status: "placed", status: "scheduled" },
        { id: "f2", division_id: "d1", scheduled_date: "2026-08-15", kick_off: "14:00", venue_id: "v2", home_team_id: "t3", away_team_id: "t4", placement_status: "placed", status: "scheduled" },
      ],
    })),
    geocodeLeagueVenuePostcodes: vi.fn(async () => ({ coordinates: [], unmatched: [] })),
    bulkUpdateLeagueVenueMapPositions: vi.fn(async () => ({})),
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const mapSource = readFileSync("src/components/league/LeagueVenueMap.jsx", "utf8");
let LeagueFixtureCommandWorkspace;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  LeagueFixtureCommandWorkspace = (await import("../../src/components/league/LeagueFixtureCommandWorkspace.jsx")).default;
});

afterEach(() => { document.body.innerHTML = ""; });

const venues = [
  { id: "v1", name: "Main Ground #1", postcode: "BL6 7QE", groundShareKey: "MAIN", simultaneousFixtureLimit: 1 },
  { id: "v2", name: "Main Ground #2", postcode: "BL6 7QE", groundShareKey: "MAIN", simultaneousFixtureLimit: 1 },
  { id: "v3", name: "Away Ground", postcode: "M14 6ZT", groundShareKey: "AWAY", simultaneousFixtureLimit: 1 },
];
const positions = [
  { id: "v1", latitude: 53.59, longitude: -2.54, coordinateSource: "postcode_centroid" },
  { id: "v2", latitude: 53.59, longitude: -2.54, coordinateSource: "postcode_centroid" },
  { id: "v3", latitude: 53.44, longitude: -2.22, coordinateSource: "manual" },
];

describe("League Operations v3.2 venue command map", () => {
  test("groups multiple pitches at one ground into one physical site", () => {
    const groups = groupLeagueVenues(venues, positions);
    expect(groups).toHaveLength(2);
    expect(groups.find((row) => row.id === "MAIN")).toEqual(expect.objectContaining({ name: "Main Ground", capacity: 2 }));
    expect(groups.find((row) => row.id === "MAIN").venueIds).toEqual(["v1", "v2"]);
  });

  test("calculates ground pressure from simultaneous fixtures and physical capacity", () => {
    const groups = groupLeagueVenues(venues, positions);
    const summaries = buildVenueOperationalSummaries(groups, [
      { venueId: "v1", date: "2026-08-15", kickOff: "14:00", homeTeamId: "t1", awayTeamId: "t2", officialComplete: true },
      { venueId: "v2", date: "2026-08-15", kickOff: "14:00", homeTeamId: "t3", awayTeamId: "t4", officialComplete: false },
    ]);
    expect(summaries.find((row) => row.id === "MAIN")).toEqual(expect.objectContaining({ fixtureCount: 2, peakConcurrent: 2, capacity: 2, pressureRatio: 1, missingOfficialCount: 1, overCapacity: false }));
  });

  test("supports season, month and matchday scopes", () => {
    const rows = [{ date: "2026-08-15" }, { date: "2026-08-22" }, { date: "2026-09-05" }];
    expect(filterFixturesForVenueScope(rows, "month", { focusMonth: "2026-08" })).toHaveLength(2);
    expect(filterFixturesForVenueScope(rows, "matchday", { focusDate: "2026-09-05" })).toEqual([{ date: "2026-09-05" }]);
    expect(filterFixturesForVenueScope(rows, "season")).toHaveLength(3);
  });

  test("clusters nearby markers instead of printing every venue label", () => {
    expect(clusterVenueMarkers([{ id: "a", x: 100, y: 100 }, { id: "b", x: 120, y: 110 }, { id: "c", x: 400, y: 400 }], 40)).toHaveLength(2);
    expect(mapSource).toContain("© OpenStreetMap contributors");
    expect(mapSource).toContain("Multiple pitches at the same ground are grouped into one operational site");
    expect(mapSource).toContain("Ground command list");
    expect(mapSource).not.toContain("<text y=\"-4\"");
  });

  test("renders the new physical-site map workspace", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const workspace = {
      league: { id: "league-1", name: "League" },
      divisions: [{ id: "d1", name: "Premier" }],
      clubs: [],
      teams: ["t1", "t2", "t3", "t4"].map((id) => ({ id, name: id.toUpperCase(), status: "active" })),
      venues,
      cups: [],
      cupTies: [],
    };
    const operations = { access: {}, officials: [], availability: [], conflicts: [], requirements: [], assignments: [], postponements: [], venuePositions: positions };

    await act(async () => {
      root.render(React.createElement(LeagueFixtureCommandWorkspace, { leagueId: "league-1", workspace, operations, canManage: true, onRefreshOperations: vi.fn() }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const mapButton = [...host.querySelectorAll("button")].find((button) => button.textContent.includes("Venue map"));
    await act(async () => mapButton.click());
    expect(host.textContent).toContain("Venue intelligence");
    expect(host.textContent).toContain("2/2 physical sites mapped");
    expect(host.textContent).toContain("2 sites · 3 pitches");
    expect(host.textContent).toContain("Ground command list");
    await act(async () => root.unmount());
  });
});
