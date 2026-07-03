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

  test("history deletion uses the guarded, server-audited RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(true));
    vi.stubGlobal("fetch", fetchMock);

    await DB.deleteHistory(CLUB_A, "week-42");

    const [url, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(url).toContain("/rest/v1/rpc/delete_matchweek_history");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_A,
      history_id: "week-42",
    });
  });

  test("matchweek publication uses the guarded, server-audited RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal("fetch", fetchMock);

    const entry = {
      id: "2026-07-04",
      savedAt: "2026-07-03T18:00:00.000Z",
      fixtures: [],
    };
    await DB.saveHistoryEntry(CLUB_A, entry);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/rpc/save_matchweek_history");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_A,
      history_id: "2026-07-04",
      history_data: entry,
      history_saved_at: "2026-07-03T18:00:00.000Z",
    });
  });

  test("the browser repository cannot submit free-form audit identities or actions", () => {
    expect(DB.recordAudit).toBeUndefined();
  });

  test("test fixture writes also use a guarded audited RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(1));
    vi.stubGlobal("fetch", fetchMock);

    await DB.saveTestFixtures(CLUB_A, "testsat", [{ id: "fixture-1" }]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/rpc/save_test_fixtures");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_A,
      config_key: "testsat",
      fixtures: [{ id: "fixture-1" }],
    });
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

  test("loads membership and time-limited support workspaces through one guarded RPC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([
      {
        club_id: CLUB_A,
        organisation_id: "org-a",
        club_name: "Club A",
        club_slug: "club-a",
        club_status: "active",
        role: "owner",
        access_mode: "membership",
        read_only: false,
      },
      {
        club_id: CLUB_B,
        organisation_id: "org-b",
        club_name: "Club B",
        club_slug: "club-b",
        club_status: "active",
        role: "support",
        access_mode: "support",
        read_only: true,
        support_session_id: "support-session",
        support_expires_at: "2026-07-03T12:00:00Z",
      },
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const memberships = await DB.listMemberships();

    expect(memberships).toHaveLength(2);
    expect(memberships[0]).toMatchObject({ clubId: CLUB_A, role: "owner", accessMode: "membership", readOnly: false });
    expect(memberships[1]).toMatchObject({
      clubId: CLUB_B,
      role: "support",
      accessMode: "support",
      readOnly: true,
      supportSessionId: "support-session",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/list_accessible_workspaces");
  });


  test("club invitations are created and accepted only through guarded RPCs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: "invite-1", token: "single-use-token" }))
      .mockResolvedValueOnce(jsonResponse({ club_id: CLUB_A, role: "scheduler" }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.createClubInvitation(CLUB_A, {
      email: "scheduler@example.test",
      role: "scheduler",
      expiryHours: 72,
    });
    await DB.acceptClubInvitation("single-use-token");

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/create_club_invitation");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target_club_id: CLUB_A,
      invite_email: "scheduler@example.test",
      invite_role: "scheduler",
      expiry_hours: 72,
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/rpc/accept_club_invitation");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      invitation_token: "single-use-token",
    });
  });

  test("membership administration uses guarded RPCs rather than direct table writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null, 204));
    vi.stubGlobal("fetch", fetchMock);

    await DB.updateClubMemberRole(CLUB_A, USER_ID, "scheduler");

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/rpc/update_club_member_role");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_A,
      target_user_id: USER_ID,
      next_role: "scheduler",
    });
    expect(url).not.toContain("club_memberships?");
  });

  test("customer onboarding progress and completion use guarded club RPCs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "in_progress", current_step: 2 }))
      .mockResolvedValueOnce(jsonResponse({ status: "complete", current_step: 7 }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.saveClubOnboarding(CLUB_A, {
      currentStep: 2,
      completedSteps: ["welcome", "club"],
      draft: { club: { name: "Club A" } },
    });
    await DB.completeClubOnboarding(CLUB_A, {
      configuration: { name: "Club A" },
      teams: [{ name: "First Team" }],
      pitches: [{ id: "P1", label: "Pitch 1" }],
      draft: { club: { name: "Club A" } },
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/save_club_onboarding");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target_club_id: CLUB_A,
      step_index: 2,
      completed_step_ids: ["welcome", "club"],
      onboarding_draft: { club: { name: "Club A" } },
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/rpc/complete_club_onboarding");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      target_club_id: CLUB_A,
      configuration: { name: "Club A" },
      teams: [{ name: "First Team" }],
      pitches: [{ id: "P1", label: "Pitch 1" }],
      final_draft: { club: { name: "Club A" } },
    });
  });

  test("support access requests are time-limited RPC calls with no service key in the browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "session-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.grantSupportAccess(CLUB_A, {
      email: "support@daxora.test",
      durationMinutes: 60,
      reason: "Investigate fixture import",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/rest/v1/rpc/grant_support_access");
    expect(options.headers.Authorization).toBe("Bearer signed-in-user-jwt");
    expect(JSON.parse(options.body)).toEqual({
      target_club_id: CLUB_A,
      support_email: "support@daxora.test",
      duration_minutes: 60,
      support_reason: "Investigate fixture import",
    });
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
  test("temporary refresh failures keep the local session for recovery", async () => {
    const current = Auth.getSession();
    Auth.saveSession({ ...current, expires_at: Math.floor(Date.now() / 1000) + 10 });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Temporary network failure")));

    await expect(Auth.getValidSession({ forceRefresh: true })).rejects.toMatchObject({
      code: "SESSION_REFRESH_FAILED",
    });
    expect(Auth.getSession()?.access_token).toBe("signed-in-user-jwt");
  });

  test("an authentication rejection clears the expired local session", async () => {
    const current = Auth.getSession();
    Auth.saveSession({ ...current, expires_at: Math.floor(Date.now() / 1000) + 10 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "invalid refresh token" }, 401)));

    await expect(Auth.getValidSession({ forceRefresh: true })).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
      status: 401,
    });
    expect(Auth.getSession()).toBeNull();
  });

});
