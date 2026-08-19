import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMatchdayTimeline } from "../../src/lib/engines/timelineEngine.js";
import { buildOperationsCentreSnapshot } from "../../src/lib/engines/operationsCentreEngine.js";

const operationsPage = readFileSync("src/pages/OperationsCentrePage.jsx", "utf8");
const timelineCard = readFileSync("src/components/Operations/shared/MatchdayTimelineCard.jsx", "utf8");

describe("Ground Control v3.8.5 planner density and live weather", () => {
  it("keeps non-overlapping fixtures on one visual lane even when cards need a minimum display width", () => {
    const timeline = buildMatchdayTimeline({
      games: [
        { id: "first", homeTeam: "U12 Tigers", awayTeam: "A", pitchId: "P1", koMins: 510, endMins: 570 },
        { id: "second", homeTeam: "U13 Vipers", awayTeam: "B", pitchId: "P1", koMins: 585, endMins: 645 },
      ],
      pitchCfg: [{ id: "P1", label: "Pitch 1a", format: "9v9" }],
      padRange: false,
    });

    expect(timeline.rows[0].laneCount).toBe(1);
    expect(timeline.rows[0].fixtures.map((fixture) => fixture.lane)).toEqual([0, 0]);
    expect(timeline.rows[0].fixtures[0].displayWidthPct).toBeGreaterThan(0);
  });

  it("creates another lane only for a real time overlap", () => {
    const timeline = buildMatchdayTimeline({
      games: [
        { id: "first", homeTeam: "A", awayTeam: "B", pitchId: "P1", koMins: 510, endMins: 600 },
        { id: "second", homeTeam: "C", awayTeam: "D", pitchId: "P1", koMins: 570, endMins: 645 },
      ],
      pitchCfg: [{ id: "P1", label: "Pitch 1", format: "9v9" }],
      padRange: false,
    });

    expect(timeline.rows[0].laneCount).toBe(2);
    expect(timeline.rows[0].fixtures.map((fixture) => fixture.lane)).toEqual([0, 1]);
  });

  it("uses the supplied live provider snapshot throughout Operations Centre", () => {
    const weatherSnapshot = {
      status: "success",
      score: 96,
      label: "Low weather risk",
      provider: "Open-Meteo",
      updatedAt: "2026-07-15T08:30:00.000Z",
      forecastAvailable: true,
      connectionStatus: "ready",
      overallRisk: { label: "Low" },
      decision: { headline: "Venue weather ready", detail: "No material rain, wind, frost or heat risk detected." },
    };
    const snapshot = buildOperationsCentreSnapshot({
      fixtures: [],
      club: { name: "Test club" },
      pitchCfg: [],
      weatherSnapshot,
    });
    const domain = snapshot.domains.find((item) => item.id === "weather");

    expect(snapshot.weather).toBe(weatherSnapshot);
    expect(domain.headline).toBe("Venue weather ready");
    expect(domain.detail).toContain("Open-Meteo");
    expect(domain.detail).not.toContain("live forecast still required");
  });

  it("connects Operations Centre to the shared live hook and ships compact single-lane rows", () => {
    expect(operationsPage).toContain('import useLiveWeather from "../hooks/useLiveWeather.js"');
    expect(operationsPage).toContain("calculateWeatherIntelligence");
    expect(operationsPage).toContain("weatherSnapshot: weatherIntelligence");
    expect(timelineCard).toContain("row.laneCount <= 1 ? (isCompact ? 52 : 58)");
    expect(timelineCard).toContain("fixture.displayWidthPct || fixture.widthPct");
  });
});
