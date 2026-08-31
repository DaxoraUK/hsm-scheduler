import { describe, expect, test } from "vitest";
import {
  buildOperationalEvidence,
  normaliseSavedMatchday,
} from "../../src/lib/engines/operationalEvidenceEngine.js";
import { buildAnalyticsVisualisationModel } from "../../src/lib/engines/analyticsVisualisationEngine.js";
import { buildReportsModel } from "../../src/lib/reports/reportingEngine.js";
import { buildReportCsv, escapeCsv } from "../../src/lib/reports/csvExport.js";
import { captureWeatherSnapshots } from "../../src/hooks/useWeekPersistence.js";
import { REPORT_PRINT_STYLES } from "../../src/lib/reports/printLayout.js";
import { clonePitches, makeClub, makeFixture } from "./fixtures.js";

function savedEntry({
  id = "saved-1",
  date = "2026-07-04",
  capacity = 57,
  scheduled = [],
  postponed = [],
  cancelled = [],
  unresolved = [],
} = {}) {
  return {
    id,
    date,
    dateLabel: "Saturday 4 July 2026",
    savedAt: `${date}T14:00:00.000Z`,
    carParkSpaces: capacity,
    parking: {
      enabled: true,
      capacity,
      maxConcurrent: 3,
      pressureThresholdPct: 85,
      avgCars: { "11v11": 36, "9v9": 22 },
    },
    fixtureDays: [
      {
        key: "saturday",
        label: "Saturday",
        date,
        dateLabel: "Saturday 4 July",
        hasRun: true,
        scheduled,
        postponed,
        cancelled,
        unresolved,
      },
    ],
  };
}

function evidenceFor(entry, club = makeClub(), filters = {}) {
  return buildOperationalEvidence({
    entries: [normaliseSavedMatchday(entry)],
    scope: "matchweek",
    club,
    pitchCfg: clonePitches(),
    filters,
  });
}

describe("analytics and reports v1", () => {
  test("a fixture retained in scheduled and postponed collections is counted once as postponed", () => {
    const fixture = makeFixture({ id: "duplicate" });
    const evidence = evidenceFor(savedEntry({ scheduled: [fixture], postponed: [fixture] }));

    expect(evidence.rows).toHaveLength(1);
    expect(evidence.summary.total).toBe(1);
    expect(evidence.summary.delivered).toBe(0);
    expect(evidence.summary.postponed).toBe(1);
  });

  test("historical parking uses the capacity saved with that matchday", () => {
    const fixtures = [
      makeFixture({ id: "a", pitchId: "P1", carEstimate: 36 }),
      makeFixture({ id: "b", pitchId: "P2", carEstimate: 36 }),
    ];
    const evidence = evidenceFor(
      savedEntry({ capacity: 40, scheduled: fixtures }),
      makeClub({ capacity: 100 })
    );

    expect(evidence.weekly[0].parkingCapacity).toBe(40);
    expect(evidence.weekly[0].parkingPeak).toBe(72);
    expect(evidence.weekly[0].parkingOver).toBe(true);
  });

  test("historical car estimates use the assumptions saved with that matchday", () => {
    const entry = savedEntry({
      scheduled: [makeFixture({ id: "saved-assumption", carEstimate: undefined })],
    });
    entry.parking.avgCars["11v11"] = 49;
    const evidence = evidenceFor(entry, makeClub({ overrides: { avgCars: { "11v11": 12 } } }));

    expect(evidence.rows[0].estimatedCars).toBe(49);
    expect(evidence.weekly[0].parkingPeak).toBe(49);
  });

  test("analytics filters consistently limit team, pitch and format evidence", () => {
    const history = [savedEntry({
      scheduled: [
        makeFixture({ id: "adult", homeTeam: "HSM First", pitchId: "P1", format: "11v11" }),
        makeFixture({ id: "youth", homeTeam: "HSM U14", pitchId: "P2", format: "9v9" }),
      ],
    })];

    const model = buildAnalyticsVisualisationModel({
      history,
      club: makeClub(),
      pitchCfg: clonePitches(),
      team: "hsm u14",
      pitch: "P2",
      format: "9v9",
    });

    expect(model.summary.total).toBe(1);
    expect(model.teamPerformance).toHaveLength(1);
    expect(model.teamPerformance[0].label).toBe("HSM U14");
    expect(model.pitchUtilisation.filter((item) => item.total > 0)).toHaveLength(1);
    expect(model.formatDistribution[0].format).toBe("9v9");
  });

  test("reports include unresolved fixtures and unconfirmed officials as exceptions", () => {
    const current = {
      satFinal: [makeFixture({ id: "scheduled", referee: "A Ref", refStatus: "TBC" })],
      satUnresolved: [makeFixture({ id: "unresolved", pitchId: "", koMins: null, koTime: "" })],
      satHasRun: true,
      satDate: "2026-07-04",
      satDateLabel: "Saturday 4 July",
      midweekEnabled: false,
    };
    const model = buildReportsModel({
      selectedSource: "current",
      scope: "weekend",
      reportType: "exceptions",
      current,
      club: makeClub(),
      pitchCfg: clonePitches(),
    });

    expect(model.hasData).toBe(true);
    expect(model.evidence.summary.unresolved).toBe(1);
    expect(model.exceptions.some((issue) => issue.type === "unresolved")).toBe(true);
    expect(model.exceptions.some((issue) => issue.type === "official")).toBe(true);
    expect(model.readiness.status).not.toBe("success");
  });

  test("a saved report source is selected without leaking current-matchweek rows", () => {
    const history = [savedEntry({ id: "history-only", scheduled: [makeFixture({ id: "historic" })] })];
    const model = buildReportsModel({
      selectedSource: "history-only",
      history,
      current: {
        satFinal: [makeFixture({ id: "current-only", homeTeam: "Current team" })],
        satHasRun: true,
        satDate: "2026-07-11",
        midweekEnabled: false,
      },
      club: makeClub(),
      pitchCfg: clonePitches(),
    });

    expect(model.sourceKind).toBe("history");
    expect(model.fixtures).toHaveLength(1);
    expect(model.fixtures[0].raw.id).toBe("historic");
  });

  test("CSV output protects commas, quotes and line breaks", () => {
    expect(escapeCsv('Club, "A"')).toBe('"Club, ""A"""');
    const model = buildReportsModel({
      reportType: "fixtures",
      current: {
        satFinal: [makeFixture({ id: "csv", homeTeam: 'HSM, "First"' })],
        satHasRun: true,
        satDate: "2026-07-04",
        midweekEnabled: false,
      },
      club: makeClub(),
      pitchCfg: clonePitches(),
    });
    const csv = buildReportCsv(model);

    expect(csv).toContain('"HSM, ""First"""');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  test("fixture allocation print keeps every active fixture and uses a paginating layout", () => {
    const fixtures = Array.from({ length: 8 }, (_, index) => makeFixture({
      id: `fixture-${index + 1}`,
      homeTeam: `Team ${index + 1}`,
      koMins: 540 + index * 30,
    }));
    const model = buildReportsModel({
      reportType: "fixtures",
      scope: "saturday",
      current: {
        satFinal: [...fixtures, makeFixture({ id: "postponed", status: "postponed" })],
        satHasRun: true,
        satDate: "2026-09-05",
        midweekEnabled: false,
      },
      club: makeClub(),
      pitchCfg: clonePitches(),
    });

    expect(model.activeFixtures).toHaveLength(8);
    expect(REPORT_PRINT_STYLES).toContain("position: static");
    expect(REPORT_PRINT_STYLES).not.toContain("position: absolute");
  });

  test("publishing captures fixture weather exposure but never blocks a save when unavailable", async () => {
    const day = {
      key: "saturday",
      label: "Saturday",
      date: "2026-07-04",
      dateLabel: "Saturday 4 July",
      hasRun: true,
      scheduled: [makeFixture({ id: "weather-one", koMins: 9 * 60 })],
      postponed: [],
      cancelled: [],
    };
    const service = {
      getConfiguration: () => ({ enabled: true, postcode: "BL6 7QE" }),
      getForecast: async () => ({
        provider: "Test forecast",
        updatedAt: "2026-07-03T08:00:00.000Z",
        cacheStatus: "live",
        current: {
          temperatureC: 12,
          windMph: 32,
          rainProbability: 90,
          rainfallMm: 5,
          conditions: "Heavy rain",
        },
        hourly: [
          {
            time: "09:00",
            timeMins: 540,
            temperatureC: 12,
            windMph: 32,
            rainProbability: 90,
            rainfallMm: 5,
            conditions: "Heavy rain",
          },
        ],
      }),
    };

    const captured = await captureWeatherSnapshots([day], makeClub(), service);
    expect(captured[0].scheduled[0].weatherRisk).toBe("high");
    expect(captured[0].weatherSnapshot.provider).toBe("Test forecast");

    const failed = await captureWeatherSnapshots([day], makeClub(), {
      getConfiguration: service.getConfiguration,
      getForecast: async () => { throw new Error("provider unavailable"); },
    });
    expect(failed).toEqual([day]);
  });
});
