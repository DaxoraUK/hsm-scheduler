import { describe, expect, test } from "vitest";
import { shouldCheckMatchweekApproval } from "../../src/hooks/useWeekPersistence.js";

describe("scheduler matchweek publishing", () => {
  test("does not create a separate approval request for an authorised scheduler", () => {
    const elite = { features: ["approval_workflows"] };
    expect(shouldCheckMatchweekApproval({ subscription: elite, activeClubId: "club-1", workspaceRole: "scheduler" })).toBe(false);
  });

  test("allows other authorised scheduling roles to publish without a matchweek approval request", () => {
    const elite = { features: ["approval_workflows"] };
    expect(shouldCheckMatchweekApproval({ subscription: elite, activeClubId: "club-1", workspaceRole: "admin" })).toBe(false);
  });
});
