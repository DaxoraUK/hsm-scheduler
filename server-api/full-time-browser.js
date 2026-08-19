const ALLOWED_HOSTS = new Set(["fulltime.thefa.com", "www.fulltime.thefa.com"]);
const ALLOWED_PATHS = new Set(["/fixtures.html", "/referees.html"]);
const MAX_CONTENT_BYTES = 2_000_000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function parseBrowserSourceUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== "443") || !ALLOWED_PATHS.has(url.pathname)) return null;
    url.hash = "";
    url.searchParams.set("itemsPerPage", "500");
    return url;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const source = parseBrowserSourceUrl(requestUrl.searchParams.get("source"));
  if (!source) return json({ error: "Use a public Full-Time fixtures or referees HTTPS page.", code: "FULL_TIME_BROWSER_SOURCE_INVALID" }, 400);

  let browser;
  try {
    const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1440, height: 1000 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
    await page.goto(source.toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("table", { timeout: 20000 });
    const title = await page.title();
    const contents = await page.content();
    if (/just a moment|attention required|access denied/i.test(title) || !/<table\b/i.test(contents)) {
      return json({ error: "Full-Time challenged the automated browser.", code: "FULL_TIME_BROWSER_CHALLENGED" }, 502);
    }
    if (Buffer.byteLength(contents, "utf8") > MAX_CONTENT_BYTES) {
      return json({ error: "The rendered Full-Time page is too large.", code: "FULL_TIME_BROWSER_RESPONSE_TOO_LARGE" }, 502);
    }
    return json({ contents, source: source.toString(), fetchedAt: new Date().toISOString(), renderer: "chromium" });
  } catch (error) {
    return json({ error: "The Full-Time browser scrape did not complete.", detail: String(error?.message || "").slice(0, 240), code: "FULL_TIME_BROWSER_FAILED" }, 502);
  } finally {
    await browser?.close().catch(() => {});
  }
}
