import { isSupaConfigured } from "../supabase.js";
import { getClientReleaseMetadata, isClientTelemetryEnabled } from "../monitoring/clientTelemetry.js";

function currentLocation() {
  if (typeof window === "undefined") {
    return { protocol: "", hostname: "server", host: "server" };
  }
  return window.location;
}

function isLocalHost(hostname = "") {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname || "").toLowerCase());
}

export function getClientStagingDiagnostics() {
  const location = currentLocation();
  const releaseMetadata = getClientReleaseMetadata();
  const environment = String(releaseMetadata.environment || "development").toLowerCase();
  const release = String(releaseMetadata.release || "development");
  const local = isLocalHost(location.hostname);
  const secureContext = typeof window === "undefined" ? false : Boolean(window.isSecureContext || local);
  const deployedEnvironment = ["staging", "production"].includes(environment);
  const releaseNamed = Boolean(release && !["development", "unknown"].includes(release.toLowerCase()));

  const checks = [
    {
      code: "environment_label",
      label: "Deployment environment labelled",
      passed: deployedEnvironment,
      detail: deployedEnvironment ? `Running as ${environment}` : "Set VITE_APP_ENVIRONMENT to staging before deployment.",
    },
    {
      code: "release_label",
      label: "Release identifier present",
      passed: releaseNamed,
      detail: releaseNamed ? release : "Set VITE_APP_RELEASE to a unique release identifier.",
    },
    {
      code: "supabase_configuration",
      label: "Supabase browser configuration present",
      passed: isSupaConfigured(),
      detail: isSupaConfigured() ? "Public project URL and anon/publishable key are configured." : "Staging Supabase configuration is missing.",
    },
    {
      code: "secure_context",
      label: "Secure browser context",
      passed: secureContext,
      detail: secureContext ? (local ? "Localhost secure-context exception" : "HTTPS is active") : "Deploy with HTTPS before testing authentication or uploads.",
    },
    {
      code: "client_monitoring",
      label: "Client error monitoring enabled",
      passed: isClientTelemetryEnabled(),
      detail: isClientTelemetryEnabled() ? "Sanitised client events are enabled." : "Enable VITE_MONITORING_ENABLED for staging.",
    },
  ];

  const passed = checks.filter((check) => check.passed).length;
  return Object.freeze({
    environment,
    release,
    host: String(location.host || "unknown"),
    protocol: String(location.protocol || ""),
    checks: Object.freeze(checks.map(Object.freeze)),
    passed,
    total: checks.length,
    ready: passed === checks.length,
    summary: passed === checks.length
      ? `All ${checks.length} browser-visible staging checks pass.`
      : `${checks.length - passed} browser-visible staging check${checks.length - passed === 1 ? "" : "s"} need attention.`,
  });
}
