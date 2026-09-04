import { describe, expect, test } from "vitest";
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
});
