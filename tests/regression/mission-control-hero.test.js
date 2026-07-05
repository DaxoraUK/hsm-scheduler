import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  buildMissionControlWorkflow,
  getMissionState,
} from "../../src/lib/engines/workflowEngine.js";

const heroSource = readFileSync(
  new URL("../../src/components/dashboard/DashboardMissionHero.jsx", import.meta.url),
  "utf8"
);
const dashboardSource = readFileSync(
  new URL("../../src/pages/DashboardPage.jsx", import.meta.url),
  "utf8"
);

describe("Mission Control hero refinement", () => {
  test("labels current clock data separately from the selected matchday forecast", () => {
    expect(heroSource).toContain("Matchweek Status");
    expect(heroSource).toContain("forecast ·");
    expect(heroSource).not.toContain("Live Status");
    expect(heroSource).not.toContain('<CloudSun size={31}');
  });

  test("uses a clear single-line primary action and supporting secondary action", () => {
    expect(heroSource).toContain("whitespace-nowrap");
    expect(heroSource).toContain("matchweek checks complete");
    expect(heroSource).toContain("issueItems.slice(0, 3)");
  });

  test("passes operational issues and real forecast context into the hero", () => {
    expect(dashboardSource).toContain("heroIssues");
    expect(dashboardSource).toContain("heroWeather");
    expect(dashboardSource).toContain("weatherScopeLabel");
    expect(dashboardSource).toContain("weatherIntelligence.forecastAvailable");
    expect(dashboardSource).toContain("findOfficialConflicts");
  });

  test("official clashes keep Mission Control in an action-required state", () => {
    const state = getMissionState({
      scheduleBuilt: true,
      fixtureIssues: 0,
      refereeOutstanding: 0,
      officialConflicts: 2,
      parkingOverCapacity: false,
      communicationsReady: true,
    });

    expect(state.tone).toBe("warning");
    expect(state.label).toBe("Action Required");

    const workflow = buildMissionControlWorkflow({
      scheduleBuilt: true,
      totalFixtures: 10,
      pitchCount: 5,
      refereeOutstanding: 0,
      officialConflicts: 2,
      communicationsReady: true,
      blockerCount: 1,
    });

    const officials = workflow.steps.find((step) => step.key === "officials");
    expect(officials.status).toBe("warning");
    expect(officials.detail).toContain("2 overlapping official assignments");
  });
});
