import { describe, expect, test } from "vitest";
import { calculateOfficialsReadiness, findOfficialConflicts, getOfficialAssignmentState, getOfficialDisplayName } from "../../src/lib/engines/officialsEngine.js";
import { getRefereeStats } from "../../src/lib/dashboardStats.js";
import { buildOperationsCentreSnapshot } from "../../src/lib/engines/operationsCentreEngine.js";
import { calculateOperationsIntelligence } from "../../src/lib/engines/operationsIntelligenceEngine.js";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";

const leagueAppointedFixture = {
  id: "fixture-1",
  homeTeam: "U8 Sharks",
  awayTeam: "Westhoughton Juniors U8",
  koTime: "09:00",
  durationMins: 50,
  pitchId: "P4a",
  referee: "",
  refStatus: "Confirmed",
};

describe("league-appointed officials flow", () => {
  test.each([
    { status: "away" }, { isAwayFixture: true }, { venueRole: "away" }, { requiresScheduling: false },
    { status: "postponed" }, { status: "cancelled" }, { status: "Cancelled" },
  ])("does not require local referee confirmation for excluded fixture %j", (excluded) => {
    const fixtures = [
      leagueAppointedFixture,
      { ...leagueAppointedFixture, id: "excluded", refStatus: "TBC", ...excluded },
    ];
    expect(getRefereeStats({ fixtures })).toMatchObject({ total: 1, confirmed: 1, outstanding: 0, pct: 100 });
    expect(calculateOfficialsReadiness({ fixtures, active: fixtures }).metrics).toMatchObject({ confirmed: 1, missing: 0, fixtures: 1 });
  });

  test("excluded fixtures cannot create official clashes, while active Home games still require confirmation", () => {
    const home = { ...leagueAppointedFixture, referee: "A Ref" };
    const away = { ...home, id: "away", isAwayFixture: true };
    const cancelled = { ...home, id: "cancelled", status: "cancelled" };
    expect(findOfficialConflicts([home, away, cancelled])).toEqual([]);
    expect(getRefereeStats({ fixtures: [{ ...home, refStatus: "TBC" }] })).toMatchObject({ total: 1, outstanding: 1 });
    expect(getRefereeStats({ fixtures: [{ ...away, isAwayFixture: false, venueRole: "home", requiresScheduling: true }] })).toMatchObject({ total: 1, confirmed: 1 });
  });

  test("treats a confirmed league appointment as covered before the official name is supplied", () => {
    expect(getOfficialAssignmentState(leagueAppointedFixture)).toBe("confirmed");
    expect(getOfficialDisplayName(leagueAppointedFixture)).toBe("League-appointed official");
    const readiness = calculateOfficialsReadiness({ fixtures: [leagueAppointedFixture] });
    expect(readiness.metrics).toMatchObject({ assigned: 1, confirmed: 1, missing: 0, coverage: 100, confirmationRate: 100 });
    expect(readiness.missingFixtures).toHaveLength(0);
  });

  test("uses the same confirmed count throughout the operational flow", () => {
    expect(getRefereeStats({ fixtures: [leagueAppointedFixture] })).toMatchObject({ confirmed: 1, outstanding: 0, pct: 100 });
    const snapshot = buildOperationsCentreSnapshot({ fixtures: [leagueAppointedFixture], scheduleBuilt: true, pitchCfg: [{ id: "P4a", name: "Pitch 4a" }] });
    expect(snapshot.domains.find((domain) => domain.id === "officials")?.data.metrics).toMatchObject({ confirmed: 1, missing: 0 });
    expect(snapshot.waves[0].officialsOutstanding).toBe(0);
    expect(snapshot.waves[0].fixtures[0].official).toBe("League-appointed official");
    const intelligence = calculateOperationsIntelligence({ fixtures: [leagueAppointedFixture], hasRun: true });
    expect(intelligence.insights.some((insight) => insight.id === "officials-pressure")).toBe(false);
    const communications = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg: [{ name: "U8 Sharks", managerName: "Coach", managerEmail: "coach@example.org", communicationChannel: "email" }],
      satFinal: [leagueAppointedFixture],
      satHasRun: true,
      midweekEnabled: false,
    });
    expect(communications.rows[0].referee).toBe("League-appointed official");
    expect(communications.rows[0].issues).not.toContain("Official not assigned");
  });
});
