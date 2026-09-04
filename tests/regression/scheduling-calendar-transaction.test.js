import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import * as schedulingState from "../../src/lib/domain/schedulingState.js";

const pitchCfg = [
  { id: "P1", label: "Pitch 1", format: "7v7" },
  { id: "P2", label: "Pitch 2", format: "7v7" },
  { id: "P3", label: "Pitch 3", format: "7v7" },
];
const timing = { youthTurnaroundMins: 15 };

function fixture(identity, pitchId) {
  return {
    canonicalFixtureIdentity: identity,
    homeTeam: `HSM ${identity}`,
    awayTeam: "Visitors",
    pitchId,
    pitchLabel: pitchId,
    koTime: "10:00",
    koMins: 600,
    endMins: 675,
    gameMins: 60,
    format: "7v7",
    status: "active",
    requiresScheduling: true,
  };
}

const fixtureA = fixture("url:fixture-a", "P1");
const fixtureB = fixture("url:fixture-b", "P2");
const fixtureC = fixture("url:fixture-c", "P3");

describe("canonical Calendar schedule transactions", () => {
  test("projects ordered pending moves without cloning canonical fixtures", () => {
    expect(schedulingState).toMatchObject({
      createScheduleTransaction: expect.any(Function),
      appendScheduleMutation: expect.any(Function),
      getProposedSchedule: expect.any(Function),
      validateProposedSchedule: expect.any(Function),
    });

    let transaction = schedulingState.createScheduleTransaction({
      baseFixtures: [fixtureA, fixtureB, fixtureC],
      timing,
    });
    transaction = schedulingState.appendScheduleMutation(transaction, {
      fixtureIdentity: fixtureA.canonicalFixtureIdentity,
      patch: { pitchId: "P3", pitchLabel: "P3", koTime: "10:00", koMins: 600 },
    });

    const afterA = schedulingState.getProposedSchedule(transaction);
    expect(afterA.map((item) => item.canonicalFixtureIdentity)).toEqual([
      fixtureA.canonicalFixtureIdentity,
      fixtureB.canonicalFixtureIdentity,
      fixtureC.canonicalFixtureIdentity,
    ]);
    expect(afterA.find((item) => item.canonicalFixtureIdentity === fixtureA.canonicalFixtureIdentity)?.pitchId).toBe("P3");
    expect(schedulingState.validateProposedSchedule({
      fixtures: afterA,
      pitchCfg,
      timing,
      mutatedFixtureIdentities: [fixtureA.canonicalFixtureIdentity],
    })).toMatchObject({ blocking: [], provisional: [expect.objectContaining({ type: "pitch_clash" })] });

    transaction = schedulingState.appendScheduleMutation(transaction, {
      fixtureIdentity: fixtureB.canonicalFixtureIdentity,
      patch: { pitchId: "P1", pitchLabel: "P1", koTime: "10:00", koMins: 600 },
    });
    transaction = schedulingState.appendScheduleMutation(transaction, {
      fixtureIdentity: fixtureC.canonicalFixtureIdentity,
      patch: { pitchId: "P2", pitchLabel: "P2", koTime: "10:00", koMins: 600 },
    });

    const finalSchedule = schedulingState.getProposedSchedule(transaction);
    expect(finalSchedule.map((item) => item.pitchId)).toEqual(["P3", "P1", "P2"]);
    expect(schedulingState.validateProposedSchedule({
      fixtures: finalSchedule,
      pitchCfg,
      timing,
      mutatedFixtureIdentities: finalSchedule.map((item) => item.canonicalFixtureIdentity),
    })).toEqual({ blocking: [], provisional: [] });
  });

  test("undo redo and discard reconstruct deterministic proposed schedules", () => {
    expect(schedulingState).toMatchObject({
      undoScheduleMutation: expect.any(Function),
      redoScheduleMutation: expect.any(Function),
      discardScheduleTransaction: expect.any(Function),
      getScheduleTransactionPatches: expect.any(Function),
    });

    let transaction = schedulingState.createScheduleTransaction({
      baseFixtures: [fixtureA, fixtureB],
      timing,
    });
    transaction = schedulingState.appendScheduleMutation(transaction, {
      fixtureIdentity: fixtureA.canonicalFixtureIdentity,
      patch: { pitchId: "P2", koTime: "10:00", koMins: 600 },
    });
    transaction = schedulingState.appendScheduleMutation(transaction, {
      fixtureIdentity: fixtureB.canonicalFixtureIdentity,
      patch: { pitchId: "P1", koTime: "10:00", koMins: 600 },
    });

    expect(schedulingState.getProposedSchedule(schedulingState.undoScheduleMutation(transaction)).map((item) => item.pitchId))
      .toEqual(["P2", "P2"]);
    expect(schedulingState.getProposedSchedule(schedulingState.redoScheduleMutation(schedulingState.undoScheduleMutation(transaction))).map((item) => item.pitchId))
      .toEqual(["P2", "P1"]);
    expect(schedulingState.getScheduleTransactionPatches(transaction)).toEqual({
      [fixtureA.canonicalFixtureIdentity]: expect.objectContaining({ pitchId: "P2", koMins: 600 }),
      [fixtureB.canonicalFixtureIdentity]: expect.objectContaining({ pitchId: "P1", koMins: 600 }),
    });
    expect(schedulingState.getProposedSchedule(schedulingState.discardScheduleTransaction(transaction))).toEqual([
      fixtureA,
      fixtureB,
    ]);
  });

  test("turns the final transaction state into one locked canonical intent per fixture", () => {
    expect(schedulingState).toMatchObject({
      mergeFixtureAllocationBatch: expect.any(Function),
    });

    const nextIntents = schedulingState.mergeFixtureAllocationBatch({
      [fixtureA.canonicalFixtureIdentity]: { venue: { role: "home" }, official: { referee: "Canonical Ref" } },
    }, {
      [fixtureA.canonicalFixtureIdentity]: { pitchId: "P3", pitchLabel: "Pitch 3", koTime: "10:00", koMins: 600, endMins: 675 },
      [fixtureB.canonicalFixtureIdentity]: { pitchId: "P1", pitchLabel: "Pitch 1", koTime: "10:00", koMins: 600, endMins: 675 },
    });

    expect(nextIntents).toMatchObject({
      [fixtureA.canonicalFixtureIdentity]: expect.objectContaining({
        venue: { role: "home" },
        official: { referee: "Canonical Ref" },
        allocation: expect.objectContaining({ mode: "locked", pitchId: "P3", koMins: 600 }),
      }),
      [fixtureB.canonicalFixtureIdentity]: expect.objectContaining({
        allocation: expect.objectContaining({ mode: "locked", pitchId: "P1", koMins: 600 }),
      }),
    });
  });

  test("stages Calendar moves and commits the final canonical batch once", () => {
    const matchdayPage = readFileSync("src/pages/MatchdayPage.jsx", "utf8");
    const appCore = readFileSync("src/AppCore.jsx", "utf8");

    expect(matchdayPage).toContain("createScheduleTransaction");
    expect(matchdayPage).toContain("commitScheduleTransaction");
    expect(matchdayPage).not.toContain("editableOverride(candidate.fixture, candidate.patch)");
    expect(appCore).toContain("commitFixtureIntentBatch");
    expect(appCore).toContain("mergeFixtureAllocationBatch");
    expect(appCore).toContain("const currentIntents = scope === \"sunday\"");
    expect(appCore).not.toContain("let nextIntents = null");
  });
});
