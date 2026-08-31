import { describe, expect, it } from "vitest";
import {
  INACTIVITY_LOGOUT_MS,
  INACTIVITY_WARNING_MS,
  getInactivityState,
  parseActivity,
  serialiseActivity,
} from "../../src/lib/security/inactivityPolicy.js";

describe("secure session inactivity policy", () => {
  it("warns after 25 minutes and expires after 30 minutes", () => {
    const startedAt = 1_000;
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_WARNING_MS - 1).status).toBe("active");
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_WARNING_MS)).toMatchObject({ status: "warning", remainingMs: 5 * 60 * 1000 });
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_LOGOUT_MS).status).toBe("expired");
  });

  it("shares activity only for the same authenticated user", () => {
    const stored = serialiseActivity("user-1", 12345);
    expect(parseActivity(stored, "user-1")).toBe(12345);
    expect(parseActivity(stored, "user-2")).toBeNull();
  });
});
