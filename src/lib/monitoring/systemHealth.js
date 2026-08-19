import { getClientReleaseMetadata } from "./clientTelemetry.js";

const VALID_STATES = new Set(["ready", "conditional", "optional", "blocked", "unknown"]);

function safeText(value, maxLength = 300) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength);
}

export function normaliseSystemHealth(payload = {}) {
  const checks = (Array.isArray(payload?.checks) ? payload.checks : []).map((item, index) => ({
    code: safeText(item?.code || `check_${index + 1}`, 80),
    label: safeText(item?.label || "System check", 120),
    state: VALID_STATES.has(item?.state) ? item.state : "unknown",
    detail: safeText(item?.detail || "No diagnostic detail was returned.", 500),
    critical: Boolean(item?.critical),
    category: safeText(item?.category || "platform", 80),
  }));

  const blocked = checks.filter((item) => item.state === "blocked").length;
  const conditional = checks.filter((item) => item.state === "conditional").length;
  const ready = checks.filter((item) => item.state === "ready").length;
  const status = ["ready", "degraded", "not_ready"].includes(payload?.status)
    ? payload.status
    : blocked
      ? "not_ready"
      : conditional
        ? "degraded"
        : checks.length
          ? "ready"
          : "not_ready";

  return {
    product: safeText(payload?.product || "Daxora Ground Control", 120),
    status,
    generatedAt: payload?.generatedAt || null,
    environment: safeText(payload?.environment || "unknown", 40),
    branch: safeText(payload?.branch || "", 80) || null,
    release: safeText(payload?.release || "unknown", 100),
    region: safeText(payload?.region || "", 80) || null,
    checks,
    summary: {
      ready,
      conditional,
      optional: checks.filter((item) => item.state === "optional").length,
      blocked,
      total: checks.length,
    },
  };
}

export function buildBrowserDiagnostics({ now = new Date() } = {}) {
  const release = getClientReleaseMetadata();
  const navigatorValue = typeof navigator === "undefined" ? {} : navigator;
  const windowValue = typeof window === "undefined" ? {} : window;
  const screenValue = typeof screen === "undefined" ? {} : screen;

  return {
    capturedAt: now instanceof Date ? now.toISOString() : new Date(now).toISOString(),
    release: release.release,
    environment: release.environment,
    route: safeText(windowValue.location?.pathname || "", 240),
    online: navigatorValue.onLine !== false,
    language: safeText(navigatorValue.language || "unknown", 40),
    timezone: safeText(Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown", 80),
    viewport: {
      width: Number(windowValue.innerWidth || 0),
      height: Number(windowValue.innerHeight || 0),
      pixelRatio: Number(windowValue.devicePixelRatio || 1),
    },
    screen: {
      width: Number(screenValue.width || 0),
      height: Number(screenValue.height || 0),
    },
    capabilities: {
      serviceWorker: Boolean(navigatorValue.serviceWorker),
      notifications: typeof Notification !== "undefined",
      pushManager: typeof PushManager !== "undefined",
      clipboard: Boolean(navigatorValue.clipboard),
      storage: typeof localStorage !== "undefined",
    },
    browser: safeText(navigatorValue.userAgent || "unknown", 300),
  };
}

export function buildSupportDiagnosticsPack({ health, browser, context = {} } = {}) {
  return {
    schema: "daxora-support-diagnostics-v1",
    generatedAt: new Date().toISOString(),
    health: normaliseSystemHealth(health),
    browser: browser || buildBrowserDiagnostics(),
    context: Object.fromEntries(
      Object.entries(context || {})
        .filter(([key]) => !/password|token|secret|authorization|cookie/i.test(key))
        .slice(0, 20)
        .map(([key, value]) => [safeText(key, 80), safeText(value, 300)]),
    ),
    privacy: "This pack intentionally excludes passwords, tokens, fixture content, player data and private documents.",
  };
}

export function systemHealthHeadline(health) {
  const model = normaliseSystemHealth(health);
  if (model.status === "ready") return "All critical platform services are configured";
  if (model.status === "degraded") return "The platform is available with configuration warnings";
  return "One or more critical platform services need attention";
}
