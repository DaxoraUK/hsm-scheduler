// @vitest-environment jsdom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const ANON_KEY = "test-anon-key-that-is-long-enough-for-configuration";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const CLUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CASE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

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
  window.localStorage.clear();
  Auth.saveSession({
    access_token: "platform-operator-jwt",
    refresh_token: "refresh-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER_ID, email: "admin@daxora.test" },
  });
});

describe("Daxora admin repository", () => {
  test("loads operator context and club inventory through guarded RPCs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ is_platform_staff: true, platform_role: "admin" }))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, limit: 50, offset: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.getPlatformOperatorContext();
    await DB.platformListClubs({ search: "Horwich", status: "active", plan: "link", limit: 50, offset: 0 });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/get_platform_operator_context");
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/rpc/platform_list_clubs");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      search_text: "Horwich",
      status_filter: "active",
      plan_filter: "link",
      page_size: 50,
      page_offset: 0,
    });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer platform-operator-jwt");
  });

  test("club status and plan mutation require explicit reasons in the RPC payload", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ club_id: CLUB_ID, status: "suspended" }))
      .mockResolvedValueOnce(jsonResponse({ club_id: CLUB_ID, plan_code: "pro", status: "active" }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.platformUpdateClubStatus(CLUB_ID, "suspended", "Payment and access review");
    await DB.platformSetClubSubscription(CLUB_ID, {
      planCode: "pro",
      status: "active",
      billingInterval: "annual",
      billingExempt: false,
      reason: "Annual Pro agreement approved",
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/platform_update_club_status");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target_club_id: CLUB_ID,
      next_status: "suspended",
      change_reason: "Payment and access review",
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/rpc/platform_set_club_subscription");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      target_club_id: CLUB_ID,
      next_plan_code: "pro",
      next_status: "active",
      next_billing_interval: "annual",
      change_reason: "Annual Pro agreement approved",
    });
  });

  test("support cases are created, reviewed and updated through dedicated RPCs", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: CASE_ID, case_number: 1001 }))
      .mockResolvedValueOnce(jsonResponse({ case: { id: CASE_ID }, notes: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: CASE_ID, status: "investigating" }));
    vi.stubGlobal("fetch", fetchMock);

    await DB.platformCreateSupportCase(CLUB_ID, {
      subject: "Fixture import failed",
      description: "The Full-Time source returned an error.",
      priority: "high",
      requesterEmail: "owner@example.test",
    });
    await DB.platformGetSupportCase(CASE_ID);
    await DB.platformUpdateSupportCase(CASE_ID, {
      status: "investigating",
      priority: "high",
      note: "Reproduced in support environment.",
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/rest/v1/rpc/platform_create_support_case");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      target_club_id: CLUB_ID,
      case_subject: "Fixture import failed",
      case_description: "The Full-Time source returned an error.",
      case_priority: "high",
      requester_email: "owner@example.test",
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/rest/v1/rpc/platform_get_support_case");
    expect(fetchMock.mock.calls[2][0]).toContain("/rest/v1/rpc/platform_update_support_case");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      target_case_id: CASE_ID,
      next_status: "investigating",
      next_priority: "high",
      update_note: "Reproduced in support environment.",
    });
  });
});
