// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getConfiguredFixtureSources } from "../../src/hooks/useFixtureFetcher.js";
import { GET, parseFullTimeSourceUrl } from "../../server-api/full-time.js";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const fetcher = readFileSync("src/hooks/useFixtureFetcher.js", "utf8");
const settings = readFileSync("src/components/Settings/IntegrationSettingsPanel.jsx", "utf8");
const gateway = readFileSync("api/[...path].js", "utf8");

afterEach(() => vi.restoreAllMocks());

describe("Daxora Ground Control v3.10.43 Full-Time reliability", () => {
  test("normalises multiple sources while retaining legacy single-source configuration", () => {
    expect(getConfiguredFixtureSources({ enabled: true, sourceUrl: "https://fulltime.thefa.com/displayTeam.html?id=1", clubId: "legacy" })).toHaveLength(1);
    expect(getConfiguredFixtureSources({
      enabled: true,
      sources: [
        { id: "a", name: "League A", url: "https://fulltime.thefa.com/displayTeam.html?id=1" },
        { id: "b", name: "League B", url: "https://fulltime.thefa.com/displayTeam.html?id=2" },
      ],
    })).toHaveLength(2);
  });

  test("accepts only secure Full-Time hosts and blocks SSRF-style URLs", () => {
    expect(parseFullTimeSourceUrl("https://fulltime.thefa.com/displayTeam.html?id=1")?.hostname).toBe("fulltime.thefa.com");
    expect(parseFullTimeSourceUrl("http://fulltime.thefa.com/displayTeam.html?id=1")).toBeNull();
    expect(parseFullTimeSourceUrl("https://fulltime.thefa.com.evil.example/fixtures")).toBeNull();
    expect(parseFullTimeSourceUrl("https://127.0.0.1/internal")).toBeNull();
  });

  test("returns bounded fixture HTML through the same-origin endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><table></table></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    })));
    const response = await GET(new Request("https://daxora.example/api/full-time?source=https%3A%2F%2Ffulltime.thefa.com%2FdisplayTeam.html%3Fid%3D1"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ contents: "<html><table></table></html>" });
  });

  test("wires saved configuration, same-origin fetching and source management into the product", () => {
    expect(appCore).toContain("useFixtureFetcher(club.integrations?.fullTimeFa || {})");
    expect(appCore).toContain("The existing Saturday schedule was left unchanged.");
    expect(fetcher).toContain("/api/full-time?source=");
    expect(fetcher).not.toContain("api.allorigins.win");
    expect(settings).toContain("Add Full-Time source");
    expect(settings).toContain("teamAliases");
    expect(gateway).toContain('["/api/full-time", fullTime]');
  });
});
