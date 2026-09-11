import { expect, test } from "vitest";
import { prepareMatchdayCommit, selectHydratedMatchday } from "../../src/lib/domain/matchdayCommit.js";

test("cloud revision takes precedence over obsolete club JSON, including empty intent", () => {
  expect(selectHydratedMatchday({ revision: 2, intents: {}, manual_fixtures: [] }, { old: { allocation: { koTime: "10:45" } } }).intents).toEqual({});
});

test("a save produces canonical operational evidence without turning generated allocations into locks", () => {
  const fx = { canonicalFixtureIdentity: "url:one", pitchId: "P1", koTime: "08:05", koMins: 485, endMins: 560, format: "11v11", status: "active" };
  const result = prepareMatchdayCommit({ scope: "saturday", date: "2026-09-05", build: { safe: true, scheduled: [fx], unresolved: [], away: [] }, intents: {}, pitchCfg: [{ id: "P1", format: "11v11" }] });
  expect(result.intents).toEqual({});
  expect(result.evidence.fixtureDays[0].scheduled).toEqual([fx]);
  expect(result.evidence.canonicalIdentities).toEqual(["url:one"]);
});

test("an invalid final pitch allocation cannot be persisted as a successful save", () => {
  expect(() => prepareMatchdayCommit({ scope: "saturday", date: "2026-09-05", build: { safe: true, scheduled: [{ canonicalFixtureIdentity: "url:one", pitchId: "P1", koMins: 485, format: "9v9", status: "active" }], unresolved: [] }, pitchCfg: [{ id: "P1", format: "5v5" }] })).toThrow(/pitch_unsuitable/);
});

test("manual resolution cannot succeed when the requested identity remains unresolved", () => {
  expect(() => prepareMatchdayCommit({ scope: "saturday", date: "2026-09-05", build: { safe: true, scheduled: [], unresolved: [{ canonicalFixtureIdentity: "url:crusaders" }] }, intents: { "url:crusaders": { allocation: { mode: "locked", pitchId: "P2", koTime: "08:45" } } }, changedIdentities: ["url:crusaders"] })).toThrow(/allocation/);
});
