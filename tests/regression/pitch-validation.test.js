import { describe, expect, test } from "vitest";
import { isPitchSuitableForFixture } from "../../src/lib/intelligence/pitch/pitchService.js";
import { validateFixtureUpdate } from "../../src/lib/engines/validationEngine.js";
import { getKickOffRuleFailure } from "../../src/lib/intelligence/scheduling/kickOffRules.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

describe("pitch and operational validation", () => {
  test("adult fixtures are only offered configured adult-compatible pitches", () => {
    const pitches = clonePitches();
    const adult = makeFixture();

    expect(isPitchSuitableForFixture(pitches.find((pitch) => pitch.id === "P1"), adult)).toBe(true);
    expect(isPitchSuitableForFixture(pitches.find((pitch) => pitch.id === "P2"), adult)).toBe(true);
    expect(isPitchSuitableForFixture(pitches.find((pitch) => pitch.id === "P4"), adult)).toBe(false);
  });

  test("a closed pitch cannot be assigned manually", () => {
    const fixtures = [makeFixture({ pitchId: "P1" })];
    const result = validateFixtureUpdate({
      fixtures,
      fixtureIndex: 0,
      patch: { pitchId: "P2", pitchLabel: "Pitch 2" },
      pitchCfg: clonePitches(),
      closedPitches: ["P2"],
      club: makeClub({ parkingEnabled: false }),
      changeType: "schedule",
    });

    expect(result.ok).toBe(false);
    expect(result.type).toBe("pitch_closed");
  });

  test("parent and inner pitches cannot overlap", () => {
    const parent = makeFixture({ id: "parent", pitchId: "P1", koTime: "09:00", koMins: 540 });
    const inner = makeFixture({
      id: "inner",
      homeTeam: "U12 Eagles",
      format: "9v9",
      pitchId: "P1a",
      koTime: "11:30",
      koMins: 690,
      gameMins: 60,
      bufferMins: 15,
      extra: {
        cfg: {
          name: "U12 Eagles",
          format: "9v9",
          gameMins: 60,
          ageOrder: 5,
          defaultPitch: "P1a",
        },
      },
    });

    const result = validateFixtureUpdate({
      fixtures: [parent, inner],
      fixtureIndex: 1,
      patch: { koTime: "10:00", koMins: 600, endMins: 675 },
      pitchCfg: clonePitches(),
      closedPitches: [],
      club: makeClub({ parkingEnabled: false }),
      changeType: "schedule",
    });

    expect(result.ok).toBe(false);
    expect(result.type).toBe("pitch_clash");
  });

  test("youth fixtures are blocked after the configured youth window", () => {
    const youth = makeFixture({
      homeTeam: "U14 Spartans",
      format: "11v11-youth",
      pitchId: "P4",
      gameMins: 70,
      bufferMins: 30,
      extra: { cfg: { name: "U14 Spartans", format: "11v11-youth", ageOrder: 7, gameMins: 70 } },
    });
    const failure = getKickOffRuleFailure({
      fixture: youth,
      koTime: "11:45",
      club: { timingSettings: { earliestKickOff: "08:30", latestYouthKickOff: "11:30" } },
    });

    expect(failure?.type).toBe("kickoff_rule");
    expect(failure?.title).toContain("youth window");
  });

  test("postponed fixtures can be updated without generating operational clashes", () => {
    const fixtures = [makeFixture({ status: "postponed" })];
    const result = validateFixtureUpdate({
      fixtures,
      fixtureIndex: 0,
      patch: { pitchId: "missing", koTime: "05:00" },
      pitchCfg: clonePitches(),
      closedPitches: ["missing"],
      club: makeClub(),
      changeType: "schedule",
    });

    expect(result).toEqual({ ok: true, type: "valid" });
  });
});
