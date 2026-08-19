const POSTCODES_IO_BULK_URL = "https://api.postcodes.io/postcodes";

function env(name) {
  return String(process.env[name] || "").trim();
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function supabaseConfig() {
  return {
    url: (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, ""),
    key: env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY"),
  };
}

function cleanRows(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((row) => ({
      id: String(row?.id || "").trim(),
      postcode: String(row?.postcode || "").trim().toUpperCase(),
    }))
    .filter((row) => row.id && row.postcode && row.postcode.length <= 10)
    .filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .slice(0, 100);
}

async function canManageLeague({ leagueId, token }) {
  const { url, key } = supabaseConfig();
  if (!url || !key || !token) return false;
  const response = await fetch(`${url}/rest/v1/rpc/can_manage_league`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ target_league_id: leagueId }),
  });
  if (!response.ok) return false;
  return Boolean(await response.json());
}

export async function POST(request) {
  const token = String(request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "A JSON request body is required." }, 400);
  }

  const leagueId = String(body?.leagueId || "").trim();
  const rows = cleanRows(body?.venues);
  if (!leagueId || !rows.length) return json({ error: "A league and at least one valid venue postcode are required." }, 400);
  if (!(await canManageLeague({ leagueId, token }))) return json({ error: "League administrator access is required." }, 403);

  try {
    const upstream = await fetch(POSTCODES_IO_BULK_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ postcodes: rows.map((row) => row.postcode) }),
    });
    const payload = await upstream.json();
    if (!upstream.ok || !Array.isArray(payload?.result)) {
      return json({ error: "The postcode service did not return usable coordinates." }, 502);
    }

    const coordinates = rows.map((row, index) => {
      const result = payload.result[index]?.result;
      return {
        id: row.id,
        postcode: result?.postcode || row.postcode,
        latitude: Number.isFinite(Number(result?.latitude)) ? Number(result.latitude) : null,
        longitude: Number.isFinite(Number(result?.longitude)) ? Number(result.longitude) : null,
        quality: result?.quality ?? null,
        source: "postcode_centroid",
      };
    });
    return json({
      coordinates: coordinates.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)),
      unmatched: coordinates.filter((row) => !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)).map((row) => row.id),
    });
  } catch {
    return json({ error: "The postcode service could not be reached." }, 502);
  }
}
