import { describe, expect, test } from "vitest";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import { reverseAwayFixture } from "../../src/lib/domain/fixtureVenueFlow.js";

function game(name, sourceFixtureKey, extra = {}) {
  return {
    sourceId: "BBDFL", sourceFixtureKey,
    homeTeam: name, awayTeam: "Visitors", date: "2026-10-10",
    status: "active", venueRole: "home", isAwayFixture: false, requiresScheduling: true,
    koTime: "09:00", pitchId: "P2", format: "9v9", referee: "A Ref", refStatus: "Confirmed",
    ...extra,
  };
}

describe("communications fixture identity", () => {
  test.each(["sat", "sun", "midweek"])("keeps every game from the same feed in the %s message queue", (prefix) => {
    const model = buildCommunicationsModel({
      [`${prefix}HasRun`]: true,
      [`${prefix}Final`]: [
        game("Knights", "feed:knights"), game("Cobras", "feed:cobras"),
        game("Vulcans", "feed:vulcans", { status: "postponed" }),
        game("Crusaders", "feed:crusaders", { status: "cancelled" }),
        game("Reserves", "lal:reserves", { id: "reserves", sourceId: "LAL" }),
      ],
    });
    expect(model.rows.map((row) => row.teamName)).toEqual(["Knights", "Cobras", "Vulcans", "Crusaders", "Reserves"]);
    expect(model.counts).toMatchObject({ total: 5, exceptionUpdates: 2 });
  });

  test("provider URLs take precedence over shared source IDs and generated fixture numbers", () => {
    const model = buildCommunicationsModel({ satHasRun: true, satFinal: [
      game("Knights", "legacy", { id: "1", sourceFixtureUrl: "https://fulltime.thefa.com/fixture.html?id=101" }),
      game("Knights", "legacy", { id: "1", sourceFixtureUrl: "https://fulltime.thefa.com/fixture.html?id=102" }),
    ] });
    expect(model.rows).toHaveLength(2);
    expect(new Set(model.rows.map((row) => row.id)).size).toBe(2);
  });

  test("only the same canonical game is reconciled across scheduled and unresolved collections", () => {
    const first = game("Knights", "feed:first");
    const second = game("Knights", "feed:second");
    const model = buildCommunicationsModel({ satHasRun: true, satFinal: [first, second], satUnresolved: [first] });
    expect(model.rows).toHaveLength(2);
    expect(model.rows.map((row) => row.status)).toEqual(["unresolved", "scheduled"]);
  });

  test("allocation and Away-to-Home edits do not change the queue identity", () => {
    const fixture = game("Visitors", "feed:reversed", { awayTeam: "Knights", isAwayFixture: true, venueRole: "away", requiresScheduling: false });
    const reversed = { ...reverseAwayFixture(fixture), pitchId: "P1", koTime: "11:00" };
    const after = buildCommunicationsModel({ satHasRun: true, satFinal: [reversed] }).rows[0];
    expect(after.id).toBe("saturday:feed:reversed");
    const reallocated = buildCommunicationsModel({ satHasRun: true, satFinal: [{ ...reversed, pitchId: "P2", koTime: "12:00" }] }).rows[0];
    expect(reallocated.id).toBe(after.id);
    expect(after.teamName).toBe("Knights");
    expect(after.message).toContain("at home");
  });

  test.each(["away", "postponed", "cancelled"])("Away %s fixtures are excluded from the operational message queue", (status) => {
    const fixture = game("Visitors", "feed:away", {
      awayTeam: "Knights", clubTeamName: "Knights", status, isAwayFixture: true,
      venueRole: "away", requiresScheduling: false, pitchId: "", pitchLabel: "Away", venue: "Visitors Ground", referee: "", refStatus: "TBC",
    });
    const model = buildCommunicationsModel({ satHasRun: true, satFinal: [fixture],
      teamCfg: [{ id: "knights", name: "Knights", managerName: "Club Coach", managerEmail: "coach@example.org", communicationChannel: "email" }],
    });
    expect(model.rows).toEqual([]);
    expect(model.counts.total).toBe(0);
  });

  test("matches the exact team rather than the first partial name", () => {
    const model = buildCommunicationsModel({ satHasRun: true, satFinal: [game("HSM Reserves", "reserves")],
      teamCfg: [
        { id: "first", name: "HSM", managerEmail: "first@example.org", communicationChannel: "email" },
        { id: "reserves", name: "HSM Reserves", managerEmail: "reserves@example.org", communicationChannel: "email" },
      ],
    });
    expect(model.rows[0].recipients[0].destination).toBe("reserves@example.org");
  });

  test("does not guess a recipient when a shortened team name is ambiguous", () => {
    const model = buildCommunicationsModel({ satHasRun: true, satFinal: [game("Knights", "unknown")],
      teamCfg: [
        { id: "u14", name: "U14 Knights", managerEmail: "u14@example.org", communicationChannel: "email" },
        { id: "u15", name: "U15 Knights", managerEmail: "u15@example.org", communicationChannel: "email" },
      ],
    });
    expect(model.rows[0].recipients).toEqual([]);
    expect(model.rows[0].readyState).toBe("review");
  });

  test.each(["postponed", "cancelled"])("Home %s updates do not need pitch/time or referee confirmation", (status) => {
    const model = buildCommunicationsModel({ satHasRun: true,
      satFinal: [game("Knights", "inactive", { status, pitchId: "", koTime: "", referee: "", refStatus: "TBC" })],
      teamCfg: [{ id: "knights", name: "Knights", managerEmail: "coach@example.org", communicationChannel: "email" }],
    });
    expect(model.rows[0].readyState).toBe("ready");
    expect(model.rows[0].message).toContain(status);
    expect(model.rows[0].issues).toEqual([]);
  });
});
