// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const ANON_KEY = "test-anon-key-that-is-long-enough-for-configuration";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const CLUB_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CLUB_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let Auth;
let DB;
let clearTenantStorageContext;
let getTenantStorageKey;
let migrateLegacyTenantStorage;
let setTenantStorageContext;
let tenantGetJson;
let tenantSetJson;

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
  ({
    clearTenantStorageContext,
    getTenantStorageKey,
    migrateLegacyTenantStorage,
    setTenantStorageContext,
    tenantGetJson,
    tenantSetJson,
  } = await import("../../src/lib/storage/tenantStorage.js"));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  window.localStorage.clear();
  clearTenantStorageContext();
  Auth.saveSession({
    access_token: "signed-in-user-jwt",
    refresh_token: "refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: "owner@example.test" },
  });
});

describe("authenticated Supabase repository", () => {
  test("uses the anon key only as apikey and the user JWT as bearer identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await DB.loadHistory(CLUB_A);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/history?");
    expect(url).toContain(`club_id=eq.${CLUB_A}`);
    expect(options.headers.apikey).toBe(ANON_KEY);
    expect(options.headers.Authorization).toBe("Bearer signed-in-user-jwt");
    expect(options.headers.Authorization).not.toContain(ANON_KEY);
  });

  test("all history deletion paths include both club and record filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal("fetch", fetchMock);

    await DB.deleteHistory(CLUB_A, "week-42");

    const [url, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("DELETE");
    expect(url).toContain(`club_id=eq.${CLUB_A}`);
    expect(url).toContain("id=eq.week-42");
    expect(url).not.toContain("id=not.is.null");
  });

  test("history upserts carry tenant ownership and use a compound conflict key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal("fetch", fetchMock);

    await DB.saveHistoryEntry(CLUB_A, {
      id: "2026-07-04",
      savedAt: "2026-07-03T18:00:00.000Z",
      fixtures: [],
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("history?on_conflict=club_id,id");
    expect(JSON.parse(options.body)).toEqual([
      expect.objectContaining({
        club_id: CLUB_A,
        id: "2026-07-04",
      }),
    ]);
  });

  test("audit requests never accept a browser-supplied actor identity", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("event-id"));
    vi.stubGlobal("fetch", fetchMock);

    await DB.recordAudit(CLUB_A, {
      action: "settings.club.save",
      entityType: "settings",
      entityId: "club",
      detail: { changed: true },
      actorUserId: "attacker-controlled-id",
      actorEmail: "spoofed@example.test",
    });

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toContain("/rest/v1/rpc/record_audit_event");
    expect(body).toEqual({
      target_club_id: CLUB_A,
      event_action: "settings.club.save",
      entity_type: "settings",
      entity_id: "club",
      event_detail: { changed: true },
    });
    expect(JSON.stringify(body)).not.toContain("attacker-controlled-id");
    expect(JSON.stringify(body)).not.toContain("spoofed@example.test");
  });

  test("rejects database access when no signed-in session exists", async () => {
    Auth.clearSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(DB.loadHistory(CLUB_A)).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("excludes memberships whose club metadata is hidden or inactive", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        { club_id: CLUB_A, role: "owner", status: "active", created_at: "2026-07-03T09:00:00Z" },
        { club_id: CLUB_B, role: "owner", status: "active", created_at: "2026-07-03T09:01:00Z" },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { id: CLUB_A, organisation_id: "org-a", name: "Club A", slug: "club-a", status: "active" },
      ]));
    vi.stubGlobal("fetch", fetchMock);

    const memberships = await DB.listMemberships();

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ clubId: CLUB_A, role: "owner" });
  });

  test("fails closed when the selected club is hidden by RLS", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(DB.ping(CLUB_B)).rejects.toMatchObject({
      code: "CLUB_ACCESS_DENIED",
      status: 403,
    });
  });
});

describe("tenant-scoped browser storage", () => {
  test("the same logical key is isolated by both user and club", () => {
    setTenantStorageContext({ userId: USER_ID, clubId: CLUB_A });
    tenantSetJson("club", { name: "Club A" });
    const clubAKey = getTenantStorageKey("club");

    setTenantStorageContext({ userId: USER_ID, clubId: CLUB_B });
    tenantSetJson("club", { name: "Club B" });
    const clubBKey = getTenantStorageKey("club");

    expect(clubAKey).not.toBe(clubBKey);
    expect(tenantGetJson("club")).toEqual({ name: "Club B" });

    setTenantStorageContext({ userId: USER_ID, clubId: CLUB_A });
    expect(tenantGetJson("club")).toEqual({ name: "Club A" });
  });

  test("legacy global data migrates once and is then removed", () => {
    window.localStorage.setItem("hsm_club", JSON.stringify({ name: "Legacy Club" }));
    window.localStorage.setItem("hsm_refs", JSON.stringify([{ id: "ref-1" }]));
    setTenantStorageContext({ userId: USER_ID, clubId: CLUB_A });

    const first = migrateLegacyTenantStorage();
    const second = migrateLegacyTenantStorage();

    expect(first.migrated).toBe(true);
    expect(first.keys).toEqual(expect.arrayContaining(["club", "referees"]));
    expect(tenantGetJson("club")).toEqual({ name: "Legacy Club" });
    expect(window.localStorage.getItem("hsm_club")).toBeNull();
    expect(window.localStorage.getItem("hsm_refs")).toBeNull();
    expect(second).toEqual({ migrated: false, keys: [] });
  });
});
