function env(name) {
  return String(process.env[name] || "").trim();
}

function supabaseConfig() {
  const url = (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const anonKey = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  return { url, anonKey, serviceRoleKey };
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(payload, fallback) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  return payload?.message || payload?.error_description || payload?.hint || payload?.error || fallback;
}

export function bearerToken(request) {
  const header = String(request.headers.get("authorization") || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

export async function verifySupabaseUser(request) {
  const { url, anonKey } = supabaseConfig();
  const token = bearerToken(request);
  if (!url || !anonKey) {
    throw Object.assign(new Error("Server authentication is not configured"), { code: "SUPABASE_SERVER_NOT_CONFIGURED", status: 503 });
  }
  if (!token) {
    throw Object.assign(new Error("Sign in again to continue"), { code: "AUTH_REQUIRED", status: 401 });
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  const payload = await readResponse(response);
  if (!response.ok || !payload?.id) {
    throw Object.assign(new Error(errorMessage(payload, "The secure session could not be verified")), { code: "AUTH_INVALID", status: 401 });
  }
  return { user: payload, token };
}

export async function userRpc(token, functionName, body) {
  const { url, anonKey } = supabaseConfig();
  if (!url || !anonKey) {
    throw Object.assign(new Error("Supabase is not configured for server dispatch"), { code: "SUPABASE_SERVER_NOT_CONFIGURED", status: 503 });
  }
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage(payload, "Database request failed")), {
      code: payload?.code || "SUPABASE_RPC_FAILED",
      status: response.status,
      detail: payload,
    });
  }
  return payload;
}

export async function serviceRpc(functionName, body) {
  const { url, serviceRoleKey } = supabaseConfig();
  if (!url || !serviceRoleKey) {
    throw Object.assign(new Error("The server dispatch key is not configured"), { code: "SUPABASE_SERVICE_ROLE_NOT_CONFIGURED", status: 503 });
  }
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await readResponse(response);
  if (!response.ok) {
    throw Object.assign(new Error(errorMessage(payload, "Server database request failed")), {
      code: payload?.code || "SUPABASE_SERVICE_RPC_FAILED",
      status: response.status,
      detail: payload,
    });
  }
  return payload;
}
