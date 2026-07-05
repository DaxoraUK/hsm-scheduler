import { describe, expect, test } from "vitest";
import { buildAnalyticsVisualisationModel } from "../../src/lib/engines/analyticsVisualisationEngine.js";
import { buildGrantImpactModel } from "../../src/lib/engines/grantImpactEngine.js";
import { buildReportsModel } from "../../src/lib/reports/reportingEngine.js";
import { buildReportCsv } from "../../src/lib/reports/csvExport.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

function savedMatchday(index = 0, fixtures = []) {
  const day = String(4 + index).padStart(2, "0");
  return {
    id: `saved-${index + 1}`,
    date: `2026-07-${day}`,
    dateLabel: `Saved matchday ${index + 1}`,
    savedAt: `2026-07-${day}T18:00:00.000Z`,
    parking: { enabled: true, capacity: 57, maxConcurrent: 3, avgCars: { "11v11": 30 } },
    fixtureDays: [{
      key: "saturday",
      label: "Saturday",
      date: `2026-07-${day}`,
      dateLabel: `Saturday ${day} July`,
      hasRun: true,
      scheduled: fixtures,
      postponed: [],
      cancelled: [],
      unresolved: [],
    }],
  };
}

describe("analytics evidence quality and grant support", () => {
  test("analytics exposes confidence gaps and fixture-level source records", () => {
    const history = [savedMatchday(0, [
      makeFixture({ id: "incomplete", pitchId: "", koMins: null, koTime: "", referee: "", refStatus: "" }),
    ])];
    const model = buildAnalyticsVisualisationModel({
      history,
      club: makeClub({ capacity: 0 }),
      pitchCfg: clonePitches(),
    });

    expect(model.quality.score).toBeLessThan(100);
    expect(model.quality.gaps.some((gap) => gap.id === "allocation-coverage")).toBe(true);
    expect(model.sourceRows).toHaveLength(1);
    expect(model.sourceRows[0].fixtureLabel).toContain("vs");
  });

  test("grant framework keeps inferred participation separate from manual evidence", () => {
    const history = [savedMatchday(0, [
      makeFixture({ id: "girls", homeTeam: "HSM U14 Girls", referee: "A Ref", refStatus: "confirmed" }),
    ])];
    const model = buildGrantImpactModel({
      history,
      club: makeClub(),
      pitchCfg: clonePitches(),
      teamCfg: [{ name: "HSM U14 Girls" }],
      refs: [{ name: "A Ref" }],
    });

    const inclusion = model.framework.requirements.find((item) => item.id === "inclusion-reach");
    const governance = model.framework.requirements.find((item) => item.id === "governance-documents");
    expect(inclusion.status).toBe("partial");
    expect(inclusion.source).toBe("inferred");
    expect(governance.status).toBe("manual");
    expect(model.framework.disclaimer).toContain("not a funder-specific eligibility assessment");
  });

  test("funding evidence reports include methodology, framework and a CSV matrix", () => {
    const model = buildReportsModel({
      reportType: "funding",
      current: {
        satFinal: [makeFixture({ id: "funding", referee: "A Ref", refStatus: "confirmed" })],
        satHasRun: true,
        satDate: "2026-07-04",
        satDateLabel: "Saturday 4 July",
        midweekEnabled: false,
      },
      club: makeClub(),
      pitchCfg: clonePitches(),
      refs: [{ name: "A Ref" }],
    });
    const csv = buildReportCsv(model);

    expect(model.quality.methodology).toContain("not a funding eligibility score");
    expect(model.grantFramework.requirements.length).toBeGreaterThan(8);
    expect(csv).toContain("Requirement");
    expect(csv).toContain("governance");
  });

  test("grant analytics period filters use only the selected recent matchdays", () => {
    const history = Array.from({ length: 6 }, (_, index) => savedMatchday(index, [makeFixture({ id: `f-${index}` })]));
    const model = buildGrantImpactModel({
      history,
      club: makeClub(),
      pitchCfg: clonePitches(),
      period: "last-4",
    });

    expect(model.evidence.recordedWeeks).toBe(4);
    expect(model.metrics.deliveredFixtures).toBe(4);
  });
});
