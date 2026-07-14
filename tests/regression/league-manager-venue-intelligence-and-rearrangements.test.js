import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  normaliseLeagueOperationsData,
  suggestLeagueRearrangementDates,
} from "../../src/lib/league/leagueOperationsEngine.js";
import {
  buildVenueGeocodeRequest,
  coordinateSourceLabel,
  haversineMiles,
  normaliseUkPostcode,
} from "../../src/lib/league/leagueVenueIntelligence.js";

const fixtureCommand = readFileSync("src/components/league/LeagueFixtureCommandWorkspace.jsx", "utf8");
const officialsWorkspace = readFileSync("src/components/league/LeagueOfficialsWorkspace.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");
const api = readFileSync("api/league/geocode-venues.js", "utf8");
const migration = readFileSync("supabase/migrations/202607140002_league_venue_intelligence_and_automated_rearrangements.sql", "utf8");

function workspace() {
  return {
    seasons: [{ id: "season", isCurrent: true, startsOn: "2026-08-01", endsOn: "2027-05-31", defaultKickOff: "14:00" }],
    divisions: [{ id: "prem", seasonId: "season", startsOn: "2026-08-15", endsOn: "2027-05-15", defaultKickOff: "14:00" }],
    clubs: [{ id: "club-a" }, { id: "club-b" }, { id: "club-c" }],
    teams: [
      { id: "a", name: "A", parentClubId: "club-a" },
      { id: "b", name: "B", parentClubId: "club-b" },
      { id: "c", name: "C", parentClubId: "club-c" },
    ],
    venues: [
      { id: "v1", name: "Ground 1", groundShareKey: "GROUND", simultaneousFixtureLimit: 1 },
      { id: "v2", name: "Ground 2", groundShareKey: "OTHER", simultaneousFixtureLimit: 1 },
    ],
    playingDates: [
      { seasonId: "season", playingDate: "2026-08-22", status: "available", defaultKickOff: "14:00" },
      { seasonId: "season", playingDate: "2026-08-29", status: "available", defaultKickOff: "14:00" },
      { seasonId: "season", playingDate: "2026-09-05", status: "available", defaultKickOff: "14:00" },
    ],
    blackouts: [{ seasonId: "season", scopeType: "league", startsOn: "2026-08-29", endsOn: "2026-08-29", reason: "Closed date" }],
  };
}

const postponedFixture = {
  targetType: "schedule_entry",
  targetId: "target",
  seasonId: "season",
  divisionId: "prem",
  date: "2026-08-15",
  kickOff: "14:00",
  venueId: "v1",
  homeTeamId: "a",
  awayTeamId: "b",
  homeTeamName: "A",
  awayTeamName: "B",
  status: "scheduled",
};

describe("League Operations venue intelligence and rearrangement automation", () => {
  test("normalises UK postcodes and prepares no more than one row per venue", () => {
    expect(normaliseUkPostcode("bl6-7qe")).toBe("BL6 7QE");
    expect(normaliseUkPostcode("not a postcode")).toBe("");
    expect(buildVenueGeocodeRequest([
      { id: "venue-1", postcode: "BL6 7QE" },
      { id: "venue-1", postcode: "BL6 7QE" },
      { id: "venue-2", postcode: "" },
    ])).toEqual([{ id: "venue-1", postcode: "BL6 7QE" }]);
  });

  test("labels coordinate provenance and calculates straight-line distance", () => {
    expect(coordinateSourceLabel("postcode_centroid")).toBe("Postcode centroid");
    expect(coordinateSourceLabel("manual")).toBe("Manually refined");
    const miles = haversineMiles({ latitude: 53.60263, longitude: -2.555633 }, { latitude: 53.601945, longitude: -2.550169 });
    expect(miles).toBeGreaterThan(0.1);
    expect(miles).toBeLessThan(1);
  });

  test("ranks only valid postponement dates and excludes team clashes and blackouts", () => {
    const fixtures = [
      postponedFixture,
      { ...postponedFixture, targetId: "other", date: "2026-08-22", venueId: "v2", homeTeamId: "a", awayTeamId: "c", homeTeamName: "A", awayTeamName: "C" },
    ];
    const suggestions = suggestLeagueRearrangementDates({
      postponement: { originalDate: "2026-08-15", deadlineOn: "2026-09-30" },
      fixture: postponedFixture,
      fixtures,
      workspace: workspace(),
    });
    expect(suggestions.map((row) => row.date)).toEqual(["2026-09-05"]);
    expect(suggestions[0]).toEqual(expect.objectContaining({ kickOff: "14:00", venueId: "v1", blockers: [] }));
  });

  test("normalises coordinate source and rearrangement resolution data from Supabase", () => {
    const result = normaliseLeagueOperationsData({
      venue_positions: [{ id: "v1", latitude: "53.6", longitude: "-2.5", coordinate_source: "postcode_centroid", coordinate_accuracy: "postcode" }],
      postponements: [{ id: "p1", selected_date: "2026-09-05", selected_kick_off: "14:00", resolution_version_id: "version-2" }],
    });
    expect(result.venuePositions[0]).toEqual(expect.objectContaining({ coordinateSource: "postcode_centroid", coordinateAccuracy: "postcode" }));
    expect(result.postponements[0]).toEqual(expect.objectContaining({ selectedDate: "2026-09-05", selectedKickOff: "14:00", resolutionVersionId: "version-2" }));
  });

  test("ships bulk venue geocoding and operator-refinable map controls", () => {
    expect(api).toContain("https://api.postcodes.io/postcodes");
    expect(api).toContain("can_manage_league");
    expect(api).toContain("slice(0, 100)");
    expect(fixtureCommand).toContain("Map postcodes");
    expect(fixtureCommand).toContain("Save exact position");
    expect(fixtureCommand).toContain("Postcode centroid");
    expect(supabase).toContain("geocodeLeagueVenuePostcodes");
    expect(supabase).toContain("bulkUpdateLeagueVenueMapPositions");
  });

  test("seeds the pilot venues and applies rearrangements atomically into a new version", () => {
    for (const postcode of ["BL67QE", "BL67NH", "BL26RF", "M146ZT", "OL128BA"]) expect(migration).toContain(postcode);
    expect(migration).toContain("bulk_update_league_venue_map_positions");
    expect(migration).toContain("save_league_postponement_suggestions");
    expect(migration).toContain("apply_league_postponement_rearrangement");
    expect(migration).toContain("The rearranged date is not an available league playing date");
    expect(migration).toContain("One of the teams already plays on the selected date");
    expect(migration).toContain("The selected shared ground is already at capacity");
    expect(migration).toContain("parent_version_id");
    expect(migration).toContain("status = 'rearranged'");
    expect(officialsWorkspace).toContain("Find valid dates");
    expect(officialsWorkspace).toContain("Apply date");
    expect(supabase).toContain("applyLeaguePostponementRearrangement");
  });
});
