import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  fetchLiveWeather,
  getWeatherConfiguration,
  resolveUkPostcode,
} from "../../src/lib/services/weatherService.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("live weather service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T09:00:00Z"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("weather configuration selects an enabled site with a postcode", () => {
    const configuration = getWeatherConfiguration({
      name: "Test Club",
      primarySiteId: "main",
      sites: [
        { id: "main", name: "Main", postcode: "BL6 7QE", weatherEnabled: false, isPrimary: true },
        { id: "second", name: "Second", postcode: "M1 1AE", weatherEnabled: true },
      ],
    });

    expect(configuration).toMatchObject({
      enabled: true,
      postcode: "M1 1AE",
      siteId: "second",
      venueName: "Second",
    });
  });

  test("postcode resolution returns normalised coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        result: {
          postcode: "BL6 7QE",
          latitude: 53.588,
          longitude: -2.54,
          admin_district: "Bolton",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveUkPostcode("bl6 7qe")).resolves.toEqual({
      postcode: "BL6 7QE",
      latitude: 53.588,
      longitude: -2.54,
      region: "Bolton",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("live forecast maps hourly provider data and selects the fixture-time conditions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          result: {
            postcode: "BL6 7QE",
            latitude: 53.588,
            longitude: -2.54,
            admin_district: "Bolton",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          hourly: {
            time: ["2026-07-03T09:00", "2026-07-03T10:00", "2026-07-03T11:00"],
            temperature_2m: [14, 15, 16],
            precipitation_probability: [10, 60, 20],
            precipitation: [0, 1.2, 0.1],
            rain: [0, 1.2, 0.1],
            weather_code: [1, 61, 2],
            wind_speed_10m: [5, 8, 6],
          },
          current: {
            time: "2026-07-03T09:00",
            temperature_2m: 14,
            precipitation: 0,
            rain: 0,
            weather_code: 1,
            wind_speed_10m: 5,
          },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const forecast = await fetchLiveWeather({
      postcode: "BL6 7QE",
      date: "2026-07-03",
      fixtures: [{ koTime: "10:00" }],
      force: true,
    });

    expect(forecast.provider).toBe("Open-Meteo");
    expect(forecast.hourly).toHaveLength(3);
    expect(forecast.current.temperatureC).toBe(14);
    expect(forecast.current.rainProbability).toBe(60);
    expect(forecast.current.conditions).toBe("Partly cloudy");
    expect(forecast.cacheStatus).toBe("live");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("out-of-range dates fail before making any network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchLiveWeather({ postcode: "BL6 7QE", date: "2026-07-20", force: true })
    ).rejects.toMatchObject({ code: "DATE_OUT_OF_RANGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
