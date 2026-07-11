import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "../../api/weather.js";

function providerResponse(payload = { hourly: { time: [] } }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ORIGINAL_ENV = { ...process.env };

function weatherRequest(extra = "") {
  return new Request(
    `https://ground-control.example/api/weather?latitude=53.588&longitude=-2.54&start_date=2026-07-11&end_date=2026-07-11&hourly=temperature_2m,weather_code,not_allowed${extra}`,
  );
}

describe("Vercel weather proxy", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OPEN_METEO_API_KEY;
    delete process.env.OPEN_METEO_API_BASE_URL;
    delete process.env.WEATHER_ALLOW_PUBLIC_API;
    delete process.env.APP_ENVIRONMENT;
    delete process.env.VITE_APP_ENVIRONMENT;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_GIT_COMMIT_REF;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  test("uses the public provider through the server proxy for staging", async () => {
    process.env.VITE_APP_ENVIRONMENT = "staging";
    const fetchMock = vi.fn().mockResolvedValue(providerResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(weatherRequest("&current=temperature_2m,rain"));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const upstreamUrl = String(fetchMock.mock.calls[0][0]);
    expect(upstreamUrl).toContain("https://api.open-meteo.com/v1/forecast?");
    expect(upstreamUrl).toContain("hourly=temperature_2m%2Cweather_code");
    expect(upstreamUrl).not.toContain("not_allowed");
    expect(response.headers.get("x-ground-control-weather-mode")).toBe(
      "evaluation",
    );
  });

  test("fails closed in commercial production without provider credentials", async () => {
    process.env.VITE_APP_ENVIRONMENT = "production";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_GIT_COMMIT_REF = "main";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(weatherRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.code).toBe("WEATHER_PROVIDER_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("uses the commercial endpoint and keeps the API key server-side", async () => {
    process.env.VITE_APP_ENVIRONMENT = "production";
    process.env.VERCEL_ENV = "production";
    process.env.OPEN_METEO_API_KEY = "commercial-secret";
    const fetchMock = vi.fn().mockResolvedValue(providerResponse());
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(weatherRequest());

    expect(response.status).toBe(200);
    const upstreamUrl = String(fetchMock.mock.calls[0][0]);
    expect(upstreamUrl).toContain("https://customer-api.open-meteo.com/v1/forecast?");
    expect(upstreamUrl).toContain("apikey=commercial-secret");
    expect(response.headers.get("x-ground-control-weather-mode")).toBe(
      "commercial",
    );
  });

  test("rejects invalid coordinates before calling the provider", async () => {
    process.env.VITE_APP_ENVIRONMENT = "staging";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "https://ground-control.example/api/weather?latitude=999&longitude=-2.54&start_date=2026-07-11&end_date=2026-07-11",
      ),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
