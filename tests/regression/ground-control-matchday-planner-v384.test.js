import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPlannerChangeRecord,
  buildPlannerOverlayMetrics,
  buildPlannerPitchGroups,
  buildPlannerSlots,
  getPlannerCanvasWidth,
  getPlannerFixtureRisk,
  normalisePlannerTimeInput,
} from "../../src/lib/engines/matchdayPlannerEngine.js";

const plannerSource = readFileSync("src/components/Operations/shared/MatchdayTimelineCard.jsx", "utf8");
const matchdaySource = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

const fixture = {
  id: "fixture-1",
  homeTeam: "U14 Spartans",
  awayTeam: "Visitors",
  pitchId: "P4",
  pitchLabel: "Pitch 4",
  koMins: 570,
  koTime: "09:30",
  endMins: 660,
  endTime: "11:00",
  cars: 18,
  referee: "A Referee",
};

describe("Ground Control v3.8.4 Matchday Planner", () => {
  it("builds exact 15-minute planning slots and responsive zoom widths", () => {
    expect(buildPlannerSlots(510, 600).map((slot) => slot.label)).toEqual([
      "08:30",
      "08:45",
      "09:00",
      "09:15",
      "09:30",
      "09:45",
      "10:00",
    ]);
    expect(getPlannerCanvasWidth({ start: 510, end: 990, zoom: "fit", viewportWidth: 860 })).toBe(860);
    expect(getPlannerCanvasWidth({ start: 510, end: 990, zoom: "quarter" })).toBe(1536);
    expect(normalisePlannerTimeInput("10:07", 570)).toBe(600);
  });

  it("creates auditable change records for batch review, undo and redo", () => {
    const record = buildPlannerChangeRecord({
      fixture,
      fixtureIndex: 0,
      advisory: true,
      message: "Parking reaches 92% of capacity.",
      previousPatch: { pitchId: "P4", pitchLabel: "Pitch 4", koMins: 570, koTime: "09:30" },
      patch: { pitchId: "P2", pitchLabel: "Pitch 2", koMins: 600, koTime: "10:00" },
    });

    expect(record).toMatchObject({
      fixtureId: "fixture-1",
      fixtureIndex: 0,
      fixtureTitle: "U14 Spartans vs Visitors",
      changedPitch: true,
      changedTime: true,
      warning: "Parking reaches 92% of capacity.",
    });
    expect(record.summary).toContain("09:30 → 10:00");
    expect(record.summary).toContain("Pitch 4 → Pitch 2");
  });

  it("groups the pitch board in sporting format order and surfaces fixture risks", () => {
    const groups = buildPlannerPitchGroups([
      { pitch: { id: "P7", label: "Seven", format: "7v7" }, fixtures: [] },
      { pitch: { id: "P11", label: "Adult", format: "11v11" }, fixtures: [] },
      { pitch: { id: "PA", label: "Astro", format: "9v9", surface: "astro" }, fixtures: [] },
    ]);
    expect(groups.map((group) => group.id)).toEqual(["11v11", "7v7", "astro"]);
    expect(getPlannerFixtureRisk({ ...fixture, referee: "", usingFallback: true })).toMatchObject({
      severity: "danger",
      count: 2,
    });
  });

  it("builds parking, officials and warning overlay metrics from concurrent fixtures", () => {
    const metrics = buildPlannerOverlayMetrics({
      fixtures: [fixture, { ...fixture, id: "fixture-2", referee: "", cars: 25 }],
      club: { carCapacity: 40 },
      start: 570,
      end: 600,
    });
    expect(metrics[0]).toMatchObject({
      fixtureCount: 2,
      cars: 43,
      parkingPercent: 108,
      parkingTone: "danger",
      missingOfficials: 1,
    });
  });

  it("ships pointer-based movement, a pitch board, inline validation and draft history controls", () => {
    expect(plannerSource).toContain('window.addEventListener("pointermove"');
    expect(plannerSource).toContain("Pitch board");
    expect(plannerSource).toContain("Validate move");
    expect(plannerSource).toContain("Recommended alternatives");
    expect(plannerSource).toContain("Review changes");
    expect(plannerSource).toContain("Discard");
    expect(plannerSource).not.toContain("draggable={canEdit}");
    expect(matchdaySource).toContain("timelineRedoHistory");
    expect(matchdaySource).toContain("undoTimelineMove");
    expect(matchdaySource).toContain("discardTimelineChanges");
  });
});
