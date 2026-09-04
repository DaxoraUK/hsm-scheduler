import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { shouldCheckMatchweekApproval } from "../../src/hooks/useWeekPersistence.js";

describe("schedule publication authority and derived-state boundary", () => {
  test("never creates a schedule-specific Elite approval request for an authorised role", () => {
    ["owner", "admin", "scheduler", "fixture officer", "operations officer"].forEach((workspaceRole) => {
      expect(shouldCheckMatchweekApproval({
        activeClubId: "club-1",
        workspaceRole,
        subscription: { plan: "elite" },
      })).toBe(false);
    });
  });

  test("retains the explicit canPublish boundary and removes only matchweek approval creation", () => {
    const persistence = readFileSync("src/hooks/useWeekPersistence.js", "utf8");

    expect(persistence).toContain("if (!canPublish)");
    expect(persistence).not.toContain("createEliteApprovalRequest");
    expect(persistence).not.toContain("ELITE_APPROVAL_TYPES.MATCHWEEK");
  });

  test("treats history as evidence rather than live generated schedule input", () => {
    const appCore = readFileSync("src/AppCore.jsx", "utf8");

    expect(appCore).not.toContain("setSatScheduled(deduplicateFixtureSet(saturday.fixtures))");
    expect(appCore).not.toContain("setSunScheduled(deduplicateFixtureSet(sunday.fixtures))");
    expect(appCore).not.toContain("setMidweekScheduled(deduplicateFixtureSet(midweek.fixtures))");
  });
});
