import { expect, test } from "vitest";
import { scheduleSat } from "../../src/lib/scheduler.js";
import { buildSchedulingState, materialiseEffectiveFixtures, mergeFixtureIntent, mergeFixtureAllocationBatch } from "../../src/lib/domain/schedulingState.js";
import { createScheduleTransaction, appendScheduleMutation, getProposedSchedule, getScheduleTransactionPatches, undoScheduleMutation, redoScheduleMutation, discardScheduleTransaction, validateProposedSchedule } from "../../src/lib/domain/scheduleTransaction.js";
import { prepareMatchdayCommit, selectHydratedMatchday } from "../../src/lib/domain/matchdayCommit.js";
import { buildReportsModel } from "../../src/lib/reports/reportingEngine.js";
import { findEffectiveAllocationConflicts } from "../../src/lib/domain/allocationConflicts.js";

test("Calendar batch, saved evidence, reversal, exclusion and ten rebuilds retain the same canonical day", () => {
  const date = "2026-09-05";
  const pitches = ["P1", "P2", "P3"].map((id) => ({ id, label: id, format: "7v7" }));
  const teams = ["A U10", "B U10", "C U10"].map((name, index) => ({ name, format: "7v7", teamType: "youth", defaultPitch: `P${index + 1}`, gameMins: 50, ageOrder: index }));
  const sources = [
    { canonicalFixtureIdentity: "url:a", homeTeam: "A U10", awayTeam: "Visitors", status: "active" },
    { canonicalFixtureIdentity: "url:b", homeTeam: "B U10", awayTeam: "Visitors", status: "active" },
    { canonicalFixtureIdentity: "url:c", homeTeam: "Visitors", awayTeam: "C U10", status: "away", venueRole: "away", isAwayFixture: true, requiresScheduling: false },
  ].map((fixture) => ({ ...fixture, date, sourceId: "one-shared-provider-feed" }));
  const scheduler = (fixtures) => scheduleSat(fixtures, false, [], teams, { "7v7": 15 }, 480, 900, pitches, 3);
  const build = (intents) => buildSchedulingState({ providerFixtures: sources, intents, scheduler });
  const initial = build({});
  let batch = createScheduleTransaction({ baseFixtures: initial.scheduled });
  batch = appendScheduleMutation(batch, { fixtureIdentity: "url:a", patch: { pitchId: "P3", koTime: "08:05" } });
  batch = appendScheduleMutation(batch, { fixtureIdentity: "url:b", patch: { pitchId: "P1", koTime: "08:05" } });
  expect(validateProposedSchedule({ fixtures: getProposedSchedule(batch), pitchCfg: pitches })).toEqual({ blocking: [], provisional: [] });
  batch = appendScheduleMutation(batch, { fixtureIdentity: "url:a", patch: { koTime: "08:10" } });
  expect(getProposedSchedule(undoScheduleMutation(batch)).find((f) => f.canonicalFixtureIdentity === "url:a").koMins).toBe(485);
  batch = redoScheduleMutation(undoScheduleMutation(batch));
  expect(getProposedSchedule(batch).find((f) => f.canonicalFixtureIdentity === "url:a").koMins).toBe(490);
  expect(getProposedSchedule(discardScheduleTransaction(batch))).toEqual(initial.scheduled);
  let intents = mergeFixtureAllocationBatch({}, getScheduleTransactionPatches(batch));
  intents = mergeFixtureIntent(intents, "url:c", { venue: { role: "home" }, allocation: { mode: "locked", pitchId: "P2", koTime: "09:55" }, official: { referee: "QA Official", officialSource: "club", refStatus: "confirmed" } });
  const history = [];
  function save(current) {
    const prepared = prepareMatchdayCommit({ scope: "saturday", date, build: build(current), intents: current, pitchCfg: pitches });
    history.unshift({ ...prepared.evidence, id: `save-${history.length}`, savedAt: new Date(Date.UTC(2026, 8, 5, 12, history.length)).toISOString() });
    return selectHydratedMatchday(JSON.parse(JSON.stringify({ revision: history.length, intents: prepared.intents, manual_fixtures: [] }))).intents;
  }
  intents = save(intents);
  intents = mergeFixtureIntent(intents, "url:a", { allocation: { koTime: "08:35" } });
  intents = save(intents);
  expect(build(intents).scheduled.find((f) => f.canonicalFixtureIdentity === "url:a").koMins).toBe(515);
  const excluded = mergeFixtureIntent(intents, "url:b", { exclusion: { reason: "Incorrect fixture" } });
  save(excluded);
  let report = buildReportsModel({ scope: "saturday", reportType: "fixtures", selectedSource: history[0].id, history });
  expect(report.activeFixtures.map((f) => f.raw.canonicalFixtureIdentity).sort()).toEqual(["url:a", "url:c"]);
  intents = save(mergeFixtureIntent(excluded, "url:b", { exclusion: null }));
  for (let rebuild = 0; rebuild < 10; rebuild += 1) {
    intents = save(intents);
    const state = build(intents);
    expect(state.unresolved).toEqual([]);
    expect(findEffectiveAllocationConflicts({ fixtures: state.scheduled, pitchCfg: pitches })).toEqual([]);
    expect(state.scheduled.map((f) => [f.canonicalFixtureIdentity, f.pitchId, f.koMins]).sort()).toEqual([
      ["url:a", "P3", 515], ["url:b", "P1", 485], ["url:c", "P2", 595],
    ]);
    expect(state.scheduled.find((f) => f.canonicalFixtureIdentity === "url:c")).toMatchObject({ referee: "QA Official", refStatus: "confirmed", isAwayFixture: false });
    expect(materialiseEffectiveFixtures({ providerFixtures: sources, intents }).fixtures).toHaveLength(3);
  }
  report = buildReportsModel({ scope: "saturday", reportType: "fixtures", selectedSource: history[0].id, history });
  expect(report.activeFixtures.map((f) => f.raw.canonicalFixtureIdentity).sort()).toEqual(["url:a", "url:b", "url:c"]);
});
