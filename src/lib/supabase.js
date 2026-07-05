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

  async getClubSubscription(clubId) {
    const id = requireClubId(clubId);
    return supaFetch("POST", "rpc/get_club_subscription", {
      target_club_id: id,
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

  async platformGetPilotEvidence(clubId = null) {
    return supaFetch("POST", "rpc/platform_get_pilot_evidence", {
      target_club_id: clubId || null,
    });
  },

  async platformRecordLaunchGateEvidence(evidence = {}) {
    return supaFetch("POST", "rpc/platform_record_launch_gate_evidence", {
      target_gate_code: String(evidence.gateCode || "").trim(),
      next_evidence_type: String(evidence.evidenceType || "observation").trim().toLowerCase(),
      next_result: String(evidence.result || "observation").trim().toLowerCase(),
      next_environment: String(evidence.environment || "staging").trim().toLowerCase(),
      next_release: String(evidence.release || "").trim(),
      next_summary: String(evidence.summary || "").trim(),
      next_artifact_url: String(evidence.artifactUrl || "").trim() || null,
      next_observed_at: evidence.observedAt || null,
      next_metadata: evidence.metadata && typeof evidence.metadata === "object" ? evidence.metadata : {},
    });
  },

  async platformUpsertPilotSession(session = {}) {
    const id = requireClubId(session.clubId);
    return supaFetch("POST", "rpc/platform_upsert_pilot_session", {
      target_session_id: session.id || null,
      target_club_id: id,
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
      target_session_id: String(finding.sessionId || "").trim(),
      next_finding_type: String(finding.findingType || "defect").trim().toLowerCase(),
      next_severity: String(finding.severity || "medium").trim().toLowerCase(),
      next_status: String(finding.status || "open").trim().toLowerCase(),
      next_title: String(finding.title || "").trim(),
      next_description: String(finding.description || "").trim(),
      next_workaround: String(finding.workaround || "").trim(),
      next_reference: String(finding.reference || "").trim(),
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
