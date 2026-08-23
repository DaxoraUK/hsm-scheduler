import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getHealth } from "../../server-api/health.js";
import {
  buildSupportDiagnosticsPack,
  normaliseSystemHealth,
  systemHealthHeadline,
} from "../../src/lib/monitoring/systemHealth.js";

const platformAdmin = readFileSync("src/pages/PlatformAdminPage.jsx", "utf8");
const healthPanel = readFileSync("src/components/system/PlatformSystemHealthPanel.jsx", "utf8");
const productShell = readFileSync("src/layout/ProductShell.jsx", "utf8");
const errorBoundary = readFileSync("src/components/system/AppErrorBoundary.jsx", "utf8");
const globalErrors = readFileSync("src/hooks/useGlobalErrorNotifications.js", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const evidenceScript = readFileSync("scripts/pilot-hardening-evidence.mjs", "utf8");

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in ORIGINAL_ENV)) delete process.env[key];
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("Daxora v3.9.2 pilot hardening and launch confidence", () => {
  it("normalises health checks and builds privacy-bounded support evidence", () => {
    const health = normaliseSystemHealth({
      status: "degraded",
      release: "abc123",
      environment: "staging",
      checks: [
        { code: "supabase", label: "Supabase", state: "ready", detail: "Configured", critical: true },
        { code: "email", label: "Email", state: "conditional", detail: "Sender missing" },
      ],
    });
    const pack = buildSupportDiagnosticsPack({
      health,
      browser: { online: true },
      context: { operatorRole: "admin", secretToken: "must-not-appear" },
    });

    expect(health.summary).toEqual(expect.objectContaining({ ready: 1, conditional: 1, total: 2 }));
    expect(systemHealthHeadline(health)).toContain("configuration warnings");
    expect(pack.schema).toBe("daxora-support-diagnostics-v1");
    expect(pack.context).toEqual({ operatorRole: "admin" });
    expect(JSON.stringify(pack)).not.toContain("must-not-appear");
  });

  it("returns a sanitised server health contract without exposing credentials", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-secret-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret-value";
    process.env.RESEND_API_KEY = "resend-secret-value";
    process.env.COMMUNICATIONS_EMAIL_FROM = "support@example.test";
    process.env.CRON_SECRET = "cron-secret-value";
    process.env.VERCEL_ENV = "preview";

    const response = await getHealth();
    const body = await response.json();
    const serialised = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body).toEqual(expect.objectContaining({ product: "Daxora Ground Control", status: expect.any(String), checks: expect.any(Array) }));
    expect(body.checks.some((item) => item.code === "supabase_service" && item.state === "ready")).toBe(true);
    expect(body.checks.some((item) => item.code === "email" && item.state === "ready")).toBe(true);
    ["anon-secret-value", "service-secret-value", "resend-secret-value", "cron-secret-value"].forEach((secret) => expect(serialised).not.toContain(secret));
  });

  it("adds a lazy platform health workspace and downloadable support pack", () => {
    expect(platformAdmin).toContain('["health", "System health", ShieldCheck]');
    expect(platformAdmin).toContain('lazy(() => import("../components/system/PlatformSystemHealthPanel.jsx"))');
    expect(platformAdmin).toContain("<Suspense");
    expect(healthPanel).toContain('fetch("/api/health"');
    expect(healthPanel).toContain("Download support pack");
    expect(healthPanel).toContain("excludes passwords, access tokens and operational records");
  });

  it("hardens keyboard access, reduced motion and application recovery", () => {
    expect(productShell).toContain("Skip to main content");
    expect(productShell).toContain('id="main-content"');
    expect(productShell).toContain("mainContentRef.current?.focus");
    expect(readFileSync("src/index.css", "utf8")).toContain("prefers-reduced-motion: reduce");
    expect(errorBoundary).toContain("Copy support details");
    expect(globalErrors).toContain('category: "runtime_error"');
    expect(globalErrors).toContain('window.addEventListener("error", handleRuntimeError)');
  });

  it("creates repeatable pilot-hardening release evidence", () => {
    expect(packageJson.scripts["pilot:hardening"]).toBe("node scripts/pilot-hardening-evidence.mjs");
    expect(evidenceScript).toContain("daxora-pilot-hardening-evidence-v1");
    expect(evidenceScript).toContain("no_native_dialogues");
    expect(evidenceScript).toContain("bundle_guardrail");
    expect(evidenceScript).toContain("PILOT_REMOTE_CHECK");
  });
});
