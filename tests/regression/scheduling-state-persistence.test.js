// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

const ANON_KEY = "test-anon-key-that-is-long-enough-for-configuration";
const CLUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let Auth;
let DB;

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (payload === null ? "" : JSON.stringify(payload)),
  };
}

beforeAll(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://ground-control-test.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", ANON_KEY);
  vi.resetModules();
  ({ Auth, DB } = await import("../../src/lib/supabase.js"));
});

afterAll(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
  Auth.saveSession({
    access_token: "signed-in-user-jwt",
    refresh_token: "refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "11111111-1111-4111-8111-111111111111", email: "scheduler@example.test" },
  });
});

describe("canonical matchday scheduling-state persistence", () => {
  test("loads state and saves only canonical intent and manual fixtures with an expected revision", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ revision: 4, intents: {}, manual_fixtures: [] }))
      .mockResolvedValueOnce(jsonResponse({ revision: 5, intents: { "url:fixture-a": { allocation: { koTime: "08:05" } } }, manual_fixtures: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.loadMatchdaySchedulingState(CLUB_ID, { dayScope: "saturday", matchdayDate: "2026-09-05" });
    await DB.saveMatchdaySchedulingState(CLUB_ID, {
      dayScope: "saturday",
      matchdayDate: "2026-09-05",
      expectedRevision: 4,
      intents: { "url:fixture-a": { allocation: { koTime: "08:05", pitchId: "P3" }, mode: "locked" } },
      manualFixtures: [],
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining("/rest/v1/rpc/load_matchday_scheduling_state"),
      expect.stringContaining("/rest/v1/rpc/save_matchday_scheduling_state"),
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      target_club_id: CLUB_ID,
      target_day_scope: "saturday",
      target_matchday_date: "2026-09-05",
      expected_revision: 4,
      intent_data: { "url:fixture-a": { allocation: { koTime: "08:05", pitchId: "P3" }, mode: "locked" } },
      manual_fixture_data: [],
    });
  });

  test("publishes an already-saved revision without a scheduling approval payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ revision: 5, published_at: "2026-09-04T12:00:00.000Z" }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.publishMatchdaySchedulingState(CLUB_ID, {
      dayScope: "saturday",
      matchdayDate: "2026-09-05",
      expectedRevision: 5,
      snapshot: { canonicalIdentities: ["url:fixture-a"] },
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/rpc/publish_matchday_scheduling_state");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_ID,
      target_day_scope: "saturday",
      target_matchday_date: "2026-09-05",
      expected_revision: 5,
      schedule_snapshot: { canonicalIdentities: ["url:fixture-a"] },
    });
  });

  test("declares a guarded scheduling-state table and direct save/publish RPCs without derived allocations", () => {
    const migrationName = readdirSync("supabase/migrations")
      .find((name) => name.endsWith("_matchday_scheduling_state.sql"));
    expect(migrationName).toBeTruthy();
    const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8");

    expect(migration).toContain("matchday_scheduling_states");
    expect(migration).toContain("expected_revision");
    expect(migration).toContain("save_matchday_scheduling_state");
    expect(migration).toContain("publish_matchday_scheduling_state");
    expect(migration).not.toContain("generated_allocations");
    expect(migration).not.toContain("elite_approval_requests");
  });
});
