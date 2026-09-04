import { describe, expect, it } from "vitest";
import {
  buildTimelineMoveCandidate,
  getTimelinePitchState,
  rankTimelinePitches,
  snapTimelineMinutes,
} from "../../src/lib/engines/timelineDragEngine.js";
import { matchdayFixtureToAnnualBooking } from "../../src/lib/planning/annualPlannerEngine.js";

const pitches = [
  { id: "P1", label: "Pitch 1", format: "11v11", surface: "grass" },
  { id: "P2", label: "Pitch 2", format: "11v11-small", surface: "grass" },
  { id: "P4", label: "Pitch 4", format: "11v11-youth", surface: "grass" },
  { id: "P5", label: "Pitch 5", format: "7v7", surface: "grass" },
];

const fixture = {
  id: "fixture-1",
  homeTeam: "U14 Spartans",
  awayTeam: "Visitors",
  pitchId: "P4",
  pitchLabel: "Pitch 4",
  koMins: 570,
  koTime: "09:30",
  endMins: 670,
  endTime: "11:10",
  format: "11v11-youth",
  cfg: { format: "11v11-youth", gameMins: 70, defaultPitch: "P4", altPitch: "P2" },
  status: "scheduled",
};

const club = {
  startTime: "08:30",
  endTime: "16:30",
  parkingEnabled: false,
};

describe("Ground Control Timeline v2 drag assurance", () => {
  it("snaps drag positions to five-minute intervals", () => {
    expect(snapTimelineMinutes(577)).toBe(575);
    expect(snapTimelineMinutes(578)).toBe(580);
  });

  it("blocks closed and unsuitable pitches before a move is applied", () => {
    expect(getTimelinePitchState({ pitch: pitches[2], fixture, closedPitches: ["P4"] })).toMatchObject({
      allowed: false,
      tone: "closed",
    });
    expect(getTimelinePitchState({ pitch: pitches[3], fixture, closedPitches: [] })).toMatchObject({
      allowed: false,
      tone: "unsuitable",
    });
  });

  it("ranks suitable pitches ahead of invalid targets", () => {
    const ranked = rankTimelinePitches({ pitchCfg: pitches, fixture, closedPitches: ["P4"], currentPitchId: "P4" });
    expect(ranked[0].state.allowed).toBe(true);
    expect(ranked.at(-1).state.allowed).toBe(false);
    expect(ranked.find((row) => row.pitch.id === "P4").state.tone).toBe("closed");
  });

  it("does not mark a drop onto the current pitch and slot as a change", () => {
    const candidate = buildTimelineMoveCandidate({
      fixtures: [fixture],
      fixtureIndex: 0,
      pitchCfg: pitches,
      closedPitches: [],
      club,
      pitchId: "P4",
      koMins: 570,
      start: 510,
      end: 990,
    });

    expect(candidate.noChange).toBe(true);
    expect(candidate.blocked).toBe(false);
  });

  it("builds a complete pitch and kick-off patch for a valid drop", () => {
    const candidate = buildTimelineMoveCandidate({
      fixtures: [fixture],
      fixtureIndex: 0,
      pitchCfg: pitches,
      closedPitches: [],
      club,
      pitchId: "P2",
      koMins: 603,
      start: 510,
      end: 990,
    });

    expect(candidate.ok).toBe(true);
    expect(candidate.blocked).toBe(false);
    expect(candidate.patch).toMatchObject({
      pitchId: "P2",
      koMins: 605,
      koTime: "10:05",
      endMins: 690,
      endTime: "11:30",
    });
    expect(candidate.previousPatch).toMatchObject({ pitchId: "P4", koMins: 570 });
  });

  it("ignores the selected fixture's own synced annual-planner booking", () => {
    const matchDate = "2026-09-05";
    const syncedBooking = matchdayFixtureToAnnualBooking(fixture, {
      date: matchDate,
      pitchCfg: pitches,
      sourceType: "matchday_saturday",
    });

    const candidate = buildTimelineMoveCandidate({
      fixtures: [fixture],
      fixtureIndex: 0,
      pitchCfg: pitches,
      closedPitches: [],
      club,
      pitchId: "P2",
      koMins: 570,
      start: 510,
      end: 990,
      matchDate,
      resourceBookings: [syncedBooking],
    });

    expect(candidate.ok).toBe(true);
    expect(candidate.blocked).toBe(false);
    expect(candidate.patch).toMatchObject({ pitchId: "P2", koMins: 570 });
  });

  it("uses a Full-Time source key when an imported fixture has no internal id", () => {
    const imported = { ...fixture, id: "", sourceFixtureKey: "2026-09-05|u14 spartans|visitors|09:30" };
    const matchDate = "2026-09-05";
    const syncedBooking = matchdayFixtureToAnnualBooking(imported, { date: matchDate, pitchCfg: pitches });
    const candidate = buildTimelineMoveCandidate({
      fixtures: [imported], fixtureIndex: 0, pitchCfg: pitches, closedPitches: [], club,
      pitchId: "P2", koMins: 570, start: 510, end: 990, matchDate, resourceBookings: [syncedBooking],
    });
    expect(candidate).toMatchObject({ ok: true, blocked: false });
  });

  it("blocks a drop that creates a same-pitch overlap", () => {
    const adultFixture = {
      ...fixture,
      id: "fixture-adult-1",
      homeTeam: "Open Age Reserves",
      pitchId: "P2",
      pitchLabel: "Pitch 2",
      format: "11v11",
      cfg: { format: "11v11", gameMins: 90, defaultPitch: "P2", altPitch: "P1" },
      koMins: 540,
      koTime: "09:00",
      endMins: 660,
      endTime: "11:00",
    };
    const other = {
      ...adultFixture,
      id: "fixture-adult-2",
      homeTeam: "Open Age Firsts",
      pitchId: "P1",
      pitchLabel: "Pitch 1",
      koMins: 600,
      koTime: "10:00",
      endMins: 720,
      endTime: "12:00",
    };

    const candidate = buildTimelineMoveCandidate({
      fixtures: [adultFixture, other],
      fixtureIndex: 0,
      pitchCfg: pitches,
      closedPitches: [],
      club,
      pitchId: "P1",
      koMins: 615,
      start: 510,
      end: 990,
    });

    expect(candidate.ok).toBe(false);
    expect(candidate.blocked).toBe(true);
    expect(candidate.type).toBe("pitch_clash");
    expect(candidate.timeSuggestions.length).toBeGreaterThan(0);
  });
});
