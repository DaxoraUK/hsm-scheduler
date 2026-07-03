// Authenticated Supabase REST client and club-scoped data repository.
// The anon key identifies the application; the signed-in user's JWT identifies
// the actor and is mandatory for all database requests protected by RLS.

const DEFAULT_SUPA_URL = "https://keanexqompimqafhuiow.supabase.co";
const ENV_SUPA_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const ENV_SUPA_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
const SESSION_KEY = "gc_auth_session_v2";
const LEGACY_SESSION_KEY = "hsm_auth_session";
const DEVELOPMENT_KEY = "gc_development_supabase_anon_key";

export const SUPA_URL = (ENV_SUPA_URL || (import.meta.env?.DEV ? DEFAULT_SUPA_URL : "")).replace(/\/$/, "");
export const SUPA_AUTH = `${SUPA_URL}/auth/v1`;

let refreshPromise = null;

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

export const isSupaConfigured = () => Boolean(SUPA_URL && getSupaKey().length > 20);

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
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${token || key}`,
      },
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
    return authFetch("/signup", {
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
    return authFetch("/recover", { email });
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

function requireClubId(clubId) {
  const value = String(clubId || "").trim();
  if (!value) {
    throw new SupabaseRequestError("No club workspace is selected", { code: "CLUB_CONTEXT_REQUIRED" });
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
    const rows = await supaFetch(
      "GET",
      `history?select=id,data,saved_at&club_id=eq.${encodeFilter(id)}&order=saved_at.desc`
    );
    return (Array.isArray(rows) ? rows : []).map((row) => row.data).filter(Boolean);
  },

  async loadRefs(clubId) {
    return DB.load("refs", clubId);
  },

  async loadTeamCfg(clubId) {
    return DB.load("team_config", clubId);
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

  async createClubInvitation(clubId, { email, role = "viewer", expiryHours = 72 } = {}) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/create_club_invitation", {
      target_club_id: id,
      invite_email: String(email || "").trim(),
      invite_role: String(role || "viewer").trim(),
      expiry_hours: Number(expiryHours) || 72,
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
