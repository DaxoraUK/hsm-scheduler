import { describe, expect, it } from "vitest";
import {
  postponeFixture,
  restoreFixture,
} from "../../src/lib/domain/fixtureLifecycle.js";
import { applyFixtureOverrides } from "../../src/lib/domain/fixtureVenueFlow.js";

const fixture = {
  id: "fixture-1",
  date: "2026-09-05",
  pitchId: "P1",
  pitchLabel: "Pitch 1",
  koMins: 600,
  koTime: "10:00",
  status: "active",
};

describe("fixture postponement lifecycle", () => {
  it("requires a recognised reason and retains the original allocation", () => {
    expect(() => postponeFixture(fixture, { reason: "" })).toThrow(/reason/i);
    const result = postponeFixture(fixture, {
      reason: "weather",
      note: "Standing water",
      actor: "Club owner",
      now: "2026-09-04T18:00:00.000Z",
    });

    expect(result).toMatchObject({ status: "postponed" });
    expect(result.postponement).toMatchObject({
      reason: "weather",
      note: "Standing water",
      actor: "Club owner",
      recordedAt: "2026-09-04T18:00:00.000Z",
      originalDate: "2026-09-05",
      originalPitchId: "P1",
      originalPitchLabel: "Pitch 1",
      originalKoMins: 600,
      originalKoTime: "10:00",
    });
  });

  it("restores the original allocation without deleting postponement history", () => {
    const postponed = postponeFixture(fixture, { reason: "weather", now: "2026-09-04T18:00:00.000Z" });
    const restored = restoreFixture(postponed, { actor: "Club owner", now: "2026-09-05T07:00:00.000Z" });

    expect(restored).toMatchObject({ status: "active", pitchId: "P1", koMins: 600 });
    expect(restored.postponement).toMatchObject({ restoredAt: "2026-09-05T07:00:00.000Z", restoredBy: "Club owner" });
  });

  it("does not fan one stable override out to duplicate records", () => {
    const rows = [
      { ...fixture, id: "fixture-a", sourceFixtureKey: "source-duplicate", status: "active" },
      { ...fixture, id: "fixture-b", sourceFixtureKey: "source-duplicate", status: "active", koTime: "10:15", koMins: 615 },
    ];

    const result = applyFixtureOverrides(rows, {
      0: { fixtureIdentity: "source-duplicate", status: "postponed" },
    });

    expect(result[0].status).toBe("postponed");
    expect(result[1].status).toBe("active");
  });
});
