import { mergeCoachHubWorkspaceIntoContacts } from "./coachHubContactBridge.js";

// Authenticated Supabase REST client and club-scoped data repository.
// The anon key identifies the application; the signed-in user's JWT identifies
// the actor and is mandatory for all database requests protected by RLS.

const ENV_SUPA_URL = String(
  import.meta.env?.VITE_SUPABASE_URL || "",
).trim();

const ENV_SUPA_KEY = String(
  import.meta.env?.VITE_SUPABASE_ANON_KEY || "",
).trim();

const SESSION_KEY = "gc_auth_session_v2";
const LEGACY_SESSION_KEY = "hsm_auth_session";
const DEVELOPMENT_KEY = "gc_development_supabase_anon_key";

export const SUPA_URL = ENV_SUPA_URL.replace(/\/$/, "");
export const SUPA_AUTH = `${SUPA_URL}/auth/v1`;

let refreshPromise = null;

const AUTH_CONTEXT_QUERY_KEYS = Object.freeze([
  "coach_invite",
  "club_invite",
  "league_invite",
  "league_club_invite",
]);

function pendingAuthContextKey(queryKey) {
  return `gc_pending_auth_context_${String(queryKey || "").trim()}`;
}

function rememberAuthContext(url) {
  if (typeof window === "undefined") return;
  const storage = getLocalStorage();
  if (!storage) return;
  for (const key of AUTH_CONTEXT_QUERY_KEYS) {
    const value = url.searchParams.get(key)?.trim() || "";
    if (value) storage.setItem(pendingAuthContextKey(key), value);
  }
}

function currentAuthRedirectUrl() {
  if (typeof window === "undefined") return "";
  try {
    const current = new URL(window.location.href);
    rememberAuthContext(current);
    const configured = String(import.meta.env?.VITE_AUTH_REDIRECT_URL || "").trim();
    const target = configured
      ? new URL(configured, current.origin)
      : new URL(`${current.origin}${current.pathname}`);
    for (const key of AUTH_CONTEXT_QUERY_KEYS) {
      const liveValue = current.searchParams.get(key)?.trim() || "";
      const storedValue = getLocalStorage()?.getItem(pendingAuthContextKey(key))?.trim() || "";
      const value = liveValue || storedValue;
      if (value) target.searchParams.set(key, value);
    }
    target.hash = "";
    return target.toString();
  } catch {
    return "";
  }
}

function clearAuthCallbackFragment() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.hash) return;
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  } catch {
    // A malformed callback URL must not block the sign-in screen.
  }
}

function getLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export class SupabaseRequestError extends Error {
  constructor(message, { status = 0, code = "SUPABASE_REQUEST_FAILED", details = null, path = "" } = {}) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.path = path;
  }
}

export const getSupaKey = () => {
  if (ENV_SUPA_KEY) return ENV_SUPA_KEY;
  const storage = getLocalStorage();
  if (!storage || !import.meta.env?.DEV) return "";
  return storage.getItem(DEVELOPMENT_KEY) || storage.getItem("hsm_supa_key") || "";
};

export const setSupaKey = (key) => {
  if (!import.meta.env?.DEV) return false;
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const value = String(key || "").trim();
    if (value) storage.setItem(DEVELOPMENT_KEY, value);
    else storage.removeItem(DEVELOPMENT_KEY);
    storage.removeItem("hsm_supa_key");
    return true;
  } catch {
    return false;
  }
};

export const isSupaConfigured = () => Boolean(
  (typeof window !== "undefined" && window.__DAXORA_TEAMFEEPAY_DEMO__ === true)
  || (SUPA_URL && getSupaKey().length > 20)
);

async function readResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function responseError(payload, fallback) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  return payload?.message || payload?.error_description || payload?.msg || payload?.error || fallback;
}

export const authFetch = async (path, body = null, method = "POST", token = "") => {
  const key = getSupaKey();
  if (!key) return { error: "Supabase is not configured" };

  try {
    const headers = {
      "Content-Type": "application/json",
      apikey: key,
    };

    // Supabase publishable keys (sb_publishable_...) are API keys, not JWTs.
    // They belong in the apikey header only. Authorization must contain a real
    // signed-in user access token when one exists.
    if (token) headers.Authorization = `Bearer ${token}`;

    const options = {
      method,
      headers,
    };
    if (body !== null && method !== "GET" && method !== "HEAD") {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(`${SUPA_AUTH}${path}`, options);
    const payload = await readResponse(response);
    if (!response.ok) return { error: responseError(payload, "Authentication failed"), status: response.status };
    return payload || { ok: true };
  } catch (error) {
    return { error: error?.message || "Network error" };
  }
};

function sessionExpiresSoon(session, bufferSeconds = 90) {
  if (!session?.access_token) return true;
  const expiresAt = Number(session.expires_at || 0);
  if (!expiresAt) return false;
  return expiresAt * 1000 <= Date.now() + bufferSeconds * 1000;
}

export const Auth = {
  async signUp(email, password, displayName) {
    const redirectTo = currentAuthRedirectUrl();
    const path = redirectTo
      ? `/signup?redirect_to=${encodeURIComponent(redirectTo)}`
      : "/signup";
    return authFetch(path, {
      email,
      password,
      data: { display_name: displayName || email.split("@")[0] },
    });
  },

  async signIn(email, password) {
    return authFetch("/token?grant_type=password", { email, password });
  },

  async signOut(token) {
    try {
      if (token) await authFetch("/logout", {}, "POST", token);
      return { ok: true };
    } finally {
      Auth.clearSession();
    }
  },

  async getUser(token) {
    return authFetch("/user", null, "GET", token);
  },

  async resetPassword(email) {
    const redirectTo = currentAuthRedirectUrl();
    const path = redirectTo
      ? `/recover?redirect_to=${encodeURIComponent(redirectTo)}`
      : "/recover";
    return authFetch(path, { email });
  },

  async consumeRedirectSession() {
    if (typeof window === "undefined" || !window.location.hash) return null;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackError = params.get("error_description") || params.get("error");
    const accessToken = params.get("access_token") || "";
    const refreshToken = params.get("refresh_token") || "";
    const looksLikeAuthCallback = Boolean(callbackError || accessToken || refreshToken || params.get("type"));
    if (!looksLikeAuthCallback) return null;

    if (callbackError) {
      clearAuthCallbackFragment();
      return { error: callbackError };
    }
    if (!accessToken || !refreshToken) {
      clearAuthCallbackFragment();
      return { error: "The email confirmation callback did not contain a complete secure session." };
    }

    const user = await Auth.getUser(accessToken);
    if (!user || user.error) {
      clearAuthCallbackFragment();
      return { error: user?.error || "The confirmed account could not be verified." };
    }

    const expiresIn = Math.max(1, Number(params.get("expires_in") || 3600));
    const explicitExpiresAt = Number(params.get("expires_at") || 0);
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: params.get("token_type") || "bearer",
      expires_in: expiresIn,
      expires_at: explicitExpiresAt || Math.floor(Date.now() / 1000) + expiresIn,
      user,
    };
    Auth.saveSession(session);
    clearAuthCallbackFragment();
    return { session, type: params.get("type") || "" };
  },

  async refreshSession(refreshToken) {
    return authFetch("/token?grant_type=refresh_token", { refresh_token: refreshToken });
  },

  getSession() {
    const storage = getLocalStorage();
    if (!storage) return null;
    try {
      const current = storage.getItem(SESSION_KEY);
      if (current) return JSON.parse(current);
      const legacy = storage.getItem(LEGACY_SESSION_KEY);
      if (!legacy) return null;
      const parsed = JSON.parse(legacy);
      storage.setItem(SESSION_KEY, legacy);
      storage.removeItem(LEGACY_SESSION_KEY);
      return parsed;
    } catch {
      return null;
    }
  },

  saveSession(session) {
    const storage = getLocalStorage();
    if (!storage || !session?.access_token) return false;
    try {
      storage.setItem(SESSION_KEY, JSON.stringify(session));
      storage.removeItem(LEGACY_SESSION_KEY);
      return true;
    } catch {
      return false;
    }
  },

  clearSession() {
    const storage = getLocalStorage();
    if (!storage) return;
    try {
      storage.removeItem(SESSION_KEY);
      storage.removeItem(LEGACY_SESSION_KEY);
    } catch {
      // The in-memory auth gate still closes even if browser storage is unavailable.
    }
  },

  async getValidSession({ forceRefresh = false } = {}) {
    const current = Auth.getSession();
    if (!current?.access_token) return null;
    if (!forceRefresh && !sessionExpiresSoon(current)) return current;
    if (!current.refresh_token) return current;

    if (!refreshPromise) {
      refreshPromise = Auth.refreshSession(current.refresh_token)
        .then((refreshed) => {
          if (!refreshed?.access_token) {
            const status = Number(refreshed?.status || 0);
            const authenticationRejected = status === 400 || status === 401 || status === 403;
            if (authenticationRejected) Auth.clearSession();
            throw new SupabaseRequestError(
              refreshed?.error || (authenticationRejected ? "Your session has expired" : "The secure session could not be refreshed"),
              {
                status,
                code: authenticationRejected ? "SESSION_EXPIRED" : "SESSION_REFRESH_FAILED",
              }
            );
          }
          Auth.saveSession(refreshed);
          return refreshed;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  },
};

export const getAuthToken = () => Auth.getSession()?.access_token || null;

async function authenticatedRequest(method, path, body, extraHeaders, retry) {
  if (!isSupaConfigured()) {
    throw new SupabaseRequestError("Supabase is not configured", { code: "SUPABASE_NOT_CONFIGURED", path });
  }

  const session = await Auth.getValidSession();
  if (!session?.access_token) {
    throw new SupabaseRequestError("Sign in again to continue", { status: 401, code: "AUTH_REQUIRED", path });
  }

  const options = {
    method,
    headers: {
      apikey: getSupaKey(),
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  };
  if (body !== null && body !== undefined && method !== "GET" && method !== "HEAD") {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`${SUPA_URL}/rest/v1/${path}`, options);

  if (response.status === 401 && retry) {
    await Auth.getValidSession({ forceRefresh: true });
    return authenticatedRequest(method, path, body, extraHeaders, false);
  }

  const payload = await readResponse(response);
  if (!response.ok) {
    throw new SupabaseRequestError(responseError(payload, `Database request failed (${response.status})`), {
      status: response.status,
      code: payload?.code || "SUPABASE_REQUEST_FAILED",
      details: payload?.details || payload?.hint || payload,
      path,
    });
  }

  return payload;
}

export const supaFetch = async (method, path, body = null, extraHeaders = {}) =>
  authenticatedRequest(method, path, body, extraHeaders, true);

async function invokeEdgeFunction(functionName, body = {}) {
  if (!isSupaConfigured()) {
    throw new SupabaseRequestError("Supabase is not configured", { code: "SUPABASE_NOT_CONFIGURED", path: functionName });
  }
  const session = await Auth.getValidSession();
  if (!session?.access_token) {
    throw new SupabaseRequestError("Sign in again to continue", { status: 401, code: "AUTH_REQUIRED", path: functionName });
  }

  const response = await fetch(`${SUPA_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      apikey: getSupaKey(),
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw new SupabaseRequestError(responseError(payload, `Billing request failed (${response.status})`), {
      status: response.status,
      code: payload?.code || "EDGE_FUNCTION_FAILED",
      details: payload,
      path: functionName,
    });
  }
  return payload;
}

function requireClubId(clubId) {
  const value = String(clubId || "").trim();
  if (!value) {
    throw new SupabaseRequestError("No club workspace is selected", { code: "CLUB_CONTEXT_REQUIRED" });
  }
  return value;
}

function requireLeagueId(leagueId) {
  const value = String(leagueId || "").trim();
  if (!value) {
    throw new SupabaseRequestError("No league workspace is selected", { code: "LEAGUE_CONTEXT_REQUIRED" });
  }
  return value;
}

function encodeFilter(value) {
  return encodeURIComponent(String(value));
}

function normaliseWorkspaceAccess(row = {}) {
  const clubId = row.club_id || row.clubId || "";
  const accessMode = row.access_mode || row.accessMode || "membership";
  return {
    clubId,
    role: row.role || (accessMode === "support" ? "support" : "viewer"),
    roleAssignments: Array.isArray(row.role_assignments || row.roleAssignments)
      ? (row.role_assignments || row.roleAssignments)
      : [],
    roles: Array.isArray(row.role_assignments || row.roleAssignments)
      ? (row.role_assignments || row.roleAssignments).map((assignment) => assignment.role || assignment.role_code).filter(Boolean)
      : [],
    status: row.status || "active",
    joinedAt: row.granted_at || row.joinedAt || row.created_at || null,
    accessMode,
    readOnly: Boolean(row.read_only ?? row.readOnly ?? accessMode === "support"),
    supportSessionId: row.support_session_id || row.supportSessionId || null,
    supportExpiresAt: row.support_expires_at || row.supportExpiresAt || null,
    club: {
      id: clubId,
      organisationId: row.organisation_id || row.organisationId || null,
      name: row.club_name || row.clubName || "Club workspace",
      slug: row.club_slug || row.clubSlug || "",
      status: row.club_status || row.clubStatus || "active",
    },
  };
}

function asArray(payload) {
  return Array.isArray(payload) ? payload : [];
}

async function loadRows(table, clubId, { order = "id.asc" } = {}) {
  const id = requireClubId(clubId);
  const orderQuery = order ? `&order=${encodeURIComponent(order)}` : "";
  const rows = await supaFetch(
    "GET",
    `${table}?select=id,data&club_id=eq.${encodeFilter(id)}${orderQuery}`
  );
  return Array.isArray(rows) ? rows : [];
}

async function replaceCollection(clubId, collection, records) {
  const id = requireClubId(clubId);
  const payload = Array.isArray(records) ? records : [];
  return supaFetch("POST", "rpc/replace_club_collection", {
    target_club_id: id,
    collection_name: collection,
    records: payload,
  });
}

export const DB = {
  async loadMatchdaySchedulingState(clubId, { dayScope, matchdayDate } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/load_matchday_scheduling_state", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
    });
  },

  async saveMatchdaySchedulingState(clubId, {
    dayScope,
    matchdayDate,
    expectedRevision,
    intents = {},
    manualFixtures = [],
  } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_matchday_scheduling_state", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
      expected_revision: Math.max(0, Number(expectedRevision) || 0),
      intent_data: intents && typeof intents === "object" ? intents : {},
      manual_fixture_data: Array.isArray(manualFixtures) ? manualFixtures : [],
    });
  },

  async publishMatchdaySchedulingState(clubId, {
    dayScope,
    matchdayDate,
    expectedRevision,
    snapshot = {},
  } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/publish_matchday_scheduling_state", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
      expected_revision: Math.max(0, Number(expectedRevision) || 0),
      schedule_snapshot: snapshot && typeof snapshot === "object" ? snapshot : {},
    });
  },

  async getMatchdayLock(clubId, { dayScope, matchdayDate } = {}) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/get_matchday_lock", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
    });
    return result && typeof result === "object" ? result : { locked: false };
  },

  async setMatchdayLock(clubId, { dayScope, matchdayDate, locked, snapshotHash = "", fixtureCount = 0 } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/set_matchday_lock", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
      target_locked: Boolean(locked),
      target_snapshot_hash: String(snapshotHash || "").trim() || null,
      target_fixture_count: Math.max(0, Number(fixtureCount) || 0),
    });
  },

  async assertMatchdayApproval(clubId, { dayScope, matchdayDate, snapshotHash } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/assert_matchday_approval", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_matchday_date: String(matchdayDate || "").trim(),
      target_snapshot_hash: String(snapshotHash || "").trim(),
    });
  },

  async listIntelligenceFeedback(clubId, dayScope) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_intelligence_feedback", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
    }));
  },

  async recordIntelligenceFeedback(clubId, { dayScope, issueKey, issueTitle, response, context = {} } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/record_intelligence_feedback", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
      target_issue_key: String(issueKey || "").trim(),
      target_issue_title: String(issueTitle || "").trim(),
      target_response: String(response || "").trim(),
      target_context: context && typeof context === "object" ? context : {},
    });
  },

  async clearIntelligenceFeedback(clubId, dayScope) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/clear_intelligence_feedback", {
      target_club_id: id,
      target_day_scope: String(dayScope || "").trim(),
    });
  },

  async updateMyProfile(displayName) {
    return supaFetch("POST", "rpc/update_my_profile", {
      next_display_name: String(displayName || "").trim(),
    });
  },

  async recordClientEvent(event = {}) {
    return supaFetch("POST", "rpc/record_client_event", {
      target_club_id: event.clubId || null,
      event_level: String(event.level || "error").trim().toLowerCase(),
      event_category: String(event.category || "manual_report").trim().toLowerCase(),
      event_message: String(event.message || "Unexpected client error").trim(),
      event_reference: String(event.reference || "").trim() || null,
      event_route: String(event.route || "").trim() || null,
      app_release: String(event.release || "").trim() || null,
      app_environment: String(event.environment || "").trim() || null,
      event_context: event.context && typeof event.context === "object" ? event.context : {},
    });
  },

  async listMemberships() {
    const session = await Auth.getValidSession();
    if (!session?.user?.id) {
      throw new SupabaseRequestError("Authenticated user details are unavailable", { code: "AUTH_USER_MISSING" });
    }

    const accessRows = await supaFetch("POST", "rpc/list_accessible_workspaces", {});
    return asArray(accessRows)
      .map(normaliseWorkspaceAccess)
      .filter((membership) => membership.clubId && membership.club.status === "active");
  },

  async getBootstrapStatus() {
    return supaFetch("POST", "rpc/get_workspace_bootstrap_status", {});
  },

  async bootstrapFirstClub({ clubName, organisationName } = {}) {
    return supaFetch("POST", "rpc/bootstrap_first_workspace", {
      club_name: String(clubName || "Ground Control Club").trim(),
      organisation_name: String(organisationName || clubName || "Ground Control Workspace").trim(),
    });
  },

  async ping(clubId) {
    const id = requireClubId(clubId);
    const rows = await supaFetch("GET", `clubs?select=id,name,status&id=eq.${encodeFilter(id)}&limit=1`);
    if (!Array.isArray(rows) || !rows.length) {
      throw new SupabaseRequestError("The selected club is unavailable or your membership is no longer active", {
        status: 403,
        code: "CLUB_ACCESS_DENIED",
      });
    }
    return rows[0];
  },

  async load(table, clubId, options) {
    const rows = await loadRows(table, clubId, options);
    return rows.map((row) => row.data).filter((value) => value !== null && value !== undefined);
  },

  async loadHistory(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/load_matchweek_history", {
      target_club_id: id,
    }));
  },

  async loadRefs(clubId) {
    return DB.load("refs", clubId);
  },

  async loadTeamCfg(clubId) {
    return DB.load("team_config", clubId);
  },

  async loadTeamContacts(clubId) {
    const id = requireClubId(clubId);
    let contacts;
    try {
      contacts = asArray(await supaFetch("POST", "rpc/list_team_contacts_v2", {
        target_club_id: id,
      }));
    } catch (error) {
      // v2 was introduced with the multi-team coach directory. Keep the legacy
      // RPC as a rollout fallback while PostgREST refreshes its schema cache.
      const missingRpc = error instanceof SupabaseRequestError
        && (Number(error.status || 0) === 404 || String(error.code || "") === "PGRST202");
      if (!missingRpc) throw error;
      contacts = asArray(await supaFetch("POST", "rpc/list_team_contacts", {
        target_club_id: id,
      }));
    }

    // The contacts RPC omits assignments created from the original coach and
    // assistant source slots. Merge the authoritative Coach Hub workspace so
    // Settings -> Teams always receives every active assignment.
    try {
      const workspace = await supaFetch("POST", "rpc/list_coach_hub_admin_workspace", {
        target_club_id: id,
      });
      return mergeCoachHubWorkspaceIntoContacts(contacts, workspace);
    } catch {
      // Users without Coach Hub administration access retain the protected
      // team-contact rows that their current role is permitted to read.
      return contacts;
    }
  },

  async saveTeamContacts(clubId, contacts = []) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/replace_team_contacts", {
      target_club_id: id,
      records: Array.isArray(contacts) ? contacts : [],
    });
  },

  async deleteTeamContact(clubId, teamKey) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_team_contact", {
      target_club_id: id,
      target_team_key: String(teamKey || "").trim(),
    });
  },

  async getCommunicationPrivacy(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/get_communication_privacy_settings", {
      target_club_id: id,
    });
  },

  async saveCommunicationPrivacy(clubId, settings = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_communication_privacy_settings", {
      target_club_id: id,
      settings: settings && typeof settings === "object" ? settings : {},
    });
  },

  async recordCommunicationEvent(clubId, event = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/record_communication_event", {
      target_club_id: id,
      event_data: event && typeof event === "object" ? event : {},
    });
  },

  async listCommunicationEvents(clubId, limit = 50) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_communication_events", {
      target_club_id: id,
      result_limit: Math.max(1, Math.min(Number(limit) || 50, 200)),
    }));
  },

  async purgeExpiredCommunicationEvents(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/purge_expired_communication_events", {
      target_club_id: id,
    });
  },

  async listCommunicationDeliveryBatches(clubId, limit = 25) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_communication_delivery_batches", {
      target_club_id: id,
      result_limit: Math.max(1, Math.min(Number(limit) || 25, 100)),
    }));
  },

  async exportCommunicationDeliveryData(clubId) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/export_communication_delivery_data", {
      target_club_id: id,
    });
    return result && typeof result === "object" ? result : { batches: [], deliveries: [] };
  },

  async purgeExpiredCommunicationDeliveryData(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/purge_expired_communication_delivery_data", {
      target_club_id: id,
    });
  },

  async listAnnualPlannerWorkspace(clubId, { startDate = null, endDate = null } = {}) {
    const id = requireClubId(clubId);
    const [result, schedulingContext] = await Promise.all([
      supaFetch("POST", "rpc/list_annual_planner_workspace", {
        target_club_id: id,
        range_start: startDate || null,
        range_end: endDate || null,
      }),
      supaFetch("POST", "rpc/list_annual_planner_scheduling_context", {
        target_club_id: id,
      }),
    ]);
    const base = result && typeof result === "object"
      ? result
      : { settings: {}, bookings: [], blackouts: [], winter_sites: [], winter_slots: [] };
    return { ...base, ...(schedulingContext && typeof schedulingContext === "object" ? schedulingContext : {}) };
  },

  async saveAnnualPlannerBooking(clubId, booking) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_booking_v4", {
      target_club_id: id,
      booking_data: booking && typeof booking === "object" ? booking : {},
    });
  },

  async saveAnnualPlannerBookingSeries(clubId, bookings = []) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/save_annual_planner_booking_series_v4", {
      target_club_id: id,
      booking_rows: Array.isArray(bookings) ? bookings : [],
    }));
  },

  async deleteAnnualPlannerBooking(clubId, bookingId, { deleteSeries = false } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_annual_planner_booking", {
      target_club_id: id,
      target_booking_id: bookingId,
      delete_series: Boolean(deleteSeries),
    });
  },

  async saveAnnualPlannerBlackout(clubId, blackout) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_blackout_v2", {
      target_club_id: id,
      blackout_data: blackout && typeof blackout === "object" ? blackout : {},
    });
  },

  async listAnnualPlannerClosureImpacts(clubId, { startDate = null, endDate = null } = {}) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/list_annual_planner_closure_impacts", {
      target_club_id: id,
      range_start: startDate || null,
      range_end: endDate || null,
    });
    return asArray(result);
  },

  async resolveAnnualPlannerClosureImpact(clubId, impactId, resolution = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/resolve_annual_planner_closure_impact", {
      target_club_id: id,
      target_impact_id: impactId,
      resolution_data: resolution && typeof resolution === "object" ? resolution : {},
    });
  },

  async listMyAnnualPlannerAlternatives(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_my_annual_planner_alternatives", {
      target_club_id: id,
    }));
  },

  async respondToAnnualPlannerAlternative(clubId, alternativeId, response, message = "") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/respond_to_annual_planner_alternative", {
      target_club_id: id,
      target_alternative_id: alternativeId,
      response_value: response,
      coach_message: String(message || "").trim() || null,
    });
  },

  async deleteAnnualPlannerBlackout(clubId, blackoutId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_annual_planner_blackout", {
      target_club_id: id,
      target_blackout_id: blackoutId,
    });
  },

  async saveAnnualPlannerSettings(clubId, settings) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_settings", {
      target_club_id: id,
      settings_data: settings && typeof settings === "object" ? settings : {},
    });
  },

  async saveAnnualPlannerWinterSite(clubId, site) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_winter_site", {
      target_club_id: id,
      site_data: site && typeof site === "object" ? site : {},
    });
  },

  async deleteAnnualPlannerWinterSite(clubId, siteId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_annual_planner_winter_site", {
      target_club_id: id,
      target_site_id: siteId,
    });
  },

  async saveAnnualPlannerWinterSlot(clubId, slot) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_winter_slot", {
      target_club_id: id,
      slot_data: slot && typeof slot === "object" ? slot : {},
    });
  },

  async deleteAnnualPlannerWinterSlot(clubId, slotId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_annual_planner_winter_slot", {
      target_club_id: id,
      target_slot_id: slotId,
    });
  },

  async saveAnnualPlannerResource(clubId, resource) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_resource", {
      target_club_id: id,
      resource_data: resource && typeof resource === "object" ? resource : {},
    });
  },

  async deleteAnnualPlannerResource(clubId, resourceId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_annual_planner_resource", {
      target_club_id: id,
      target_resource_id: String(resourceId || "").trim(),
    });
  },

  async saveAnnualPlannerWaitlistEntry(clubId, entry) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_waitlist_entry", {
      target_club_id: id,
      waitlist_data: entry && typeof entry === "object" ? entry : {},
    });
  },

  async offerAnnualPlannerWaitlistSlot(clubId, offer) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/offer_annual_planner_waitlist_slot", {
      target_club_id: id,
      offer_data: offer && typeof offer === "object" ? offer : {},
    });
  },

  async listMyAnnualPlannerWaitlistOffers(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_my_annual_planner_waitlist_offers", {
      target_club_id: id,
    }));
  },

  async respondToAnnualPlannerWaitlistOffer(clubId, offerId, response, message = "") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/respond_to_annual_planner_waitlist_offer", {
      target_club_id: id,
      target_offer_id: offerId,
      response_value: String(response || "").trim(),
      coach_message: String(message || "").trim() || null,
    });
  },

  async applyAnnualPlannerBulkCommand(clubId, command) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/apply_annual_planner_bulk_command", {
      target_club_id: id,
      command_data: command && typeof command === "object" ? command : {},
    });
  },

  async createAnnualPlannerCalendarFeed(clubId, feed) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_annual_planner_calendar_feed", {
      target_club_id: id,
      feed_data: feed && typeof feed === "object" ? feed : {},
    });
  },

  async revokeAnnualPlannerCalendarFeed(clubId, feedId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/revoke_annual_planner_calendar_feed", {
      target_club_id: id,
      target_feed_id: feedId,
    });
  },

  async createAnnualPlannerSeasonRollover(clubId, rollover) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_annual_planner_season_rollover", {
      target_club_id: id,
      rollover_data: rollover && typeof rollover === "object" ? rollover : {},
    });
  },

  async recordAnnualPlannerWeatherDisruption(clubId, bookingId, action, data = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/record_annual_planner_weather_disruption", {
      target_club_id: id,
      target_booking_id: bookingId,
      action_value: String(action || "postpone").trim(),
      disruption_data: data && typeof data === "object" ? data : {},
    });
  },

  async getAnnualPlannerAnalyticsData(clubId, { startDate = null, endDate = null } = {}) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/get_annual_planner_analytics_data", {
      target_club_id: id,
      range_start: startDate || null,
      range_end: endDate || null,
    });
    return result && typeof result === "object"
      ? result
      : { bookings: [], blackouts: [], winter_sites: [], winter_slots: [], requests: [], closure_impacts: [], scheduling_policies: [] };
  },

  async saveAnnualPlannerTeamPreference(clubId, preference) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_team_preference", {
      target_club_id: id,
      preference_data: preference && typeof preference === "object" ? preference : {},
    });
  },

  async saveAnnualPlannerSchedulingPolicy(clubId, policy) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_scheduling_policy", {
      target_club_id: id,
      policy_data: policy && typeof policy === "object" ? policy : {},
    });
  },

  async reviewCoachTrainingPreferenceProposal(clubId, proposalId, decision, note = "") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/review_coach_training_preference_proposal", {
      target_club_id: id,
      target_proposal_id: String(proposalId || "").trim(),
      decision_value: String(decision || "").trim(),
      decision_note: String(note || "").trim() || null,
    });
  },

  async getMyCoachTrainingPreferences(clubId) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/get_my_coach_training_preferences", {
      target_club_id: id,
    });
    return result && typeof result === "object" ? result : { policies: [], preferences: [], proposals: [] };
  },

  async submitMyCoachTrainingPreference(clubId, preference) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/submit_my_coach_training_preference", {
      target_club_id: id,
      preference_data: preference && typeof preference === "object" ? preference : {},
    });
  },

  async saveAnnualPlannerAllocationRun(clubId, run, items = []) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_annual_planner_allocation_run", {
      target_club_id: id,
      run_data: run && typeof run === "object" ? run : {},
      item_rows: Array.isArray(items) ? items : [],
    });
  },

  async publishAnnualPlannerAllocationRun(clubId, runId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/publish_annual_planner_allocation_run", {
      target_club_id: id,
      target_run_id: String(runId || "").trim(),
    });
  },


  async syncCoachHubContacts(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/sync_coach_hub_contacts", {
      target_club_id: id,
    });
  },

  async listCoachHubAdminWorkspace(clubId) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/list_coach_hub_admin_workspace", {
      target_club_id: id,
    });
    return result && typeof result === "object"
      ? result
      : { people: [], assignments: [], invitations: [], requests: [] };
  },

  async listCoachHubRequestQueue(clubId) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/list_coach_hub_request_queue", {
      target_club_id: id,
    });
    return result && typeof result === "object"
      ? result
      : { requests: [] };
  },

  async createCoachHubInvitation(clubId, personId, expiryHours = 168) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_coach_hub_invitation", {
      target_club_id: id,
      target_person_id: personId,
      expiry_hours: Math.max(24, Math.min(Number(expiryHours) || 168, 720)),
    });
  },

  async reissueCoachHubAccess(clubId, personId, expiryHours = 168) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/reissue_coach_hub_access", {
      target_club_id: id,
      target_person_id: personId,
      expiry_hours: Math.max(24, Math.min(Number(expiryHours) || 168, 720)),
    });
  },

  async acceptCoachHubInvitation(token) {
    return supaFetch("POST", "rpc/accept_coach_hub_invitation", {
      invitation_token: String(token || "").trim(),
    });
  },

  async claimPendingCoachHubInvitations() {
    const result = await supaFetch("POST", "rpc/claim_my_pending_coach_hub_invitations", {});
    return result && typeof result === "object"
      ? result
      : { claimed_count: 0, repaired_count: 0, club_ids: [] };
  },

  async getCoachHubWorkspace(clubId, { startDate = null, endDate = null } = {}) {
    const id = requireClubId(clubId);
    const [result, calendarContext, winterContext] = await Promise.all([
      supaFetch("POST", "rpc/get_coach_hub_workspace", {
        target_club_id: id,
        range_start: startDate || null,
        range_end: endDate || null,
      }),
      supaFetch("POST", "rpc/get_coach_hub_calendar_context", {
        target_club_id: id,
        range_start: startDate || null,
        range_end: endDate || null,
      }),
      supaFetch("POST", "rpc/get_coach_hub_winter_inventory", {
        target_club_id: id,
      }),
    ]);
    const base = result && typeof result === "object"
      ? result
      : { club: {}, person: {}, assignments: [], bookings: [], requests: [], messages: [], team_contacts: [] };
    return { ...base, ...(calendarContext && typeof calendarContext === "object" ? calendarContext : {}), ...(winterContext && typeof winterContext === "object" ? winterContext : {}) };
  },

  async syncMatchdayCalendar(clubId, { dayScope, matchdayDate, fixtures = [] } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/sync_matchday_calendar", {
      target_club_id: id,
      day_scope: String(dayScope || "").trim().toLowerCase(),
      matchday_date: matchdayDate || null,
      fixture_rows: Array.isArray(fixtures) ? fixtures : [],
    });
  },

  async ensureMyCoachHubRoleAccess(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/ensure_my_coach_hub_role_access", { target_club_id: id });
  },

  async checkCoachHubRequestAvailability(clubId, request) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/check_coach_hub_request_availability", {
      target_club_id: id,
      request_data: request && typeof request === "object" ? request : {},
    });
    return result && typeof result === "object" ? result : { available: false, status: "unavailable", reasons: [], alternatives: [] };
  },

  async submitCoachHubRequest(clubId, request) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/submit_coach_hub_request_v2", {
      target_club_id: id,
      request_data: request && typeof request === "object" ? request : {},
    });
  },

  async updateMyCoachHubRequest(clubId, requestId, request) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/update_my_coach_hub_request_v2", {
      target_club_id: id,
      target_request_id: String(requestId || "").trim(),
      request_data: request && typeof request === "object" ? request : {},
    });
  },

  async reviewCoachHubRequest(clubId, requestId, decision, data = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/review_coach_hub_request_v2", {
      target_club_id: id,
      target_request_id: requestId,
      decision: String(decision || "").trim(),
      decision_data: data && typeof data === "object" ? data : {},
    });
  },

  async respondToCoachHubAlternative(clubId, requestId, response, message = "") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/respond_to_coach_hub_alternative", {
      target_club_id: id,
      target_request_id: requestId,
      response_value: String(response || "").trim(),
      coach_message: String(message || "").trim() || null,
    });
  },

  async markCoachHubMessage(clubId, messageId, acknowledge = false) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/mark_coach_hub_message", {
      target_club_id: id,
      target_message_id: messageId,
      acknowledge: Boolean(acknowledge),
    });
  },

  async publishCoachHubMatchweekMessages(clubId, messages = [], approval = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/publish_coach_hub_matchweek_messages", {
      target_club_id: id,
      messages: Array.isArray(messages) ? messages : [],
      target_day_scope: String(approval?.dayScope || "").trim() || null,
      target_matchday_date: String(approval?.matchdayDate || "").trim() || null,
      target_snapshot_hash: String(approval?.snapshotHash || "").trim() || null,
    });
  },

  async listCoachHubMatchweekDeliveryStatus(clubId, limit = 30) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/list_coach_hub_matchweek_delivery_status", {
      target_club_id: id,
      result_limit: Math.max(1, Math.min(Number(limit) || 30, 100)),
    });
    return Array.isArray(result) ? result : [];
  },

  async updateMyCoachHubProfile(clubId, profile) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/update_my_coach_hub_profile", {
      target_club_id: id,
      profile_data: profile && typeof profile === "object" ? profile : {},
    });
  },

  async createCoachHubCalendarFeed(clubId, label = "My team calendar") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_coach_hub_calendar_feed", {
      target_club_id: id,
      label_value: String(label || "My team calendar").trim(),
    });
  },

  async createCoachHubTeamCalendarFeed(clubId, teamKey = "", label = "My team calendar") {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_coach_hub_team_calendar_feed", {
      target_club_id: id,
      team_key_value: String(teamKey || "").trim() || null,
      label_value: String(label || "My team calendar").trim(),
    });
  },

  async listCoachHubRequestThread(clubId, requestId) {
    const id = requireClubId(clubId);
    const result = await supaFetch("POST", "rpc/list_coach_hub_request_thread", {
      target_club_id: id,
      target_request_id: requestId,
    });
    return result && typeof result === "object" ? result : { request: {}, messages: [] };
  },

  async postCoachHubRequestMessage(clubId, requestId, body) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/post_coach_hub_request_message", {
      target_club_id: id,
      target_request_id: requestId,
      message_body: String(body || "").trim(),
    });
  },

  async verifyMyCoachHubContact(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/verify_my_coach_hub_contact", {
      target_club_id: id,
    });
  },

  async replaceCoachHubContact(clubId, personId, replacement) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/replace_coach_hub_contact", {
      target_club_id: id,
      target_person_id: personId,
      replacement_data: replacement && typeof replacement === "object" ? replacement : {},
    });
  },

  async upsertCoachHubPerson(clubId, person = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/upsert_coach_hub_person", {
      target_club_id: id,
      person_data: person && typeof person === "object" ? person : {},
    });
  },

  async saveCoachHubTeamAssignment(clubId, assignment = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_coach_hub_team_assignment", {
      target_club_id: id,
      assignment_data: assignment && typeof assignment === "object" ? assignment : {},
    });
  },

  async unassignCoachHubTeamAssignment(clubId, assignmentId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_coach_hub_team_assignment", {
      target_club_id: id,
      target_assignment_id: String(assignmentId || "").trim(),
    });
  },

  async deleteCoachHubTeamAssignment(clubId, assignmentId) {
    return this.unassignCoachHubTeamAssignment(clubId, assignmentId);
  },

  async archiveCoachHubPerson(clubId, personId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/archive_coach_hub_person", {
      target_club_id: id,
      target_person_id: String(personId || "").trim(),
    });
  },

  async listCoachHubPilotMetrics(clubId, { startDate = null, endDate = null } = {}) {
    const id = requireClubId(clubId);
    const emptyMetrics = {
      people: [],
      assignments: [],
      invitations: [],
      requests: [],
      messages: [],
      reminders: [],
      bookings: [],
    };

    try {
      const result = await supaFetch("POST", "rpc/list_coach_hub_pilot_metrics", {
        target_club_id: id,
        range_start: startDate || null,
        range_end: endDate || null,
      });
      return result && typeof result === "object" ? { ...emptyMetrics, ...result, unavailable: false } : emptyMetrics;
    } catch (error) {
      // Pilot metrics are supplementary. A reporting RPC fault must never prevent
      // Annual Planner, Coach Hub settings or core booking operations from loading.
      if (error instanceof SupabaseRequestError && Number(error.status || 0) >= 400) {
        return {
          ...emptyMetrics,
          unavailable: true,
          unavailableCode: String(error.code || "COACH_HUB_METRICS_UNAVAILABLE"),
        };
      }
      throw error;
    }
  },

  async reconcileAnnualPlannerBookingCost(clubId, bookingId, reconciliation = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/reconcile_annual_planner_booking_cost", {
      target_club_id: id,
      target_booking_id: String(bookingId || "").trim(),
      reconciliation_data: {
        status: String(reconciliation.status || "reconciled").trim(),
        reference: String(reconciliation.reference || "").trim() || null,
      },
    });
  },

  async loadPitches(clubId) {
    return DB.load("pitches", clubId);
  },

  async loadPitchClosures(clubId) {
    return DB.load("pitch_closures", clubId, { order: "id.asc" });
  },

  async loadClub(clubId) {
    const id = requireClubId(clubId);
    const rows = await supaFetch(
      "GET",
      `club_config?select=data&club_id=eq.${encodeFilter(id)}&id=eq.club&limit=1`
    );
    return Array.isArray(rows) && rows.length ? rows[0].data : null;
  },

  async loadTestFixtures(clubId, configKey) {
    const id = requireClubId(clubId);
    const key = String(configKey || "").trim();
    const rows = await supaFetch(
      "GET",
      `club_config?select=data&club_id=eq.${encodeFilter(id)}&id=eq.${encodeFilter(key)}&limit=1`
    );
    return Array.isArray(rows) && rows.length ? rows[0].data?.fixtures || [] : [];
  },

  async saveClub(clubId, config) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_club_configuration", {
      target_club_id: id,
      configuration: config || {},
    });
  },

  async savePitches(clubId, pitches) {
    return replaceCollection(
      clubId,
      "pitches",
      (Array.isArray(pitches) ? pitches : []).map((pitch, index) => ({
        id: String(pitch?.id ?? index),
        data: pitch,
      }))
    );
  },

  async saveRefs(clubId, refs) {
    return replaceCollection(
      clubId,
      "refs",
      (Array.isArray(refs) ? refs : []).map((referee, index) => ({
        id: String(referee?.id ?? `ref_${index}`),
        data: referee,
      }))
    );
  },

  async saveTeamCfg(clubId, config) {
    return replaceCollection(
      clubId,
      "team_config",
      (Array.isArray(config) ? config : []).map((team, index) => ({
        id: String(team?.id ?? `team_${index}`),
        data: team,
      }))
    );
  },

  async previewClubPilotActivityReset(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/reset_club_pilot_activity", {
      target_club_id: id,
      dry_run: true,
    });
  },

  async resetClubPilotActivity(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/reset_club_pilot_activity", {
      target_club_id: id,
      dry_run: false,
    });
  },

  async savePitchClosures(clubId, closures) {
    return replaceCollection(
      clubId,
      "pitch_closures",
      (Array.isArray(closures) ? closures : []).map((closure, index) => ({
        id: String(closure?.id ?? `closure_${index}`),
        data: closure,
      }))
    );
  },

  async saveHistoryEntry(clubId, entry) {
    const id = requireClubId(clubId);
    if (!entry?.id) throw new SupabaseRequestError("History entry requires an id", { code: "INVALID_HISTORY_ENTRY" });
    return supaFetch("POST", "rpc/save_matchweek_history", {
      target_club_id: id,
      history_id: String(entry.id),
      history_data: entry,
      history_saved_at: entry.savedAt || new Date().toISOString(),
    });
  },

  async saveHistory(clubId, entries) {
    const rows = Array.isArray(entries) ? entries : [];
    for (const entry of rows) await DB.saveHistoryEntry(clubId, entry);
    return true;
  },

  async saveTestFixtures(clubId, configKey, fixtures) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_test_fixtures", {
      target_club_id: id,
      config_key: String(configKey || "").trim(),
      fixtures: Array.isArray(fixtures) ? fixtures : [],
    });
  },

  async deleteHistory(clubId, historyId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/delete_matchweek_history", {
      target_club_id: id,
      history_id: String(historyId),
    });
  },

  async listClubMembers(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_club_members", { target_club_id: id }));
  },

  async listClubInvitations(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_club_invitations", { target_club_id: id }));
  },

  async createClubInvitation(clubId, { email, role = "viewer", expiryHours = 72, responsibilities = [] } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_club_invitation", {
      target_club_id: id,
      invite_email: String(email || "").trim(),
      invite_role: String(role || "viewer").trim(),
      expiry_hours: Number(expiryHours) || 72,
      invite_responsibilities: Array.isArray(responsibilities) ? responsibilities.map((assignment) => ({
        role: String(assignment?.role || "").trim(),
        scope_type: String(assignment?.scopeType || assignment?.scope_type || "club").trim(),
        scope_id: assignment?.scopeId || assignment?.scope_id || null,
      })) : [],
    });
  },

  async revokeClubInvitation(clubId, invitationId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/revoke_club_invitation", {
      target_club_id: id,
      invitation_id: invitationId,
    });
  },

  async acceptClubInvitation(token) {
    return supaFetch("POST", "rpc/accept_club_invitation", {
      invitation_token: String(token || "").trim(),
    });
  },

  async updateClubMemberRole(clubId, userId, role) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/update_club_member_role", {
      target_club_id: id,
      target_user_id: userId,
      next_role: role,
    });
  },

  async addClubMemberRole(clubId, userId, role, { scopeType = "club", scopeId = null } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/add_club_member_role", {
      target_club_id: id,
      target_user_id: userId,
      role_code: String(role || "").trim(),
      scope_type: String(scopeType || "club").trim(),
      scope_id: String(scopeType || "club").trim() === "club" ? "__club__" : scopeId || null,
    });
  },

  async removeClubMemberRole(clubId, userId, role, { scopeType = "club", scopeId = null } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/remove_club_member_role", {
      target_club_id: id,
      target_user_id: userId,
      role_code: String(role || "").trim(),
      scope_type: String(scopeType || "club").trim(),
      scope_id: String(scopeType || "club").trim() === "club" ? "__club__" : scopeId || null,
    });
  },

  async removeClubMember(clubId, userId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/remove_club_member", {
      target_club_id: id,
      target_user_id: userId,
    });
  },

  async transferClubOwnership(clubId, userId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/transfer_club_ownership", {
      target_club_id: id,
      new_owner_user_id: userId,
    });
  },

  async listSupportSessions(clubId) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_support_access_sessions", { target_club_id: id }));
  },

  async grantSupportAccess(clubId, { email, durationMinutes = 60, reason } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/grant_support_access", {
      target_club_id: id,
      support_email: String(email || "").trim(),
      duration_minutes: Number(durationMinutes) || 60,
      support_reason: String(reason || "").trim(),
    });
  },

  async revokeSupportAccess(clubId, supportSessionId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/revoke_support_access", {
      target_club_id: id,
      support_session_id: supportSessionId,
    });
  },

  async endOwnSupportSession(supportSessionId) {
    return supaFetch("POST", "rpc/end_own_support_session", {
      support_session_id: supportSessionId,
    });
  },

  async recordSupportWorkspaceOpen(clubId, supportSessionId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/record_support_workspace_open", {
      target_club_id: id,
      support_session_id: supportSessionId,
    });
  },

  async listAuditEvents(clubId, limit = 50) {
    const id = requireClubId(clubId);
    return asArray(await supaFetch("POST", "rpc/list_audit_events", {
      target_club_id: id,
      result_limit: Math.max(1, Math.min(Number(limit) || 50, 100)),
    }));
  },

  async getClubSubscription(clubId) {
    const id = requireClubId(clubId);
    const [subscription, productEntitlements] = await Promise.all([
      supaFetch("POST", "rpc/get_club_subscription", { target_club_id: id }),
      supaFetch("POST", "rpc/get_club_product_entitlements", { target_club_id: id }),
    ]);
    return Object.assign({}, subscription, {
      product_entitlements: Array.isArray(productEntitlements) ? productEntitlements : null,
    });
  },

  async getBillingLegalStatus(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/get_billing_legal_status", {
      target_club_id: id,
    });
  },

  async acceptBillingLegalDocuments(clubId, documents, authorityConfirmed = false) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/accept_billing_legal_documents", {
      target_club_id: id,
      accepted_documents: documents && typeof documents === "object" ? documents : {},
      authority_confirmed: Boolean(authorityConfirmed),
      browser_user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });
  },

  async createCheckoutSession(clubId, planCode, billingInterval = "monthly") {
    const id = requireClubId(clubId);
    return invokeEdgeFunction("create-checkout-session", {
      clubId: id,
      planCode: String(planCode || "").trim().toLowerCase(),
      billingInterval: String(billingInterval || "monthly").trim().toLowerCase(),
    });
  },

  async createBillingPortal(clubId) {
    const id = requireClubId(clubId);
    return invokeEdgeFunction("create-billing-portal", { clubId: id });
  },

  async platformSetClubSubscription(clubId, {
    planCode,
    status,
    billingInterval = "monthly",
    trialEndsAt = null,
    graceEndsAt = null,
    currentPeriodEnd = null,
    cancelAtPeriodEnd = false,
    billingExempt = false,
    entitlementOverrides = {},
    limitOverrides = {},
    reason = "Manual platform assignment",
  } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/platform_set_club_subscription", {
      target_club_id: id,
      next_plan_code: String(planCode || "core").trim().toLowerCase(),
      next_status: String(status || "active").trim().toLowerCase(),
      next_billing_interval: String(billingInterval || "monthly").trim().toLowerCase(),
      next_trial_ends_at: trialEndsAt,
      next_grace_ends_at: graceEndsAt,
      next_current_period_end: currentPeriodEnd,
      next_cancel_at_period_end: Boolean(cancelAtPeriodEnd),
      next_billing_exempt: Boolean(billingExempt),
      next_entitlement_overrides: entitlementOverrides && typeof entitlementOverrides === "object" ? entitlementOverrides : {},
      next_limit_overrides: limitOverrides && typeof limitOverrides === "object" ? limitOverrides : {},
      change_reason: String(reason || "Manual platform assignment").trim(),
    });
  },

  async platformSetClubProductEntitlements(clubId, productEntitlements = [], reason = "Manual product access update") {
    const id = requireClubId(clubId);
    const products = Array.isArray(productEntitlements)
      ? productEntitlements.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
      : [];
    return supaFetch("POST", "rpc/platform_set_club_product_entitlements", {
      target_club_id: id,
      next_product_entitlements: products,
      change_reason: String(reason || "Manual product access update").trim(),
    });
  },


  async listAccessibleLeagues() {
    return asArray(await supaFetch("POST", "rpc/list_accessible_leagues", {}));
  },

  async createLeaguePilot({
    name,
    countryCode = "GB-ENG",
    governingBody = "",
    timezone = "Europe/London",
    seasonName = "",
    seasonStart = null,
    seasonEnd = null,
    defaultKickOff = "",
    primaryWeekday = 6,
  } = {}) {
    return supaFetch("POST", "rpc/platform_create_league_pilot", {
      league_name: String(name || "").trim(),
      league_country_code: String(countryCode || "GB-ENG").trim(),
      league_governing_body: String(governingBody || "").trim() || null,
      league_timezone: String(timezone || "Europe/London").trim(),
      initial_season_name: String(seasonName || "").trim() || null,
      initial_season_start: seasonStart || null,
      initial_season_end: seasonEnd || null,
      initial_default_kick_off: String(defaultKickOff || "").slice(0, 5) || null,
      initial_primary_weekday: Number(primaryWeekday),
    });
  },

  async getLeagueWorkspace(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_workspace", { target_league_id: id });
  },

  async upsertLeagueEntity(leagueId, entityType, entityData = {}) {
    const id = requireLeagueId(leagueId);
    const safeType = String(entityType || "").trim().toLowerCase();
    const endpoint = ["season", "division"].includes(safeType)
      ? "rpc/upsert_league_schedule_settings_entity"
      : "rpc/upsert_league_entity";
    return supaFetch("POST", endpoint, {
      target_league_id: id,
      entity_type: safeType,
      entity_data: entityData && typeof entityData === "object" ? entityData : {},
    });
  },

  async deleteLeagueEntity(leagueId, entityType, entityId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/delete_league_entity", {
      target_league_id: id,
      entity_type: String(entityType || "").trim().toLowerCase(),
      target_entity_id: String(entityId || "").trim(),
    });
  },

  async importLeagueStructure(leagueId, seasonId, rows = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/import_league_structure", {
      target_league_id: id,
      target_season_id: String(seasonId || "").trim(),
      structure_rows: Array.isArray(rows) ? rows : [],
    });
  },

  async resequenceLeagueDivisions(leagueId, seasonId = null) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/resequence_league_divisions", {
      target_league_id: id,
      target_season_id: seasonId ? String(seasonId).trim() : null,
    });
  },

  async importLeagueFixtures(leagueId, rows = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/import_league_fixtures", {
      target_league_id: id,
      fixture_rows: Array.isArray(rows) ? rows : [],
    });
  },

  async createLeagueInvitation(leagueId, { email, role = "viewer", expiryHours = 168 } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/create_league_invitation", {
      target_league_id: id,
      invite_email: String(email || "").trim(),
      invite_role: String(role || "viewer").trim().toLowerCase(),
      expiry_hours: Math.max(1, Math.min(Number(expiryHours) || 168, 720)),
    });
  },

  async acceptLeagueInvitation(token) {
    return supaFetch("POST", "rpc/accept_league_invitation", {
      invitation_token: String(token || "").trim(),
    });
  },

  async revokeLeagueInvitation(leagueId, invitationId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/revoke_league_invitation", {
      target_league_id: id,
      invitation_id: String(invitationId || "").trim(),
    });
  },

  async updateLeagueMemberRole(leagueId, userId, role) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_member_role", {
      target_league_id: id,
      target_user_id: String(userId || "").trim(),
      next_role: String(role || "viewer").trim().toLowerCase(),
    });
  },

  async removeLeagueMember(leagueId, userId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/remove_league_member", {
      target_league_id: id,
      target_user_id: String(userId || "").trim(),
    });
  },

  async setLeagueVenueSchedulingCapacity(leagueId, venueId, simultaneousLimit = 1) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/set_league_venue_scheduling_capacity", {
      target_league_id: id,
      target_venue_id: String(venueId || "").trim(),
      simultaneous_limit: Math.max(1, Math.min(Number(simultaneousLimit) || 1, 20)),
    });
  },

  async generateLeaguePlayingDateCalendar(leagueId, {
    seasonId,
    weekday = 6,
    defaultKickOff = "",
    divisionId = null,
  } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/generate_league_playing_date_calendar", {
      target_league_id: id,
      target_season_id: String(seasonId || "").trim(),
      weekday_numbers: [Math.max(0, Math.min(Number(weekday) || 0, 6))],
      default_kick_off: String(defaultKickOff || "").slice(0, 5) || null,
      target_division_id: divisionId ? String(divisionId).trim() : null,
    });
  },

  async synchroniseLeagueSeasonCalendar(leagueId, seasonId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/synchronise_league_season_calendar", {
      target_league_id: id,
      target_season_id: String(seasonId || "").trim(),
    });
  },

  async upsertLeagueCup(leagueId, cupData = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_cup", {
      target_league_id: id,
      cup_data: cupData && typeof cupData === "object" ? cupData : {},
    });
  },

  async setLeagueCupEligibility(leagueId, cupId, { divisionIds = [], includedTeamIds = [], excludedTeamIds = [] } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/set_league_cup_eligibility", {
      target_league_id: id,
      target_cup_id: String(cupId || "").trim(),
      division_ids: Array.isArray(divisionIds) ? divisionIds : [],
      included_team_ids: Array.isArray(includedTeamIds) ? includedTeamIds : [],
      excluded_team_ids: Array.isArray(excludedTeamIds) ? excludedTeamIds : [],
    });
  },

  async saveLeagueCupRoundDraw(leagueId, cupId, roundData = {}, ties = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/save_league_cup_round_draw", {
      target_league_id: id,
      target_cup_id: String(cupId || "").trim(),
      round_data: roundData && typeof roundData === "object" ? roundData : {},
      tie_rows: Array.isArray(ties) ? ties.map((tie) => ({
        tie_number: Number(tie?.tieNumber || 0),
        home_team_id: tie?.homeTeamId || null,
        away_team_id: tie?.awayTeamId || null,
        venue_id: tie?.venueId || null,
        scheduled_date: tie?.scheduledDate || null,
        kick_off: tie?.kickOff || null,
        status: tie?.status || "scheduled",
        winner_team_id: tie?.winnerTeamId || null,
        locked: Boolean(tie?.locked),
        notes: tie?.notes || null,
      })) : [],
    });
  },

  async updateLeagueCupTie(leagueId, tieId, tieData = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_cup_tie", {
      target_league_id: id,
      target_tie_id: String(tieId || "").trim(),
      tie_data: tieData && typeof tieData === "object" ? tieData : {},
    });
  },

  async deleteLeagueCup(leagueId, cupId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/delete_league_cup", {
      target_league_id: id,
      target_cup_id: String(cupId || "").trim(),
    });
  },

  async listLeagueScheduleVersions(leagueId, seasonId = null) {
    const id = requireLeagueId(leagueId);
    return asArray(await supaFetch("POST", "rpc/list_league_schedule_versions", {
      target_league_id: id,
      target_season_id: seasonId ? String(seasonId).trim() : null,
    }));
  },

  async getLeagueScheduleVersion(leagueId, versionId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_schedule_version", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
    });
  },

  async saveLeagueScheduleDraft(leagueId, {
    seasonId,
    name,
    generationConfig = {},
    entries = [],
    parentVersionId = null,
    source = "generated",
  } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/save_league_schedule_draft", {
      target_league_id: id,
      target_season_id: String(seasonId || "").trim(),
      draft_name: String(name || "").trim(),
      generation_config: generationConfig && typeof generationConfig === "object" ? generationConfig : {},
      schedule_entries: Array.isArray(entries) ? entries : [],
      parent_version_id: parentVersionId ? String(parentVersionId).trim() : null,
      draft_source: String(source || "generated").trim().toLowerCase(),
    });
  },

  async updateLeagueScheduleEntry(leagueId, versionId, entryId, {
    scheduledDate = null,
    kickOff = null,
    venueId = null,
    locked = false,
    notes = null,
  } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_schedule_entry", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
      target_entry_id: String(entryId || "").trim(),
      next_scheduled_date: scheduledDate || null,
      next_kick_off: kickOff || null,
      next_venue_id: venueId || null,
      next_locked: Boolean(locked),
      next_notes: notes || null,
    });
  },

  async updateLeagueScheduleEntries(leagueId, versionId, updates = []) {
    const id = requireLeagueId(leagueId);
    const entryUpdates = Array.isArray(updates) ? updates : [];
    if (!entryUpdates.length) return { updated: 0 };
    return supaFetch("POST", "rpc/update_league_schedule_entries", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
      entry_updates: entryUpdates.map((update) => ({
        id: String(update?.id || "").trim(),
        scheduled_date: update?.scheduledDate || null,
        kick_off: update?.scheduledDate ? update?.kickOff || null : null,
        venue_id: update?.venueId || null,
        locked: Boolean(update?.locked),
        notes: update?.notes || null,
      })),
    });
  },

  async validateLeagueScheduleVersion(leagueId, versionId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/validate_league_schedule_version", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
    });
  },

  async publishLeagueScheduleVersion(leagueId, versionId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/publish_league_schedule_version", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
    });
  },

  async cloneLeagueScheduleVersion(leagueId, versionId, name = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/clone_league_schedule_version", {
      target_league_id: id,
      source_version_id: String(versionId || "").trim(),
      next_name: String(name || "").trim() || null,
    });
  },

  async deleteLeagueScheduleVersion(leagueId, versionId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/delete_league_schedule_version", {
      target_league_id: id,
      target_version_id: String(versionId || "").trim(),
    });
  },

  async getLeagueOperationsData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_operations_data", { target_league_id: id });
  },

  async upsertLeagueOfficial(leagueId, officialData = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_official", {
      target_league_id: id,
      official_data: {
        id: officialData.id || null,
        name: String(officialData.name || "").trim(),
        email: String(officialData.email || "").trim() || null,
        phone: String(officialData.phone || "").trim() || null,
        grade: String(officialData.grade || "").trim() || null,
        home_postcode: String(officialData.homePostcode || "").trim() || null,
        travel_radius_miles: Number(officialData.travelRadiusMiles || 35),
        max_appointments_per_day: Number(officialData.maxAppointmentsPerDay || 1),
        max_appointments_per_week: Number(officialData.maxAppointmentsPerWeek || 2),
        can_referee: Boolean(officialData.canReferee),
        can_assistant: Boolean(officialData.canAssistant),
        can_fourth: Boolean(officialData.canFourth),
        can_observe: Boolean(officialData.canObserve),
        status: String(officialData.status || "active"),
        notes: String(officialData.notes || "").trim() || null,
      },
    });
  },

  async deactivateLeagueOfficial(leagueId, officialId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/deactivate_league_official", {
      target_league_id: id,
      target_official_id: String(officialId || "").trim(),
    });
  },

  async upsertLeagueOfficialAvailability(leagueId, officialId, availability = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_official_availability", {
      target_league_id: id,
      target_official_id: String(officialId || "").trim(),
      availability_data: {
        id: availability.id || null,
        available_on: availability.availableOn || null,
        starts_at: availability.startsAt || null,
        ends_at: availability.endsAt || null,
        availability_status: availability.availabilityStatus || "available",
        notes: availability.notes || null,
      },
    });
  },

  async upsertLeagueOfficialConflict(leagueId, officialId, conflict = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_official_conflict", {
      target_league_id: id,
      target_official_id: String(officialId || "").trim(),
      conflict_data: {
        id: conflict.id || null,
        conflict_type: conflict.conflictType || "club",
        parent_club_id: conflict.parentClubId || null,
        team_id: conflict.teamId || null,
        reason: conflict.reason || null,
      },
    });
  },

  async upsertLeagueOfficialRequirement(leagueId, requirement = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_official_requirement", {
      target_league_id: id,
      requirement_data: {
        id: requirement.id || null,
        scope_type: requirement.scopeType,
        scope_id: requirement.scopeId,
        referee_count: Number(requirement.refereeCount || 0),
        assistant_count: Number(requirement.assistantCount || 0),
        fourth_official_count: Number(requirement.fourthOfficialCount || 0),
        observer_count: Number(requirement.observerCount || 0),
        minimum_grade: requirement.minimumGrade || null,
      },
    });
  },

  async bulkUpsertLeagueOfficialAssignments(leagueId, appointments = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/bulk_upsert_league_official_assignments", {
      target_league_id: id,
      appointment_rows: (Array.isArray(appointments) ? appointments : []).map((row) => ({
        official_id: row.officialId,
        target_type: row.targetType,
        target_id: row.targetId,
        role: row.role,
        status: row.status || "proposed",
        notes: row.notes || null,
      })),
    });
  },

  async updateLeagueOfficialAssignmentStatus(leagueId, assignmentId, status) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_official_assignment_status", {
      target_league_id: id,
      target_assignment_id: String(assignmentId || "").trim(),
      next_status: String(status || "").trim(),
    });
  },

  async updateLeagueVenueMapPosition(leagueId, venueId, latitude, longitude) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_venue_map_position", {
      target_league_id: id,
      target_venue_id: String(venueId || "").trim(),
      target_latitude: Number(latitude),
      target_longitude: Number(longitude),
    });
  },

  async geocodeLeagueVenuePostcodes(leagueId, venues = []) {
    const id = requireLeagueId(leagueId);
    const session = await Auth.getValidSession();
    if (!session?.access_token) throw new SupabaseRequestError("Sign in again to continue", { status: 401, code: "AUTH_REQUIRED", path: "/api/league/geocode-venues" });
    const response = await fetch("/api/league/geocode-venues", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leagueId: id, venues }),
    });
    const payload = await readResponse(response);
    if (!response.ok) throw new SupabaseRequestError(responseError(payload, "Venue postcodes could not be geocoded"), { status: response.status, code: "VENUE_GEOCODING_FAILED", details: payload, path: "/api/league/geocode-venues" });
    return payload || { coordinates: [], unmatched: [] };
  },

  async bulkUpdateLeagueVenueMapPositions(leagueId, coordinates = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/bulk_update_league_venue_map_positions", {
      target_league_id: id,
      coordinate_rows: (Array.isArray(coordinates) ? coordinates : []).map((row) => ({
        venue_id: row.id || row.venueId,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        coordinate_source: row.source || row.coordinateSource || "postcode_centroid",
        coordinate_accuracy: row.accuracy || row.coordinateAccuracy || "postcode",
      })),
    });
  },

  async upsertLeaguePostponement(leagueId, data = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_postponement", {
      target_league_id: id,
      postponement_data: {
        id: data.id || null,
        target_type: data.targetType,
        target_id: data.targetId,
        requested_by_club_id: data.requestedByClubId || null,
        reason_category: data.reasonCategory || "other",
        reason: data.reason || "",
        status: data.status || "requested",
        original_date: data.originalDate || null,
        original_kick_off: data.originalKickOff || null,
        original_venue_id: data.originalVenueId || null,
        proposed_dates: Array.isArray(data.proposedDates) ? data.proposedDates : [],
        deadline_on: data.deadlineOn || null,
        notes: data.notes || null,
      },
    });
  },

  async updateLeaguePostponementStatus(leagueId, postponementId, status) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_postponement_status", {
      target_league_id: id,
      target_postponement_id: String(postponementId || "").trim(),
      next_status: String(status || "").trim(),
    });
  },

  async saveLeaguePostponementSuggestions(leagueId, postponementId, suggestions = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/save_league_postponement_suggestions", {
      target_league_id: id,
      target_postponement_id: String(postponementId || "").trim(),
      suggestion_rows: Array.isArray(suggestions) ? suggestions : [],
    });
  },

  async applyLeaguePostponementRearrangement(leagueId, postponementId, suggestion = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/apply_league_postponement_rearrangement", {
      target_league_id: id,
      target_postponement_id: String(postponementId || "").trim(),
      rearranged_date: String(suggestion.date || "").trim(),
      rearranged_kick_off: String(suggestion.kickOff || "").trim() || null,
      rearranged_venue_id: String(suggestion.venueId || "").trim() || null,
    });
  },

  async getLeagueClubOperationsData(leagueId) {
    const id = requireLeagueId(leagueId);
    const request = () => supaFetch("POST", "rpc/get_league_club_operations_data", { target_league_id: id });
    try {
      return await request();
    } catch (error) {
      const schemaCacheMiss = error?.code === "PGRST202"
        || /schema cache|could not find the function/i.test(String(error?.message || ""));
      if (!schemaCacheMiss) throw error;
      await new Promise((resolve) => setTimeout(resolve, 650));
      try {
        return await request();
      } catch (retryError) {
        if (retryError?.code === "PGRST202" || /schema cache|could not find the function/i.test(String(retryError?.message || ""))) {
          throw new SupabaseRequestError(
            "Club Operations is waiting for the latest database migration. Run npx supabase db push, wait a few seconds, then refresh the workspace.",
            { status: retryError?.status || 404, code: "LEAGUE_CLUB_OPERATIONS_RPC_MISSING", details: retryError?.details, path: "rpc/get_league_club_operations_data" },
          );
        }
        throw retryError;
      }
    }
  },

  async getLeagueClubPortalData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_club_portal_data", { target_league_id: id });
  },

  async getLeagueResultsData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_results_data", { target_league_id: id });
  },

  async getLeagueClubResultsData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_club_results_data", { target_league_id: id });
  },

  async getLeagueDisciplineData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_discipline_data", { target_league_id: id });
  },

  async getLeagueClubDisciplineData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_club_discipline_data", { target_league_id: id });
  },

  async upsertLeagueDisciplineCase(leagueId, data = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_discipline_case", {
      target_league_id: id,
      case_data: {
        id: data.id || null,
        season_id: data.seasonId || null,
        case_reference: data.caseReference || null,
        case_type: data.caseType || "misconduct",
        status: data.status || "draft",
        priority: data.priority || "normal",
        title: String(data.title || "").trim(),
        summary: String(data.summary || "").trim(),
        incident_on: data.incidentOn || null,
        response_due_on: data.responseDueOn || null,
        hearing_on: data.hearingOn || null,
        hearing_location: String(data.hearingLocation || "").trim() || null,
        hearing_panel: Array.isArray(data.hearingPanel) ? data.hearingPanel : [],
        decision_on: data.decisionOn || null,
        publication_fixture_id: data.publicationFixtureId || null,
        target_type: data.targetType || null,
        target_id: data.targetId || null,
        reporting_club_id: data.reportingClubId || null,
        respondent_club_id: data.respondentClubId || null,
        respondent_team_id: data.respondentTeamId || null,
        assigned_to: data.assignedTo || null,
        confidential: Boolean(data.confidential),
        club_response_required: Boolean(data.clubResponseRequired),
      },
    });
  },

  async updateLeagueDisciplineCaseStatus(leagueId, caseId, status, note = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_discipline_case_status", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      next_status: String(status || "").trim(),
      status_note: String(note || "").trim(),
    });
  },

  async addLeagueCaseEvent(leagueId, caseId, event = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/add_league_case_event", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      event_data: {
        event_type: event.eventType || "note",
        visibility: event.visibility || "league",
        title: String(event.title || "Case note").trim(),
        detail: String(event.detail || "").trim(),
        event_data: event.eventData && typeof event.eventData === "object" ? event.eventData : {},
      },
    });
  },

  async upsertLeagueCaseCharge(leagueId, caseId, charge = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_case_charge", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      charge_data: {
        id: charge.id || null,
        charge_code: String(charge.chargeCode || "").trim() || null,
        title: String(charge.title || "").trim(),
        description: String(charge.description || "").trim(),
        rule_reference: String(charge.ruleReference || "").trim() || null,
        status: charge.status || "alleged",
        decision_reason: String(charge.decisionReason || "").trim() || null,
      },
    });
  },

  async upsertLeagueCaseSanction(leagueId, caseId, sanction = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_case_sanction", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      sanction_data: {
        id: sanction.id || null,
        sanction_type: sanction.sanctionType || "warning",
        subject_type: sanction.subjectType || "club",
        subject_id: sanction.subjectId || null,
        subject_label: String(sanction.subjectLabel || "").trim(),
        status: sanction.status || "proposed",
        amount_pence: Math.max(0, Number(sanction.amountPence || 0)),
        points_delta: Number(sanction.pointsDelta || 0),
        match_count: Math.max(0, Number(sanction.matchCount || 0)),
        matches_served: Math.max(0, Number(sanction.matchesServed || 0)),
        starts_on: sanction.startsOn || null,
        ends_on: sanction.endsOn || null,
        payment_due_on: sanction.paymentDueOn || null,
        paid_at: sanction.paidAt || null,
        notes: String(sanction.notes || "").trim() || null,
      },
    });
  },

  async addLeagueCaseDocument(leagueId, caseId, document = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/add_league_case_document", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      document_data: {
        document_type: document.documentType || "evidence",
        title: String(document.title || "Evidence").trim(),
        file_name: String(document.fileName || "").trim() || null,
        document_url: String(document.documentUrl || "").trim(),
        visibility: document.visibility || "league",
        notes: String(document.notes || "").trim() || null,
      },
    });
  },

  async submitLeagueCaseResponse(leagueId, caseId, response = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_case_response", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      response_data: {
        response_type: response.responseType || "response",
        detail: String(response.detail || "").trim(),
        event_data: response.eventData && typeof response.eventData === "object" ? response.eventData : {},
      },
    });
  },

  async submitLeagueCaseAppeal(leagueId, caseId, appeal = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_case_appeal", {
      target_league_id: id,
      target_case_id: String(caseId || "").trim(),
      appeal_data: {
        grounds: String(appeal.grounds || "").trim(),
        appeal_due_on: appeal.appealDueOn || null,
      },
    });
  },

  async reviewLeagueCaseAppeal(leagueId, appealId, review = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/review_league_case_appeal", {
      target_league_id: id,
      target_appeal_id: String(appealId || "").trim(),
      appeal_data: {
        status: review.status || "under_review",
        decision: String(review.decision || "").trim() || null,
        decision_reason: String(review.decisionReason || "").trim() || null,
      },
    });
  },

  async getLeagueRegistrationData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_registration_data", { target_league_id: id });
  },

  async getLeagueClubRegistrationData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_club_registration_data", { target_league_id: id });
  },

  async submitLeaguePlayerRegistration(leagueId, data = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_player_registration", {
      target_league_id: id,
      registration_data: {
        player_id: data.playerId || null,
        first_name: String(data.firstName || "").trim(),
        last_name: String(data.lastName || "").trim(),
        date_of_birth: data.dateOfBirth || null,
        external_ref: String(data.externalRef || "").trim() || null,
        season_id: data.seasonId || null,
        parent_club_id: data.parentClubId || null,
        team_id: data.teamId || null,
        registration_type: data.registrationType || "new",
        submission_notes: String(data.submissionNotes || "").trim(),
        effective_from: data.effectiveFrom || null,
        effective_to: data.effectiveTo || null,
      },
    });
  },

  async reviewLeaguePlayerRegistration(leagueId, registrationId, status, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/review_league_player_registration", {
      target_league_id: id,
      target_registration_id: String(registrationId || "").trim(),
      next_status: String(status || "").trim(),
      review_notes: String(notes || "").trim(),
    });
  },

  async resubmitLeaguePlayerRegistration(leagueId, registrationId, note = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/resubmit_league_player_registration", {
      target_league_id: id,
      target_registration_id: String(registrationId || "").trim(),
      resubmission_note: String(note || "").trim(),
    });
  },

  async addLeagueRegistrationDocument(leagueId, registrationId, document = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/add_league_registration_document", {
      target_league_id: id,
      target_registration_id: String(registrationId || "").trim(),
      document_data: {
        document_type: document.documentType || "evidence",
        title: String(document.title || "Evidence").trim(),
        document_url: String(document.documentUrl || "").trim(),
        visibility: document.visibility || "league",
        notes: String(document.notes || "").trim() || null,
      },
    });
  },

  async submitLeagueTransferRequest(leagueId, transfer = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_transfer_request", {
      target_league_id: id,
      transfer_data: {
        player_id: transfer.playerId || null,
        season_id: transfer.seasonId || null,
        to_club_id: transfer.toClubId || null,
        to_team_id: transfer.toTeamId || null,
        effective_on: transfer.effectiveOn || null,
        reason: String(transfer.reason || "").trim(),
      },
    });
  },

  async reviewLeagueTransferRequest(leagueId, transferId, status, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/review_league_transfer_request", {
      target_league_id: id,
      target_transfer_id: String(transferId || "").trim(),
      next_status: String(status || "").trim(),
      review_notes: String(notes || "").trim(),
    });
  },

  async upsertLeagueEligibilityRule(leagueId, rule = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_eligibility_rule", {
      target_league_id: id,
      rule_data: {
        id: rule.id || null,
        season_id: rule.seasonId || null,
        division_id: rule.divisionId || null,
        competition_type: rule.competitionType || "all",
        competition_id: rule.competitionId || null,
        rule_type: rule.ruleType || "other",
        name: String(rule.name || "Eligibility rule").trim(),
        severity: rule.severity || "block",
        config: rule.config && typeof rule.config === "object" ? rule.config : {},
        active: rule.active !== false,
      },
    });
  },

  async submitLeagueEligibilityDispensation(leagueId, dispensation = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_eligibility_dispensation", {
      target_league_id: id,
      dispensation_data: {
        season_id: dispensation.seasonId || null,
        player_id: dispensation.playerId || null,
        team_id: dispensation.teamId || null,
        rule_type: dispensation.ruleType || "other",
        starts_on: dispensation.startsOn || null,
        ends_on: dispensation.endsOn || null,
        reason: String(dispensation.reason || "").trim(),
      },
    });
  },

  async reviewLeagueEligibilityDispensation(leagueId, dispensationId, status, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/review_league_eligibility_dispensation", {
      target_league_id: id,
      target_dispensation_id: String(dispensationId || "").trim(),
      next_status: String(status || "").trim(),
      review_notes: String(notes || "").trim(),
    });
  },

  async saveLeagueTeamSheet(leagueId, teamSheet = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/save_league_team_sheet", {
      target_league_id: id,
      team_sheet_data: {
        publication_fixture_id: teamSheet.publicationFixtureId || null,
        team_id: teamSheet.teamId || null,
        status: teamSheet.status || "submitted",
        players: Array.isArray(teamSheet.players) ? teamSheet.players.map((player) => ({
          player_id: player.playerId || null,
          registration_id: player.registrationId || null,
          squad_role: player.squadRole || "starter",
          shirt_number: player.shirtNumber === "" || player.shirtNumber === null || player.shirtNumber === undefined ? null : Number(player.shirtNumber),
        })) : [],
      },
    });
  },

  async submitLeagueFixtureResult(leagueId, publicationFixtureId, result = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/submit_league_fixture_result", {
      target_league_id: id,
      target_publication_fixture_id: String(publicationFixtureId || "").trim(),
      result_data: {
        outcome_type: result.outcomeType || "played",
        home_score: result.homeScore === "" || result.homeScore === null || result.homeScore === undefined ? null : Number(result.homeScore),
        away_score: result.awayScore === "" || result.awayScore === null || result.awayScore === undefined ? null : Number(result.awayScore),
        home_penalties: result.homePenalties === "" || result.homePenalties === null || result.homePenalties === undefined ? null : Number(result.homePenalties),
        away_penalties: result.awayPenalties === "" || result.awayPenalties === null || result.awayPenalties === undefined ? null : Number(result.awayPenalties),
        winner_team_id: result.winnerTeamId || null,
        notes: String(result.notes || "").trim() || null,
      },
    });
  },

  async reviewLeagueResultSubmission(leagueId, submissionId, decision, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/review_league_result_submission", {
      target_league_id: id,
      target_submission_id: String(submissionId || "").trim(),
      review_decision: String(decision || "verify").trim(),
      review_notes: String(notes || "").trim() || null,
    });
  },

  async recordLeagueFixtureResult(leagueId, publicationFixtureId, result = {}, source = "league_entry") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/record_league_fixture_result", {
      target_league_id: id,
      target_publication_fixture_id: String(publicationFixtureId || "").trim(),
      result_data: {
        outcome_type: result.outcomeType || "played",
        home_score: result.homeScore === "" || result.homeScore === null || result.homeScore === undefined ? null : Number(result.homeScore),
        away_score: result.awayScore === "" || result.awayScore === null || result.awayScore === undefined ? null : Number(result.awayScore),
        home_penalties: result.homePenalties === "" || result.homePenalties === null || result.homePenalties === undefined ? null : Number(result.homePenalties),
        away_penalties: result.awayPenalties === "" || result.awayPenalties === null || result.awayPenalties === undefined ? null : Number(result.awayPenalties),
        winner_team_id: result.winnerTeamId || null,
        notes: String(result.notes || "").trim() || null,
      },
      result_source: String(source || "league_entry").trim(),
    });
  },

  async upsertLeagueTableAdjustment(leagueId, adjustment = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_table_adjustment", {
      target_league_id: id,
      adjustment_data: {
        id: adjustment.id || null,
        season_id: adjustment.seasonId || null,
        division_id: adjustment.divisionId || null,
        team_id: adjustment.teamId || null,
        points_delta: Number(adjustment.pointsDelta || 0),
        goals_for_delta: Number(adjustment.goalsForDelta || 0),
        goals_against_delta: Number(adjustment.goalsAgainstDelta || 0),
        reason: String(adjustment.reason || "").trim(),
        effective_on: adjustment.effectiveOn || null,
      },
    });
  },

  async revokeLeagueTableAdjustment(leagueId, adjustmentId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/revoke_league_table_adjustment", {
      target_league_id: id,
      target_adjustment_id: String(adjustmentId || "").trim(),
    });
  },

  async createLeagueClubInvitation(leagueId, { parentClubId, email, role = "club_secretary", expiresInDays = 14 } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/create_league_club_invitation", {
      target_league_id: id,
      target_parent_club_id: String(parentClubId || "").trim(),
      invitation_email: String(email || "").trim(),
      invitation_role: String(role || "club_secretary").trim(),
      expires_in_days: Math.max(1, Math.min(Number(expiresInDays) || 14, 30)),
    });
  },

  async acceptLeagueClubInvitation(token) {
    return supaFetch("POST", "rpc/accept_league_club_invitation", {
      invitation_token: String(token || "").trim(),
    });
  },

  async revokeLeagueClubInvitation(leagueId, invitationId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/revoke_league_club_invitation", {
      target_league_id: id,
      target_invitation_id: String(invitationId || "").trim(),
    });
  },

  async removeLeagueClubMember(leagueId, parentClubId, userId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/remove_league_club_member", {
      target_league_id: id,
      target_parent_club_id: String(parentClubId || "").trim(),
      target_user_id: String(userId || "").trim(),
    });
  },

  async publishLeagueFixtureRelease(leagueId, { scheduleVersionId, scopeType = "league", scopeId = null, title = "", notes = "" } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/publish_league_fixture_release", {
      target_league_id: id,
      target_schedule_version_id: String(scheduleVersionId || "").trim(),
      target_scope_type: String(scopeType || "league").trim(),
      target_scope_id: scopeId ? String(scopeId).trim() : null,
      publication_title: String(title || "").trim() || null,
      publication_notes: String(notes || "").trim() || null,
    });
  },

  async withdrawLeaguePublication(leagueId, publicationId, reason = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/withdraw_league_publication", {
      target_league_id: id,
      target_publication_id: String(publicationId || "").trim(),
      withdrawal_reason: String(reason || "").trim() || null,
    });
  },

  async restoreLeaguePublication(leagueId, publicationId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/restore_league_publication", {
      target_league_id: id,
      target_publication_id: String(publicationId || "").trim(),
    });
  },

  async acknowledgeLeagueFixture(leagueId, acknowledgementId, status, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/acknowledge_league_fixture", {
      target_league_id: id,
      target_acknowledgement_id: String(acknowledgementId || "").trim(),
      acknowledgement_status: String(status || "received").trim(),
      acknowledgement_notes: String(notes || "").trim() || null,
    });
  },

  async createLeagueFixtureChangeRequest(leagueId, request = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/create_league_fixture_change_request", {
      target_league_id: id,
      request_data: {
        publication_id: request.publicationId || null,
        target_type: request.targetType || "schedule_entry",
        target_id: request.targetId || null,
        request_type: request.requestType || "date_change",
        requested_date: request.requestedDate || null,
        requested_kick_off: request.requestedKickOff || null,
        requested_venue_id: request.requestedVenueId || null,
        reason: request.reason || "",
        evidence: request.evidence && typeof request.evidence === "object" ? request.evidence : {},
      },
    });
  },

  async resolveLeagueFixtureChangeRequest(leagueId, requestId, decision, notes = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/resolve_league_fixture_change_request", {
      target_league_id: id,
      target_request_id: String(requestId || "").trim(),
      decision: String(decision || "under_review").trim(),
      response_notes: String(notes || "").trim() || null,
    });
  },

  async saveLeagueCommunication(leagueId, communication = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/save_league_communication", {
      target_league_id: id,
      communication_data: {
        id: communication.id || null,
        recipient_type: communication.recipientType || "club",
        recipient_id: communication.recipientId || null,
        recipient_label: communication.recipientLabel || "League recipient",
        recipient_email: communication.recipientEmail || null,
        template_key: communication.templateKey || "custom",
        subject: communication.subject || "",
        body: communication.body || "",
        channel: communication.channel || "manual",
        status: communication.status || "draft",
        requires_acknowledgement: Boolean(communication.requiresAcknowledgement),
        source_type: communication.sourceType || null,
        source_id: communication.sourceId || null,
        delivery_detail: communication.deliveryDetail && typeof communication.deliveryDetail === "object" ? communication.deliveryDetail : {},
      },
    });
  },

  async createLeagueCalendarFeed(leagueId, { scopeType = "league", scopeId = null, label = "", expiresInDays = null } = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/create_league_calendar_feed", {
      target_league_id: id,
      target_scope_type: String(scopeType || "league").trim(),
      target_scope_id: scopeId ? String(scopeId).trim() : null,
      feed_label: String(label || "").trim() || null,
      expires_in_days: expiresInDays ? Number(expiresInDays) : null,
    });
  },

  async revokeLeagueCalendarFeed(leagueId, feedId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/revoke_league_calendar_feed", {
      target_league_id: id,
      target_feed_id: String(feedId || "").trim(),
    });
  },

  async getDaxoraNotificationCentre(limit = 120) {
    return supaFetch("POST", "rpc/get_daxora_notification_centre", {
      result_limit: Math.max(1, Math.min(Number(limit) || 120, 200)),
    });
  },

  async updateDaxoraNotificationPreferences(preferences = {}) {
    return supaFetch("POST", "rpc/update_daxora_notification_preferences", {
      preferences_data: {
        in_app_enabled: preferences.inAppEnabled !== false,
        browser_push_enabled: Boolean(preferences.browserPushEnabled),
        email_alerts_enabled: preferences.emailAlertsEnabled !== false,
        daily_digest_enabled: Boolean(preferences.dailyDigestEnabled),
        weekly_digest_enabled: preferences.weeklyDigestEnabled !== false,
        quiet_start: preferences.quietStart || null,
        quiet_end: preferences.quietEnd || null,
        timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        categories: preferences.categories && typeof preferences.categories === "object" ? preferences.categories : {},
      },
    });
  },

  async createDaxoraNotification(notification = {}) {
    return supaFetch("POST", "rpc/create_daxora_notification", {
      notification_data: {
        id: notification.id || null,
        league_id: notification.leagueId || (notification.workspaceType === "league" ? notification.workspaceId : null),
        club_id: notification.clubId || (notification.workspaceType === "club" ? notification.workspaceId : null),
        title: notification.title || "Daxora update",
        description: notification.description || "",
        severity: notification.severity || "info",
        category: notification.category || "activity",
        href: notification.href || "",
        action_label: notification.actionLabel || "",
        workspace_type: notification.workspaceType || "platform",
        workspace_id: notification.workspaceId || "",
        workspace_name: notification.workspaceName || "Daxora",
        metadata: notification.metadata && typeof notification.metadata === "object" ? notification.metadata : {},
        created_at: notification.createdAt || new Date().toISOString(),
      },
    });
  },

  async markDaxoraNotification(notificationId, action = "read") {
    return supaFetch("POST", "rpc/mark_daxora_notification", {
      target_notification_id: String(notificationId || "").trim(),
      notification_action: String(action || "read").trim(),
    });
  },

  async markAllDaxoraNotifications(action = "read") {
    return supaFetch("POST", "rpc/mark_all_daxora_notifications", {
      notification_action: String(action || "read").trim(),
    });
  },

  async registerDaxoraPushSubscription(subscription = {}) {
    const serialised = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
    return supaFetch("POST", "rpc/register_daxora_push_subscription", {
      subscription_data: {
        endpoint: serialised.endpoint || "",
        p256dh: serialised.keys?.p256dh || serialised.p256dh || "",
        auth: serialised.keys?.auth || serialised.auth || "",
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });
  },

  async removeDaxoraPushSubscription(endpoint) {
    return supaFetch("POST", "rpc/remove_daxora_push_subscription", {
      target_endpoint: String(endpoint || "").trim(),
    });
  },

  async getMyDaxoraPushSubscriptions() {
    return supaFetch("POST", "rpc/get_my_daxora_push_subscriptions", {});
  },

  async getLeagueReportConfiguration(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_report_configuration", { target_league_id: id });
  },

  async upsertLeagueReportDefinition(leagueId, definition = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_report_definition", {
      target_league_id: id,
      definition_data: {
        id: definition.id || null,
        name: String(definition.name || "").trim(),
        report_type: definition.reportType || "executive",
        cadence: definition.cadence || "manual",
        delivery_format: definition.deliveryFormat || "html",
        recipients: Array.isArray(definition.recipients) ? definition.recipients : [],
        distribution_list_id: definition.distributionListId || null,
        filters: definition.filters && typeof definition.filters === "object" ? definition.filters : {},
        next_run_on: definition.nextRunOn || null,
        freshness_hours: Math.max(1, Math.min(Number(definition.freshnessHours) || 24, 168)),
        send_email: definition.sendEmail !== false,
        archive_runs: definition.archiveRuns !== false,
        active: definition.active !== false,
      },
    });
  },

  async deleteLeagueReportDefinition(leagueId, definitionId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/delete_league_report_definition", {
      target_league_id: id,
      target_definition_id: String(definitionId || "").trim(),
    });
  },

  async captureLeagueReportSnapshot(leagueId, data = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/capture_league_report_snapshot", {
      target_league_id: id,
      snapshot_data: {
        season_id: data.seasonId || null,
        definition_id: data.definitionId || null,
        report_type: data.reportType || "executive",
        generated_from: data.generatedFrom || "manual",
        snapshot: data.snapshot && typeof data.snapshot === "object" ? data.snapshot : {},
      },
    });
  },

  async upsertLeagueReportDistributionList(leagueId, list = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_report_distribution_list", {
      target_league_id: id,
      list_data: {
        id: list.id || null,
        name: String(list.name || "").trim(),
        recipients: Array.isArray(list.recipients) ? list.recipients : [],
        active: list.active !== false,
      },
    });
  },

  async deleteLeagueReportDistributionList(leagueId, listId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/delete_league_report_distribution_list", {
      target_league_id: id,
      target_list_id: String(listId || "").trim(),
    });
  },

  async queueLeagueReportDelivery(leagueId, definitionId, snapshotId, source = "manual") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/queue_league_report_delivery", {
      target_league_id: id,
      target_definition_id: String(definitionId || "").trim(),
      target_snapshot_id: String(snapshotId || "").trim(),
      request_source: String(source || "manual").trim(),
    });
  },

  async retryLeagueReportDelivery(leagueId, runId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/retry_league_report_delivery", {
      target_league_id: id,
      target_run_id: String(runId || "").trim(),
    });
  },

  async getPlatformOperatorContext() {
    return supaFetch("POST", "rpc/get_platform_operator_context", {});
  },

  async platformListClubs({ search = "", status = "", plan = "", limit = 50, offset = 0 } = {}) {
    return supaFetch("POST", "rpc/platform_list_clubs", {
      search_text: String(search || "").trim(),
      status_filter: String(status || "").trim().toLowerCase(),
      plan_filter: String(plan || "").trim().toLowerCase(),
      page_size: Math.max(1, Math.min(Number(limit) || 50, 100)),
      page_offset: Math.max(0, Number(offset) || 0),
    });
  },

  async platformGetClubDetail(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/platform_get_club_detail", {
      target_club_id: id,
    });
  },

  async platformUpdateClubStatus(clubId, status, reason) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/platform_update_club_status", {
      target_club_id: id,
      next_status: String(status || "").trim().toLowerCase(),
      change_reason: String(reason || "").trim(),
    });
  },

  async platformListSupportCases({ clubId = null, status = "", limit = 100 } = {}) {
    return supaFetch("POST", "rpc/platform_list_support_cases", {
      target_club_id: clubId || null,
      status_filter: String(status || "").trim().toLowerCase(),
      result_limit: Math.max(1, Math.min(Number(limit) || 100, 200)),
    });
  },

  async platformGetSupportCase(caseId) {
    return supaFetch("POST", "rpc/platform_get_support_case", {
      target_case_id: String(caseId || "").trim(),
    });
  },

  async platformCreateSupportCase(clubId, { subject, description = "", priority = "normal", requesterEmail = "" } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/platform_create_support_case", {
      target_club_id: id,
      case_subject: String(subject || "").trim(),
      case_description: String(description || "").trim(),
      case_priority: String(priority || "normal").trim().toLowerCase(),
      requester_email: String(requesterEmail || "").trim() || null,
    });
  },

  async platformUpdateSupportCase(caseId, { status = null, priority = null, note = null } = {}) {
    return supaFetch("POST", "rpc/platform_update_support_case", {
      target_case_id: String(caseId || "").trim(),
      next_status: status ? String(status).trim().toLowerCase() : null,
      next_priority: priority ? String(priority).trim().toLowerCase() : null,
      update_note: note ? String(note).trim() : null,
    });
  },

  async platformListActivity(limit = 50) {
    return supaFetch("POST", "rpc/platform_list_activity", {
      result_limit: Math.max(1, Math.min(Number(limit) || 50, 100)),
    });
  },

  async platformGetPilotLaunchReadiness() {
    return supaFetch("POST", "rpc/platform_get_pilot_launch_readiness", {});
  },

  async platformUpdateLaunchGate({ code, status, evidence = "", ownerLabel = "", dueDate = null } = {}) {
    return supaFetch("POST", "rpc/platform_update_launch_gate", {
      gate_code: String(code || "").trim(),
      next_status: String(status || "not_started").trim().toLowerCase(),
      next_evidence: String(evidence || "").trim(),
      next_owner_label: String(ownerLabel || "").trim(),
      next_due_date: dueDate || null,
    });
  },

  async platformGetPilotEvidence(clubId = null) {
    return supaFetch("POST", "rpc/platform_get_pilot_evidence", {
      target_club_id: clubId || null,
    });
  },

  async platformRecordLaunchGateEvidence(evidence = {}) {
    const observedAt = evidence.observedAt ? new Date(evidence.observedAt) : new Date();

    return supaFetch("POST", "rpc/platform_record_launch_gate_evidence", {
      target_gate_code: String(evidence.gateCode || "").trim(),
      next_evidence_type: String(evidence.evidenceType || "observation").trim().toLowerCase(),
      next_result: String(evidence.result || "observation").trim().toLowerCase(),
      next_environment: String(evidence.environment || "staging").trim().toLowerCase(),
      next_release: String(evidence.release || "").trim(),
      next_summary: String(evidence.summary || "").trim(),
      next_artifact_url: String(evidence.artifactUrl || "").trim() || null,
      next_observed_at: Number.isNaN(observedAt.getTime()) ? new Date().toISOString() : observedAt.toISOString(),
      next_metadata: evidence.metadata && typeof evidence.metadata === "object" ? evidence.metadata : {},
    });
  },

  async platformUpsertPilotSession(session = {}) {
    const clubId = requireClubId(session.clubId);

    return supaFetch("POST", "rpc/platform_upsert_pilot_session", {
      target_session_id: session.id || null,
      target_club_id: clubId,
      next_cycle: String(session.cycle || "historical_replay").trim().toLowerCase(),
      next_status: String(session.status || "planned").trim().toLowerCase(),
      next_session_date: session.sessionDate || null,
      next_operator_name: String(session.operatorName || "").trim(),
      next_fixture_count: Math.max(0, Number(session.fixtureCount) || 0),
      next_auto_scheduled_count: Math.max(0, Number(session.autoScheduledCount) || 0),
      next_manual_resolved_count: Math.max(0, Number(session.manualResolvedCount) || 0),
      next_unresolved_count: Math.max(0, Number(session.unresolvedCount) || 0),
      next_invalid_recommendation_count: Math.max(0, Number(session.invalidRecommendationCount) || 0),
      next_correct_warning_count: Math.max(0, Number(session.correctWarningCount) || 0),
      next_missed_warning_count: Math.max(0, Number(session.missedWarningCount) || 0),
      next_override_count: Math.max(0, Number(session.overrideCount) || 0),
      next_critical_defect_count: Math.max(0, Number(session.criticalDefectCount) || 0),
      next_high_defect_count: Math.max(0, Number(session.highDefectCount) || 0),
      next_time_saved_minutes: Math.max(0, Number(session.timeSavedMinutes) || 0),
      next_outcome: String(session.outcome || "not_run").trim().toLowerCase(),
      next_notes: String(session.notes || "").trim(),
      next_signoff_name: String(session.signoffName || "").trim(),
    });
  },

  async platformUpsertPilotFinding(finding = {}) {
    return supaFetch("POST", "rpc/platform_upsert_pilot_finding", {
      target_finding_id: finding.id || null,
      target_session_id: String(finding.sessionId || "").trim() || null,
      next_finding_type: String(finding.findingType || "defect").trim().toLowerCase(),
      next_severity: String(finding.severity || "medium").trim().toLowerCase(),
      next_status: String(finding.status || "open").trim().toLowerCase(),
      next_title: String(finding.title || "").trim(),
      next_description: String(finding.description || "").trim(),
      next_workaround: String(finding.workaround || "").trim(),
      next_reference: String(finding.reference || "").trim(),
    });
  },

  async platformUpsertPilot(pilot = {}) {
    const id = requireClubId(pilot.clubId);
    return supaFetch("POST", "rpc/platform_upsert_pilot", {
      target_club_id: id,
      next_stage: String(pilot.stage || "candidate").trim().toLowerCase(),
      next_health: String(pilot.health || "on_track").trim().toLowerCase(),
      next_coordinator_user_id: pilot.coordinatorUserId || null,
      next_target_start_date: pilot.targetStartDate || null,
      next_target_review_date: pilot.targetReviewDate || null,
      next_notes: String(pilot.notes || "").trim(),
      next_checklist: pilot.checklist && typeof pilot.checklist === "object" ? pilot.checklist : {},
    });
  },

  async platformResolveClientEvent(eventId, note = "") {
    return supaFetch("POST", "rpc/platform_resolve_client_event", {
      target_event_id: String(eventId || "").trim(),
      resolution_note: String(note || "").trim(),
    });
  },

  async platformGetBillingReadiness() {
    return supaFetch("POST", "rpc/platform_get_billing_readiness", {});
  },

  async platformUpdateLegalSettings(settings = {}) {
    return supaFetch("POST", "rpc/platform_update_legal_settings", {
      next_legal_name: String(settings.legalName || "").trim(),
      next_trading_name: String(settings.tradingName || "Daxora").trim(),
      next_service_address: String(settings.serviceAddress || "").trim(),
      next_website_url: String(settings.websiteUrl || "").trim(),
      next_support_email: String(settings.supportEmail || "").trim(),
      next_privacy_email: String(settings.privacyEmail || "").trim(),
      next_governing_law: String(settings.governingLaw || "England and Wales").trim(),
      next_stripe_mode: String(settings.stripeMode || "disabled").trim().toLowerCase(),
      next_tax_status: String(settings.taxStatus || "not_configured").trim().toLowerCase(),
      next_vat_number: String(settings.vatNumber || "").trim() || null,
      next_invoice_prefix: String(settings.invoicePrefix || "DAX").trim(),
    });
  },

  async platformPublishLegalDocument(document = {}) {
    return supaFetch("POST", "rpc/platform_publish_legal_document", {
      document_code: String(document.code || "").trim().toLowerCase(),
      next_version: String(document.version || "").trim(),
      next_title: String(document.title || "").trim(),
      next_category: String(document.category || "commercial").trim().toLowerCase(),
      next_document_url: String(document.documentUrl || "").trim(),
      next_content_hash: String(document.contentHash || "").trim(),
      next_required_for_checkout: Boolean(document.requiredForCheckout),
      next_status: String(document.status || "draft").trim().toLowerCase(),
      next_effective_at: document.effectiveAt || null,
    });
  },

  async getLeagueFinanceData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_finance_data", { target_league_id: id });
  },

  async getLeagueClubFinanceData(leagueId) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/get_league_club_finance_data", { target_league_id: id });
  },

  async upsertLeagueFinanceChargeType(leagueId, data = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_finance_charge_type", {
      target_league_id: id,
      charge_data: {
        id: data.id || null,
        name: String(data.name || "").trim(),
        code: String(data.code || "").trim().toUpperCase(),
        category: data.category || "other",
        default_amount_pence: Math.max(0, Number(data.defaultAmountPence || 0)),
        tax_rate: Math.max(0, Number(data.taxRate || 0)),
        active: data.active !== false,
        notes: String(data.notes || "").trim() || null,
      },
    });
  },

  async upsertLeagueFinanceInvoice(leagueId, invoice = {}, lines = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_finance_invoice", {
      target_league_id: id,
      invoice_data: {
        id: invoice.id || null,
        season_id: invoice.seasonId || null,
        parent_club_id: invoice.parentClubId || null,
        invoice_number: String(invoice.invoiceNumber || "").trim() || null,
        issue_on: invoice.issueOn || null,
        due_on: invoice.dueOn || null,
        period_label: String(invoice.periodLabel || "").trim() || null,
        purchase_order_reference: String(invoice.purchaseOrderReference || "").trim() || null,
        notes: String(invoice.notes || "").trim() || null,
      },
      line_rows: (Array.isArray(lines) ? lines : []).map((line) => ({
        charge_type_id: line.chargeTypeId || null,
        description: String(line.description || "").trim(),
        quantity: Math.max(0.001, Number(line.quantity || 1)),
        unit_amount_pence: Number(line.unitAmountPence || 0),
        tax_rate: Math.max(0, Number(line.taxRate || 0)),
        source_type: line.sourceType || null,
        source_id: line.sourceId || null,
        source_label: String(line.sourceLabel || "").trim() || null,
      })),
    });
  },

  async updateLeagueFinanceInvoiceStatus(leagueId, invoiceId, status, note = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_finance_invoice_status", {
      target_league_id: id,
      target_invoice_id: String(invoiceId || "").trim(),
      next_status: String(status || "").trim(),
      status_note: String(note || "").trim(),
    });
  },

  async recordLeagueFinancePayment(leagueId, invoiceId, payment = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/record_league_finance_payment", {
      target_league_id: id,
      target_invoice_id: String(invoiceId || "").trim(),
      payment_data: {
        amount_pence: Math.max(1, Number(payment.amountPence || 0)),
        paid_on: payment.paidOn || null,
        payment_method: payment.paymentMethod || "bank_transfer",
        reference: String(payment.reference || "").trim() || null,
        notes: String(payment.notes || "").trim() || null,
      },
    });
  },

  async addLeagueFinanceCredit(leagueId, invoiceId, credit = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/add_league_finance_credit", {
      target_league_id: id,
      target_invoice_id: String(invoiceId || "").trim(),
      credit_data: {
        amount_pence: Math.max(1, Number(credit.amountPence || 0)),
        credit_on: credit.creditOn || null,
        reason: String(credit.reason || "").trim(),
        reference: String(credit.reference || "").trim() || null,
      },
    });
  },

  async invoiceLeagueDisciplineFine(leagueId, sanctionId, invoiceId = null) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/invoice_league_discipline_fine", {
      target_league_id: id,
      target_sanction_id: String(sanctionId || "").trim(),
      target_invoice_id: invoiceId || null,
    });
  },

  async upsertLeagueFinanceExpense(leagueId, expense = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_finance_expense", {
      target_league_id: id,
      expense_data: {
        id: expense.id || null,
        season_id: expense.seasonId || null,
        official_id: expense.officialId || null,
        official_name: String(expense.officialName || "").trim(),
        publication_fixture_id: expense.publicationFixtureId || null,
        fixture_label: String(expense.fixtureLabel || "").trim() || null,
        expense_type: expense.expenseType || "match_fee",
        amount_pence: Math.max(1, Number(expense.amountPence || 0)),
        expense_on: expense.expenseOn || null,
        status: expense.status || "submitted",
        payment_reference: String(expense.paymentReference || "").trim() || null,
        notes: String(expense.notes || "").trim() || null,
      },
    });
  },

  async updateLeagueFinanceExpenseStatus(leagueId, expenseId, status, paymentReference = "") {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/update_league_finance_expense_status", {
      target_league_id: id,
      target_expense_id: String(expenseId || "").trim(),
      next_status: String(status || "").trim(),
      payment_reference_value: String(paymentReference || "").trim(),
    });
  },

  async upsertLeagueFinanceClubProfile(leagueId, profile = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_finance_club_profile", {
      target_league_id: id,
      profile_data: {
        parent_club_id: profile.parentClubId || null,
        billing_email: String(profile.billingEmail || "").trim().toLowerCase() || null,
        cc_emails: (Array.isArray(profile.ccEmails) ? profile.ccEmails : []).map((value) => String(value || "").trim().toLowerCase()).filter(Boolean),
        account_reference: String(profile.accountReference || "").trim() || null,
        payment_terms_days: Math.max(1, Number(profile.paymentTermsDays || 30)),
        reminders_enabled: profile.remindersEnabled !== false,
        reminder_days: (Array.isArray(profile.reminderDays) ? profile.reminderDays : [0, 7, 14]).map((value) => Math.max(0, Number(value || 0))),
        purchase_order_required: Boolean(profile.purchaseOrderRequired),
        notes: String(profile.notes || "").trim() || null,
      },
    });
  },

  async upsertLeagueFinanceBillingTemplate(leagueId, template = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/upsert_league_finance_billing_template", {
      target_league_id: id,
      template_data: {
        id: template.id || null,
        season_id: template.seasonId || null,
        charge_type_id: template.chargeTypeId || null,
        name: String(template.name || "").trim(),
        scope: template.scope || "club",
        quantity: Math.max(0.001, Number(template.quantity || 1)),
        due_days: Math.max(1, Number(template.dueDays || 30)),
        active: template.active !== false,
        notes: String(template.notes || "").trim() || null,
      },
    });
  },

  async createLeagueFinanceBillingRun(leagueId, run = {}) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/create_league_finance_billing_run", {
      target_league_id: id,
      run_data: {
        template_id: run.templateId || null,
        season_id: run.seasonId || null,
        name: String(run.name || "Bulk billing run").trim(),
        idempotency_key: String(run.idempotencyKey || "").trim(),
        issue_on: run.issueOn || null,
        due_on: run.dueOn || null,
        issue_immediately: Boolean(run.issueImmediately),
        parent_club_ids: Array.isArray(run.parentClubIds) ? run.parentClubIds : [],
      },
    });
  },

  async applyLeagueFinancePaymentBatch(leagueId, filename, rows = []) {
    const id = requireLeagueId(leagueId);
    return supaFetch("POST", "rpc/apply_league_finance_payment_batch", {
      target_league_id: id,
      filename_value: String(filename || "payment-import.csv").trim(),
      payment_rows: (Array.isArray(rows) ? rows : []).map((row, index) => ({
        row_number: Math.max(1, Number(row.rowNumber || index + 2)),
        invoice_id: row.matchedInvoiceId || row.invoiceId || null,
        paid_on: row.date || row.paidOn || null,
        amount_pence: Math.max(1, Number(row.amountPence || 0)),
        reference: String(row.reference || "").trim() || null,
      })),
    });
  },

  async getClubOnboarding(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/get_club_onboarding", {
      target_club_id: id,
    });
  },

  async startClubOnboarding(clubId, { forceRestart = false } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/start_club_onboarding", {
      target_club_id: id,
      force_restart: Boolean(forceRestart),
    });
  },

  async saveClubOnboarding(clubId, { currentStep = 0, completedSteps = [], draft = {} } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/save_club_onboarding", {
      target_club_id: id,
      step_index: Math.max(0, Math.min(Number(currentStep) || 0, 7)),
      completed_step_ids: Array.isArray(completedSteps) ? completedSteps : [],
      onboarding_draft: draft && typeof draft === "object" ? draft : {},
    });
  },

  async completeClubOnboarding(clubId, { configuration, teams, pitches, draft } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/complete_club_onboarding", {
      target_club_id: id,
      configuration: configuration || {},
      teams: Array.isArray(teams) ? teams : [],
      pitches: Array.isArray(pitches) ? pitches : [],
      final_draft: draft && typeof draft === "object" ? draft : {},
    });
  },

};
