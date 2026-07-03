import { describe, expect, test } from "vitest";

import {
  applyDisplayNameToSession,
  getSessionDisplayName,
  normaliseDisplayName,
  validateDisplayName,
} from "../../src/lib/profile/profileModel.js";
import {
  createPilotDraft,
  normalisePilotLaunchReadiness,
  PILOT_CHECKLIST_ITEMS,
  validatePilotDraft,
} from "../../src/lib/platform/pilotModel.js";


describe("account profile", () => {
  test("normalises and validates display names", () => {
    expect(normaliseDisplayName("  Andrew   Manville ")).toBe("Andrew Manville");
    expect(validateDisplayName("Andrew Manville")).toEqual({ displayName: "Andrew Manville", errors: [] });
    expect(validateDisplayName("A").errors[0]).toContain("at least two");
    expect(validateDisplayName("A".repeat(81)).errors[0]).toContain("80 characters");
  });

  test("updates the cached secure session without changing the sign-in identity", () => {
    const session = {
      access_token: "test-access-token",
      user: { id: "user-1", email: "andrew@example.test", user_metadata: { display_name: "andrew" } },
    };
    const updated = applyDisplayNameToSession(session, "Andrew Manville");

    expect(getSessionDisplayName(updated)).toBe("Andrew Manville");
    expect(updated.user.id).toBe("user-1");
    expect(updated.user.email).toBe("andrew@example.test");
    expect(session.user.user_metadata.display_name).toBe("andrew");
  });
});


describe("pilot and launch readiness model", () => {
  test("creates a complete false checklist for a new pilot", () => {
    const draft = createPilotDraft("club-1");
    expect(draft.clubId).toBe("club-1");
    expect(Object.keys(draft.checklist)).toHaveLength(PILOT_CHECKLIST_ITEMS.length);
    expect(Object.values(draft.checklist).every((value) => value === false)).toBe(true);
  });

  test("normalises launch gates, pilot progress and client error totals", () => {
    const payload = normalisePilotLaunchReadiness({
      gates: [
        { code: "a", title: "Gate A", status: "ready" },
        { code: "b", title: "Gate B", status: "blocked" },
      ],
      pilots: [{
        club_id: "club-1",
        club_name: "Pilot FC",
        stage: "live_pilot",
        health: "attention",
        checklist: { owner_confirmed: true, onboarding_complete: true },
      }],
      client_events: [{ id: "event-1", level: "error", category: "application_crash", message: "Boom" }],
      summary: { gate_total: 2, gate_ready: 1, gate_blocked: 1, pilot_total: 1, pilot_live: 1, open_client_errors: 1 },
    });

    expect(payload.summary.gatePercent).toBe(50);
    expect(payload.summary.pilotLive).toBe(1);
    expect(payload.pilots[0].checklistComplete).toBe(2);
    expect(payload.clientEvents[0].category).toBe("application_crash");
  });

  test("rejects invalid pilot dates and unsupported states", () => {
    expect(validatePilotDraft({
      clubId: "",
      stage: "unknown",
      health: "bad",
      targetStartDate: "2026-08-10",
      targetReviewDate: "2026-08-01",
    })).toHaveLength(4);
  });
});
