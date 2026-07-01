// supabase.js
// Network + auth layer: talks to Supabase REST and Auth endpoints.
// Exposes supaFetch (REST), Auth (login/signup/session), and DB (table helpers).

export const SUPA_URL = "https://keanexqompimqafhuiow.supabase.co";

export const getSupaKey = () => { try { return localStorage.getItem("hsm_supa_key") || ""; } catch(e){ return ""; } };

export const setSupaKey = (k) => { try { localStorage.setItem("hsm_supa_key", k); } catch(e){} };

export const isSupaConfigured = () => { const k = getSupaKey(); return k.length > 20; };

export const supaFetch = async (method, path, body=null, extraHeaders={}) => {
  if (!isSupaConfigured()) return null;
  const key = getSupaKey();
  const url = SUPA_URL + "/rest/v1/" + path;
  const headers = {
    "apikey": key,
    "Authorization": "Bearer " + key,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Supabase error:", method, path, "Status:", res.status, "Body:", err);
      return null;
    }
    if (method === "GET") return await res.json();
    return true;
  } catch(e) {
    console.warn("Supabase fetch error:", e);
    return null;
  }
};

export const SUPA_AUTH = SUPA_URL + "/auth/v1";

export const authFetch = async (path, body, method, token) => {
  const key = getSupaKey();
  if (!key) return { error: "No Supabase key configured" };
  const m = method || "POST";
  try {
    const res = await fetch(SUPA_AUTH + path, {
      method: m,
      headers: {
        "Content-Type": "application/json",
        "apikey": key,
        "Authorization": "Bearer " + (token || key)
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 204) return { ok: true };
    const data = await res.json();
    if (!res.ok) return { error: data.error_description || data.msg || data.error || "Auth error" };
    return data;
  } catch(e) {
    return { error: e.message || "Network error" };
  }
};

export const Auth = {
  async signUp(email, password, displayName) {
    return await authFetch("/signup", {
      email,
      password,
      data: { display_name: displayName || email.split("@")[0] }
    });
  },
  async signIn(email, password) {
    return await authFetch("/token?grant_type=password", { email, password });
  },
  async signOut(token) {
    await authFetch("/logout", {}, "POST", token);
    Auth.clearSession();
  },
  async getUser(token) {
    return await authFetch("/user", null, "GET", token);
  },
  async resetPassword(email) {
    return await authFetch("/recover", { email });
  },
  async refreshSession(refreshToken) {
    return await authFetch("/token?grant_type=refresh_token", { refresh_token: refreshToken });
  },
  getSession() {
    try { const s = localStorage.getItem("hsm_auth_session"); return s ? JSON.parse(s) : null; } catch(e) { return null; }
  },
  saveSession(session) {
    try { localStorage.setItem("hsm_auth_session", JSON.stringify(session)); } catch(e) {}
  },
  clearSession() {
    try { localStorage.removeItem("hsm_auth_session"); } catch(e) {}
  }
};

export const getAuthToken = () => {
  try { const s = localStorage.getItem("hsm_auth_session"); if (s) { const p = JSON.parse(s); return p.access_token || null; } } catch(e) {}
  return null;
};

export const DB = {
  // Load all rows from a table, return array of .data values
  async load(table) {
    const orderCol = table === "history" ? "&order=saved_at.desc" : "";
    const r = await supaFetch("GET", table + "?select=data" + orderCol);
    return r ? r.map(x => x.data).filter(Boolean) : null;
  },

  async loadHistory()  { return DB.load("history"); },
  async loadRefs()     { return DB.load("refs"); },
  async loadTeamCfg()  { return DB.load("team_config"); },

  async loadClub() {
    const r = await supaFetch("GET", "club_config?select=data&limit=1");
    return r && r.length ? r[0].data : null;
  },
  async saveClub(cfg) {
    await supaFetch("DELETE", "club_config?id=neq.null");
    return await supaFetch("POST", "club_config", [{ id: "club", data: cfg }], { "Prefer": "return=minimal" });
  },
  async loadPitches() {
    const r = await supaFetch("GET", "pitches?select=data&order=id.asc");
    return r && r.length ? r.map((x) => x.data) : null;
  },
  async savePitches(pitches) {
    await supaFetch("DELETE", "pitches?id=neq.null");
    if (!pitches.length) return true;
    return await supaFetch("POST", "pitches", pitches.map((p,i) => ({ id: String(i), data: p })), { "Prefer": "return=minimal" });
  },

  // Upsert history entries one at a time (avoids bulk conflict issues)
  async saveHistory(entries) {
    // Delete all then reinsert - most reliable approach for small datasets
    await supaFetch("DELETE", "history?id=neq.null");
    if (!entries.length) return true;
    const rows = entries.map(e => ({ id: String(e.id), data: e, saved_at: e.savedAt || new Date().toISOString() }));
    return await supaFetch("POST", "history", rows, { "Prefer": "return=minimal" });
  },

  // Replace refs entirely
  async saveRefs(refs) {
    await supaFetch("DELETE", "refs?id=neq.null");
    if (!refs.length) return true;
    const rows = refs.map(r => ({ id: String(r.id), data: r }));
    return await supaFetch("POST", "refs", rows, { "Prefer": "return=minimal" });
  },

  // Replace team config entirely
  async saveTeamCfg(cfg) {
    await supaFetch("DELETE", "team_config?id=neq.null");
    if (!cfg.length) return true;
    const rows = cfg.map((t, i) => ({ id: "team_" + i, data: t }));
    return await supaFetch("POST", "team_config", rows, { "Prefer": "return=minimal" });
  },

  async deleteHistory(id) {
    return await supaFetch("DELETE", "history?id=eq." + String(id));
  },
};