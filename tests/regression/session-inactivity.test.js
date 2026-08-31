import { describe, expect, it } from "vitest";
import {
  INACTIVITY_LOGOUT_MS,
  INACTIVITY_WARNING_MS,
  getInactivityState,
} from "../../src/lib/security/inactivityPolicy.js";

describe("secure session inactivity policy", () => {
  it("warns after 25 minutes and expires after 30 minutes", () => {
    const startedAt = 1_000;
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_WARNING_MS - 1).status).toBe("active");
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_WARNING_MS)).toMatchObject({ status: "warning", remainingMs: 5 * 60 * 1000 });
    expect(getInactivityState(startedAt, startedAt + INACTIVITY_LOGOUT_MS).status).toBe("expired");
  });
});
