const ALLOWED_HOSTS = new Set(["fulltime.thefa.com", "www.fulltime.thefa.com"]);
const MAX_RESPONSE_BYTES = 2_000_000;

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function parseFullTimeSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== "443")) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const source = parseFullTimeSourceUrl(requestUrl.searchParams.get("source"));
  if (!source) {
    return json({ error: "Use a secure Full-Time page hosted by fulltime.thefa.com.", code: "FULL_TIME_SOURCE_INVALID" }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(source, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Daxora-Ground-Control/3.10.43 (+fixture-import)",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      return json({ error: "Full-Time redirected this page. Save the final HTTPS Full-Time URL and try again.", code: "FULL_TIME_REDIRECTED" }, 502);
    }
    if (!response.ok) {
      return json({ error: "Full-Time did not return a usable fixture page.", code: "FULL_TIME_UPSTREAM_ERROR" }, 502);
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) {
      return json({ error: "The Full-Time fixture page is too large to import safely.", code: "FULL_TIME_RESPONSE_TOO_LARGE" }, 502);
    }
    const contents = await response.text();
    if (contents.length > MAX_RESPONSE_BYTES) {
      return json({ error: "The Full-Time fixture page is too large to import safely.", code: "FULL_TIME_RESPONSE_TOO_LARGE" }, 502);
    }
    return json({ contents, source: source.toString(), fetchedAt: new Date().toISOString() }, 200, {
      "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return json({
      error: timedOut ? "Full-Time did not respond in time." : "Full-Time could not be reached.",
      code: timedOut ? "FULL_TIME_TIMEOUT" : "FULL_TIME_UNAVAILABLE",
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
}
