import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const results = [];

function add(code, passed, detail, { critical = true } = {}) {
  results.push({ code, passed: Boolean(passed), detail, critical });
}

function text(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function has(path, token) {
  return existsSync(resolve(root, path)) && text(path).includes(token);
}

function walk(directory, predicate, items = []) {
  if (!existsSync(directory)) return items;
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, predicate, items);
    else if (predicate(full)) items.push(full);
  }
  return items;
}

add("health_endpoint", has("server-api/health.js", "x-daxora-health") && has("server-api/health.js", "SUPABASE_SERVICE_ROLE_KEY"), "Sanitised deployment health endpoint is present.");
add("system_health_ui", has("src/components/system/PlatformSystemHealthPanel.jsx", "Download support pack") && has("src/pages/PlatformAdminPage.jsx", "System health"), "Platform operators have a health and diagnostics workspace.");
add("support_pack_privacy", has("src/lib/monitoring/systemHealth.js", "excludes passwords, tokens") && has("src/lib/monitoring/systemHealth.js", "daxora-support-diagnostics-v1"), "Support diagnostics declare and enforce privacy boundaries.");
add("application_recovery", has("src/components/system/AppErrorBoundary.jsx", "Copy support details") && has("src/hooks/useGlobalErrorNotifications.js", "runtime_error"), "Render, promise and browser runtime errors have branded recovery and support references.");
add("accessibility_navigation", has("src/layout/ProductShell.jsx", "Skip to main content") && has("src/layout/ProductShell.jsx", 'id="main-content"') && has("src/index.css", "prefers-reduced-motion"), "Keyboard navigation, focus restoration and reduced-motion support are present.");
add("admin_code_splitting", has("src/pages/PlatformAdminPage.jsx", 'lazy(() => import("../components/system/PlatformSystemHealthPanel.jsx"))') && has("src/pages/PlatformAdminPage.jsx", "<Suspense"), "Heavy platform-administration panels load on demand.", { critical: false });

const nativeDialogPattern = /(?:window\.)?(?:alert|confirm|prompt)\s*\(/;
const productFiles = walk(resolve(root, "src"), (path) => /\.(?:js|jsx|ts|tsx)$/.test(path));
const nativeDialogFiles = productFiles.filter((path) => nativeDialogPattern.test(readFileSync(path, "utf8")));
add("no_native_dialogues", nativeDialogFiles.length === 0, nativeDialogFiles.length ? `Native browser dialogues remain in: ${nativeDialogFiles.map((path) => relative(root, path)).join(", ")}` : "No native browser alert, confirm or prompt calls remain.");

const vercel = JSON.parse(text("vercel.json"));
const headers = (vercel.headers || []).flatMap((entry) => entry.headers || []).map((item) => String(item.key || "").toLowerCase());
for (const required of ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy", "strict-transport-security"]) {
  add(`security_header_${required}`, headers.includes(required), `${required} is configured in vercel.json.`);
}

const dist = resolve(root, "dist");
const scripts = walk(dist, (path) => path.endsWith(".js"));
const largest = scripts.map((path) => ({ path, bytes: statSync(path).size })).sort((left, right) => right.bytes - left.bytes)[0] || null;
add("production_build", existsSync(join(dist, "index.html")) && scripts.length > 0, "A production Vite build exists for pilot acceptance.");
add("bundle_guardrail", !largest || largest.bytes <= 700 * 1024, largest ? `Largest JavaScript chunk is ${Math.round(largest.bytes / 1024)} KB (${relative(dist, largest.path)}).` : "No JavaScript bundle was found.", { critical: false });

for (const path of [
  "docs/DAXORA_V392_PILOT_HARDENING_LAUNCH_CONFIDENCE.md",
  "docs/DAXORA_V392_ROLLOUT.md",
  "docs/PILOT_OPERATIONS_RUNBOOK.md",
  "docs/INCIDENT_RESPONSE_RUNBOOK.md",
  "docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md",
]) {
  add(`runbook_${path.split("/").pop()}`, existsSync(resolve(root, path)), `${path} is present.`);
}

if (String(process.env.PILOT_REMOTE_CHECK || "").toLowerCase() === "true") {
  const base = String(process.env.STAGING_URL || "").replace(/\/$/, "");
  if (!base) {
    add("remote_staging_url", false, "PILOT_REMOTE_CHECK=true but STAGING_URL is missing.");
  } else {
    try {
      const [homeResponse, healthResponse] = await Promise.all([
        fetch(base, { headers: { accept: "text/html" } }),
        fetch(`${base}/api/health`, { headers: { accept: "application/json" } }),
      ]);
      const health = await healthResponse.json().catch(() => ({}));
      add("remote_home", homeResponse.ok, `Staging homepage returned ${homeResponse.status}.`);
      add("remote_health", healthResponse.ok && Array.isArray(health?.checks), `Staging health returned ${healthResponse.status} with status ${health?.status || "unknown"}.`);
      add("remote_security_headers", Boolean(homeResponse.headers.get("x-content-type-options")) && Boolean(homeResponse.headers.get("strict-transport-security")), "Staging security headers are visible.");
    } catch (error) {
      add("remote_staging", false, error?.message || "Staging could not be reached.");
    }
  }
}

const criticalFailures = results.filter((item) => item.critical && !item.passed);
const warnings = results.filter((item) => !item.critical && !item.passed);
const evidence = {
  schema: "daxora-pilot-hardening-evidence-v1",
  generatedAt: new Date().toISOString(),
  release: process.env.RELEASE_ID || process.env.VITE_APP_RELEASE || "local",
  environment: process.env.RELEASE_ENVIRONMENT || process.env.VITE_APP_ENVIRONMENT || "local",
  status: criticalFailures.length ? "fail" : warnings.length ? "pass_with_warnings" : "pass",
  summary: {
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    criticalFailures: criticalFailures.length,
    warnings: warnings.length,
  },
  results,
};

const evidenceDir = resolve(root, ".release-evidence");
mkdirSync(evidenceDir, { recursive: true });
const stamp = evidence.generatedAt.replace(/[:.]/g, "-");
const jsonPath = join(evidenceDir, `pilot-hardening-${stamp}.json`);
const markdownPath = join(evidenceDir, `pilot-hardening-${stamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(markdownPath, [
  "# Daxora pilot-hardening evidence",
  "",
  `- Status: **${evidence.status.toUpperCase()}**`,
  `- Generated: ${evidence.generatedAt}`,
  `- Release: ${evidence.release}`,
  `- Environment: ${evidence.environment}`,
  "",
  ...results.map((item) => `- ${item.passed ? "PASS" : item.critical ? "FAIL" : "WARN"} — **${item.code}**: ${item.detail}`),
  "",
].join("\n"));

for (const item of results) console.log(`${item.passed ? "PASS" : item.critical ? "FAIL" : "WARN"} ${item.code}: ${item.detail}`);
console.log(`Evidence: ${relative(root, jsonPath)}`);
console.log(`Daxora pilot hardening: ${evidence.status.toUpperCase()}`);
if (criticalFailures.length) process.exit(1);
