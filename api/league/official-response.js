function env(name) {
  return String(process.env[name] || "").trim();
}

function config() {
  return {
    url: (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, ""),
    key: env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY") || env("VITE_SUPABASE_ANON_KEY"),
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  }[character]));
}

function page({ title, message, success = false }) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#f1f5f9;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:28px;padding:36px;box-shadow:0 24px 70px rgba(15,23,42,.12)}.mark{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:${success ? "#d1fae5" : "#fee2e2"};color:${success ? "#047857" : "#be123c"};font-size:28px;font-weight:900}h1{margin:22px 0 10px;font-size:28px}p{margin:0;color:#475569;line-height:1.7;font-weight:600}.brand{margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#64748b}</style></head><body><main class="wrap"><section class="card"><div class="mark">${success ? "✓" : "!"}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="brand">Daxora League Manager</div></section></main></body></html>`, { status: success ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}


function responseChoicePage(token) {
  const safeToken = encodeURIComponent(token);
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Respond to appointment</title><style>body{margin:0;background:#f1f5f9;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(580px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:28px;padding:36px;box-shadow:0 24px 70px rgba(15,23,42,.12)}.mark{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:#d1fae5;color:#047857;font-size:28px;font-weight:900}h1{margin:22px 0 10px;font-size:28px}p{margin:0;color:#475569;line-height:1.7;font-weight:600}.actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:28px}.button{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;text-decoration:none;font-weight:900}.accept{background:#059669;color:#fff}.decline{background:#fff1f2;color:#be123c;border:1px solid #fecdd3}.brand{margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#64748b}@media(max-width:520px){.actions{grid-template-columns:1fr}}</style></head><body><main class="wrap"><section class="card"><div class="mark">✓</div><h1>Match official appointment</h1><p>Please confirm whether you can accept this appointment. Your response is recorded immediately and the league appointments team will see it.</p><div class="actions"><a class="button accept" href="?token=${safeToken}&decision=accepted">Accept appointment</a><a class="button decline" href="?token=${safeToken}&decision=declined">Decline appointment</a></div><div class="brand">Daxora League Manager</div></section></main></body></html>`, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function GET(request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  const decision = String(url.searchParams.get("decision") || "").trim().toLowerCase();
  if (!token) {
    return page({ title: "Invalid appointment response", message: "This response link is incomplete. Ask the league appointments secretary for a new link." });
  }
  if (!decision) return responseChoicePage(token);
  if (!["accepted", "declined"].includes(decision)) {
    return page({ title: "Invalid appointment response", message: "This response choice is not recognised. Ask the league appointments secretary for a new link." });
  }

  const { url: supabaseUrl, key } = config();
  if (!supabaseUrl || !key) {
    return page({ title: "Response service unavailable", message: "The league response service is not configured. Contact the league appointments secretary." });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/respond_to_league_official_assignment`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ response_token: token, decision }),
    });
    const payload = await readPayload(response);
    if (!response.ok) throw new Error(payload?.message || payload?.error || "The response could not be recorded");
    const accepted = decision === "accepted";
    return page({
      success: true,
      title: accepted ? "Appointment accepted" : "Decline recorded",
      message: accepted
        ? `Thank you. Your ${String(payload?.role || "match official").replaceAll("_", " ")} appointment on ${payload?.target_date || "the fixture date"} at ${String(payload?.kick_off || "").slice(0, 5) || "the confirmed time"} is now accepted.`
        : "Thank you. The league appointments team has been told that a replacement is required.",
    });
  } catch (error) {
    return page({ title: "Response could not be recorded", message: error?.message || "The link may have expired. Ask the league appointments secretary for a replacement link." });
  }
}
