const TOKEN_PATTERN = /\b(?:eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}|Bearer\s+[a-zA-Z0-9._-]{12,})\b/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export const CLIENT_EVENT_LEVELS = Object.freeze(["warning", "error"]);
export const CLIENT_EVENT_CATEGORIES = Object.freeze([
  "application_crash",
  "runtime_error",
  "unhandled_rejection",
  "sync_failure",
  "session_failure",
  "manual_report",
]);

export function redactSensitiveText(value = "", maxLength = 500) {
  return String(value || "")
    .replace(TOKEN_PATTERN, "[redacted-token]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .slice(0, maxLength);
}

export function buildClientEvent({
  level = "error",
  category = "manual_report",
  message = "Unexpected client error",
  reference = "",
  clubId = null,
  route = "",
  release = "",
  environment = "",
  context = {},
} = {}) {
  const safeLevel = CLIENT_EVENT_LEVELS.includes(level) ? level : "error";
  const safeCategory = CLIENT_EVENT_CATEGORIES.includes(category) ? category : "manual_report";
  const safeContext = context && typeof context === "object" && !Array.isArray(context)
    ? Object.fromEntries(
      Object.entries(context)
        .filter(([key]) => !/password|token|secret|authorization|cookie|email|fixture|team|player/i.test(key))
        .slice(0, 12)
        .map(([key, value]) => [key, redactSensitiveText(typeof value === "string" ? value : JSON.stringify(value), 300)])
    )
    : {};

  return {
    clubId: clubId || null,
    level: safeLevel,
    category: safeCategory,
    message: redactSensitiveText(message, 500) || "Unexpected client error",
    reference: redactSensitiveText(reference, 80),
    route: redactSensitiveText(route, 300),
    release: redactSensitiveText(release, 80),
    environment: redactSensitiveText(environment, 40),
    context: safeContext,
  };
}

export function getClientReleaseMetadata() {
  return {
    release: String(import.meta.env?.VITE_APP_RELEASE || "development").trim(),
    environment: String(import.meta.env?.VITE_APP_ENVIRONMENT || (import.meta.env?.PROD ? "production" : "development")).trim(),
  };
}

export function isClientTelemetryEnabled() {
  return String(import.meta.env?.VITE_MONITORING_ENABLED ?? "true").trim().toLowerCase() !== "false";
}
