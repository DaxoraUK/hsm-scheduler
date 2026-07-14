/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildFullTimeFixtureCsv,
  compareLeaguePublications,
  normaliseLeagueClubOperationsData,
  normaliseLeagueClubPortalData,
  reconcileFullTimeFixtureCsv,
} from "../../src/lib/league/leagueClubOperations.js";

const mockDb = {
  getLeagueClubOperationsData: vi.fn(async () => ({
    access: { can_manage: true, can_operate: true, can_manage_clubs: true },
    publications: [],
    publication_fixtures: [],
    acknowledgements: [],
    change_requests: [],
    communications: [],
    club_memberships: [],
    club_invitations: [],
    calendar_feeds: [],
  })),
  listLeagueScheduleVersions: vi.fn(async () => ([
    { id: "version-1", version_number: 1, name: "Published programme", status: "published" },
  ])),
  getLeagueScheduleVersion: vi.fn(async () => ({
    version: { id: "version-1", version_number: 1, name: "Published programme", status: "published" },
    entries: [{
      id: "entry-1",
      division_id: "division-1",
      scheduled_date: "2026-08-15",
      kick_off: "14:00:00",
      venue_id: "venue-1",
      home_team_id: "team-1",
      away_team_id: "team-2",
      placement_status: "placed",
    }],
  })),
};

vi.mock("../../src/lib/supabase.js", () => ({ DB: mockDb }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const migration = readFileSync("supabase/migrations/202607140003_league_club_portal_publication_communications.sql", "utf8");
const leaguePage = readFileSync("src/pages/LeagueManagerPage.jsx", "utf8");
const operationsUi = readFileSync("src/components/league/LeagueClubOperationsWorkspace.jsx", "utf8");
const portalUi = readFileSync("src/components/league/LeagueClubPortalPage.jsx", "utf8");
const calendarApi = readFileSync("api/league/calendar.js", "utf8");
let LeagueClubOperationsWorkspace;
let LeagueClubPortalPage;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  LeagueClubOperationsWorkspace = (await import("../../src/components/league/LeagueClubOperationsWorkspace.jsx")).default;
  LeagueClubPortalPage = (await import("../../src/components/league/LeagueClubPortalPage.jsx")).default;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

const workspace = {
  league: { id: "league-1", name: "Pilot League" },
  divisions: [{ id: "division-1", name: "Premier Division" }],
  cups: [{ id: "cup-1", name: "League Cup" }],
  cupTies: [{
    id: "cup-tie-1",
    cupId: "cup-1",
    scheduledDate: "2026-09-05",
    kickOff: "14:00",
    venueId: "venue-1",
    homeTeamId: "team-1",
    awayTeamId: "team-2",
    status: "scheduled",
  }],
  clubs: [{ id: "club-1", name: "Club One", status: "active" }, { id: "club-2", name: "Club Two", status: "active" }],
  teams: [{ id: "team-1", name: "Club One", parentClubId: "club-1" }, { id: "team-2", name: "Club Two", parentClubId: "club-2" }],
  venues: [{ id: "venue-1", name: "Main Ground", parentClubId: "club-1" }],
};

function publicationRow(overrides = {}) {
  return {
    id: "publication-fixture-1",
    publicationId: "publication-1",
    targetType: "schedule_entry",
    targetId: "entry-1",
    snapshot: {
      scheduled_date: "2026-08-15",
      kick_off: "14:00:00",
      venue_id: "venue-1",
      home_team_id: "team-1",
      away_team_id: "team-2",
      division_id: "division-1",
      competition_type: "league",
      competition_id: "division-1",
    },
    ...overrides,
  };
}

describe("League Operations v3.3 club portal, publication and communications", () => {
  test("normalises staff and club portal payloads without broadening club scope", () => {
    const staff = normaliseLeagueClubOperationsData({
      access: { can_manage: true, can_operate: true, can_manage_clubs: true },
      club_memberships: [{ league_id: "league-1", parent_club_id: "club-1", display_name: "Club Secretary" }],
    });
    expect(staff.access).toEqual({ canManage: true, canOperate: true, canManageClubs: true });
    expect(staff.clubMemberships[0]).toEqual(expect.objectContaining({ leagueId: "league-1", parentClubId: "club-1", displayName: "Club Secretary" }));

    const portal = normaliseLeagueClubPortalData({
      league: { id: "league-1", name: "Pilot League" },
      club: { id: "club-1", name: "Club One" },
      access: { role: "club_secretary", can_respond: true, can_request_changes: true },
      teams: [{ id: "team-1", parent_club_id: "club-1", name: "Club One" }],
      fixtures: [{ target_type: "schedule_entry", target_id: "entry-1", publication_fixture_id: "pf-1" }],
    });
    expect(portal.access).toEqual({ role: "club_secretary", canRespond: true, canRequestChanges: true });
    expect(portal.teams).toHaveLength(1);
    expect(portal.fixtures[0]).toEqual(expect.objectContaining({ targetType: "schedule_entry", targetId: "entry-1", publicationFixtureId: "pf-1" }));
  });

  test("compares fixture releases and identifies exact changed fields", () => {
    const current = publicationRow();
    const previous = publicationRow({ snapshot: { ...publicationRow().snapshot, scheduled_date: "2026-08-22", venue_id: "venue-2" } });
    const diff = compareLeaguePublications([current], [previous]);
    expect(diff.counts).toEqual({ added: 0, removed: 0, changed: 1, unchanged: 0 });
    expect(diff.changed[0].fields).toEqual(expect.arrayContaining(["date", "venueId"]));
  });

  test("exports UK fixture dates and reconciles common Full-Time date formats", () => {
    const csv = buildFullTimeFixtureCsv([publicationRow()], workspace);
    expect(csv).toContain("15/08/2026,14:00,Premier Division,Club One,Club Two,Main Ground");

    const result = reconcileFullTimeFixtureCsv(
      "Date,Time,Home Team,Away Team,Venue\n15/08/2026,14:00,Club One,Club Two,Main Ground",
      [publicationRow()],
      workspace,
    );
    expect(result.errors).toEqual([]);
    expect(result.matched).toHaveLength(1);
    expect(result.differences).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  test("renders one controlled staff workspace and includes league plus cup fixtures in a full release", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(React.createElement(LeagueClubOperationsWorkspace, {
        leagueId: "league-1",
        workspace,
        canManage: true,
        canOperate: true,
        operations: {},
      }));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(host.textContent).toContain("Club portal, publication and communications");
    expect(host.textContent).toContain("2 fixtures are in the selected release scope");
    expect(host.textContent).toContain("Publication");
    expect(host.textContent).toContain("Club access");
    expect(host.textContent).toContain("Full-Time");
    await act(async () => root.unmount());
  });

  test("renders a club-only action workspace with no league administration navigation", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const portal = normaliseLeagueClubPortalData({
      league: { id: "league-1", name: "Pilot League" },
      club: { id: "club-1", name: "Club One" },
      access: { role: "club_secretary", can_respond: true, can_request_changes: true },
      teams: workspace.teams.filter((team) => team.parentClubId === "club-1"),
      venues: workspace.venues,
      fixtures: [{
        ...publicationRow().snapshot,
        target_type: "schedule_entry",
        target_id: "entry-1",
        publication_id: "publication-1",
        publication_fixture_id: "publication-fixture-1",
        home_team_name: "Club One",
        away_team_name: "Club Two",
        venue_name: "Main Ground",
      }],
      acknowledgements: [{ id: "ack-1", publication_fixture_id: "publication-fixture-1", status: "awaiting" }],
      change_requests: [], communications: [], calendar_feeds: [],
    });
    await act(async () => {
      root.render(React.createElement(LeagueClubPortalPage, { leagueId: "league-1", portal, onRefresh: vi.fn() }));
    });
    expect(host.textContent).toContain("Club One");
    expect(host.textContent).toContain("Club portal");
    expect(host.textContent).toContain("Awaiting response1");
    expect(host.textContent).not.toContain("Schedule builder");
    expect(host.textContent).not.toContain("Match officials");
    await act(async () => root.unmount());
  });

  test("enforces club isolation, active publication scope and private calendar tokens in the database", () => {
    for (const table of [
      "league_club_memberships",
      "league_publications",
      "league_publication_fixtures",
      "league_fixture_acknowledgements",
      "league_fixture_change_requests",
      "league_communications",
      "league_calendar_tokens",
    ]) expect(migration).toContain(table);
    expect(migration).toContain("force row level security");
    expect(migration).toContain("Only an active published club fixture can be changed");
    expect(migration).toContain("club_id = any(publication_fixture.parent_club_ids)");
    expect(migration).toContain("league_fixture_change_requests_one_open_idx");
    expect(migration).toContain("publication.status = 'published'");
    expect(migration).toContain("encode(digest(raw_token, 'sha256'), 'hex')");
    expect(migration).toContain("join public.league_schedule_entries schedule_entry on schedule_entry.id = assignment.target_id");
    expect(migration).toContain("grant execute on function public.get_league_calendar_feed(text) to anon, authenticated");
    expect(migration).not.toContain("'token', raw_token, 'token_hash'");
  });

  test("exposes the complete v3.3 workflow without pretending communication delivery or a live Full-Time API", () => {
    expect(leaguePage).toContain('"clubs", "Club operations"');
    expect(leaguePage).toContain("LeagueClubPortalPage");
    expect(leaguePage).toContain('"club_secretary", "team_contact", "club_viewer"');
    expect(operationsUi).toContain("Schedule publication and club release are separate controls");
    expect(operationsUi).toContain("Publishing creates one acknowledgement task per affected club");
    expect(operationsUi).toContain("The first integration remains controlled CSV import/export");
    expect(portalUi).toContain("Fixture-change requests");
    expect(portalUi).toContain("Private calendar URL");
    expect(calendarApi).toContain("BEGIN:VCALENDAR");
    expect(calendarApi).toContain('"cache-control": "private, max-age=300"');
  });
});
