import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, ".release-evidence");
mkdirSync(outputDir, { recursive: true });

function parseArguments(argv) {
  const result = { envFile: "", allowDirty: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--env-file") result.envFile = argv[index + 1] || "";
    if (value === "--allow-dirty") result.allowDirty = true;
  }
  return result;
}

function parseEnvFile(path) {
  if (!path || !existsSync(path)) return {};
  const values = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isPlaceholder(value = "") {
  return !value || /YOUR_|REPLACE_ME|EXAMPLE|CHANGE_ME|localhost/i.test(value);
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function check(name, passed, detail, { advisory = false } = {}) {
  return { name, passed: Boolean(passed), detail, advisory };
}

const args = parseArguments(process.argv.slice(2));
const envPath = args.envFile ? resolve(root, args.envFile) : join(root, ".env.staging.local");
const fileEnv = parseEnvFile(envPath);
const env = { ...fileEnv, ...process.env };

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_APP_ENVIRONMENT",
  "VITE_APP_RELEASE",
  "VITE_MONITORING_ENABLED",
  "STAGING_URL",
  "STAGING_SUPABASE_PROJECT_REF",
];

const checks = [];
for (const key of required) {
  const present = !isPlaceholder(env[key]);
  checks.push(check(`${key} configured`, present, present ? "Configured without an example placeholder." : "Missing or still contains an example value."));
}

const supabaseUrl = safeUrl(env.VITE_SUPABASE_URL || "");
const stagingUrl = safeUrl(env.STAGING_URL || "");
checks.push(check(
  "Staging Supabase URL uses HTTPS",
  supabaseUrl?.protocol === "https:" && /\.supabase\.co$/i.test(supabaseUrl.hostname),
  supabaseUrl ? supabaseUrl.origin : "Invalid URL.",
));
checks.push(check(
  "Staging application URL uses HTTPS",
  stagingUrl?.protocol === "https:",
  stagingUrl ? stagingUrl.origin : "Invalid URL.",
));
checks.push(check(
  "Application environment is staging",
  env.VITE_APP_ENVIRONMENT === "staging",
  env.VITE_APP_ENVIRONMENT || "Not configured.",
));
checks.push(check(
  "Client monitoring is enabled",
  String(env.VITE_MONITORING_ENABLED).toLowerCase() === "true",
  env.VITE_MONITORING_ENABLED || "Not configured.",
));
checks.push(check(
  "Release identifier is staging-specific",
  /^ground-control-staging-[A-Za-z0-9._-]+$/.test(env.VITE_APP_RELEASE || ""),
  env.VITE_APP_RELEASE || "Not configured.",
));

const urlProjectRef = supabaseUrl?.hostname?.split(".")[0] || "";
checks.push(check(
  "Supabase project reference matches the staging URL",
  Boolean(urlProjectRef) && urlProjectRef === env.STAGING_SUPABASE_PROJECT_REF,
  urlProjectRef && env.STAGING_SUPABASE_PROJECT_REF
    ? `URL project ${urlProjectRef}; declared project ${env.STAGING_SUPABASE_PROJECT_REF}.`
    : "Project reference unavailable.",
));

const forbiddenBrowserKeys = ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
const exposedForbidden = forbiddenBrowserKeys.filter((key) => env[`VITE_${key}`] || env[key]?.startsWith("VITE_"));
checks.push(check(
  "No server-only secrets are configured as browser variables",
  exposedForbidden.length === 0,
  exposedForbidden.length ? `Unsafe variables: ${exposedForbidden.join(", ")}` : "No server-only secret names detected in browser configuration.",
));

const vercelPath = join(root, "vercel.json");
let vercel = null;
try {
  vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
} catch {
  // Recorded below.
}
const headerNames = new Set((vercel?.headers || []).flatMap((entry) => (entry.headers || []).map((header) => String(header.key).toLowerCase())));
checks.push(check("Vercel SPA fallback is configured", Boolean(vercel?.routes?.some((route) => route.dest === "/index.html")), "Expected a catch-all route to /index.html."));
checks.push(check(
  "Baseline security headers are configured",
  ["x-content-type-options", "x-frame-options", "referrer-policy", "strict-transport-security"].every((name) => headerNames.has(name)),
  [...headerNames].sort().join(", ") || "No headers found.",
));

const tracked = commandOutput("git", ["ls-files"]).split(/\r?\n/).filter(Boolean);
const trackedSecrets = tracked.filter((path) => path === ".env" || path === ".env.local" || /^\.env\..*\.local$/.test(path));
checks.push(check(
  "No local environment files are tracked",
  trackedSecrets.length === 0,
  trackedSecrets.length ? `Tracked: ${trackedSecrets.join(", ")}` : "No local environment files are tracked by Git.",
));

const dirtyLines = commandOutput("git", ["status", "--porcelain", "--untracked-files=no"]).split(/\r?\n/).filter(Boolean);
checks.push(check(
  "Tracked working tree is clean",
  args.allowDirty || dirtyLines.length === 0,
  dirtyLines.length ? `${dirtyLines.length} tracked change(s) remain. Commit the staging candidate before deployment.` : "No tracked changes.",
  { advisory: args.allowDirty },
));

const branch = commandOutput("git", ["branch", "--show-current"]) || "unavailable";
checks.push(check(
  "Deployment branch is identifiable",
  branch !== "unavailable",
  branch === "staging" ? "staging" : `${branch}; use a protected staging deployment or an explicitly approved preview release.`,
  { advisory: branch !== "staging" },
));

const migrationDir = join(root, "supabase", "migrations");
const migrationFiles = readdirSync(migrationDir)
  .filter((name) => /^\d{12}_.+\.sql$/.test(name))
  .sort();
const migrationManifest = migrationFiles.map((name) => {
  const path = join(migrationDir, name);
  return { file: name, bytes: statSync(path).size, sha256: sha256(path) };
});
checks.push(check(
  "Migration set is present",
  migrationFiles.length >= 12,
  `${migrationFiles.length} ordered migration files found from ${migrationFiles[0] || "none"} to ${migrationFiles.at(-1) || "none"}.`,
));
checks.push(check(
  "Staging schema audit is present",
  existsSync(join(root, "supabase", "tests", "staging_schema_audit.sql")),
  "Run this audit in the staging SQL editor after applying migrations.",
));
checks.push(check(
  "Cross-club isolation proof is present",
  existsSync(join(root, "supabase", "tests", "rls_isolation.sql")),
  "Run with two real staging auth users and retain the PASS output.",
));

const linkedProjectPath = join(root, "supabase", ".temp", "project-ref");
const linkedProjectRef = existsSync(linkedProjectPath) ? readFileSync(linkedProjectPath, "utf8").trim() : "";
checks.push(check(
  "Linked Supabase project reviewed",
  true,
  linkedProjectRef
    ? linkedProjectRef === env.STAGING_SUPABASE_PROJECT_REF
      ? "The local Supabase CLI link matches the declared staging project. Confirm this project contains no production customer data."
      : `The CLI is linked to ${linkedProjectRef}, while staging is ${env.STAGING_SUPABASE_PROJECT_REF}. Use --project-ref explicitly and do not push to the wrong project.`
    : "No local linked project reference was found; use --project-ref explicitly.",
  { advisory: true },
));

const blockers = checks.filter((item) => !item.passed && !item.advisory);
const warnings = checks.filter((item) => item.advisory || (!item.passed && item.advisory));
const generatedAt = new Date().toISOString();
const runId = generatedAt.replaceAll(":", "-").replaceAll(".", "-");
const evidence = {
  schemaVersion: 1,
  generatedAt,
  environment: "staging-preflight",
  release: env.VITE_APP_RELEASE || "unlabelled-staging-release",
  result: blockers.length === 0 ? "ready_for_remote_verification" : "blocked",
  configurationSource: existsSync(envPath) ? relative(root, envPath) : "process environment",
  repository: {
    branch,
    gitSha: commandOutput("git", ["rev-parse", "--short", "HEAD"]) || "unavailable",
  },
  checks,
  migrations: migrationManifest,
  remoteActionsRequired: [
    "Apply every migration to the declared staging Supabase project in filename order.",
    "Run supabase/tests/staging_schema_audit.sql and retain the PASS output.",
    "Run supabase/tests/rls_isolation.sql with two real staging auth users and retain the PASS output.",
    "Deploy the committed release to the declared staging URL.",
    "Run npm run smoke:staging and record the resulting evidence artifact.",
    "Complete the manual staging checks in docs/STAGING_RUNBOOK.md.",
  ],
};

const jsonPath = join(outputDir, `staging-preflight-${runId}.json`);
const mdPath = join(outputDir, `staging-preflight-${runId}.md`);
const manifestPath = join(outputDir, `staging-migration-manifest-${runId}.json`);
writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(join(outputDir, "latest-staging-preflight.json"), `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(manifestPath, `${JSON.stringify({ generatedAt, release: evidence.release, migrations: migrationManifest }, null, 2)}\n`);

const markdown = `# Ground Control staging preflight\n\n- **Generated:** ${generatedAt}\n- **Release:** ${evidence.release}\n- **Result:** ${evidence.result.toUpperCase()}\n- **Branch:** ${branch}\n- **Migration files:** ${migrationFiles.length}\n\n## Checks\n\n${checks.map((item) => `- **${item.name}:** ${item.advisory ? "REVIEW" : item.passed ? "PASS" : "FAIL"} — ${item.detail}`).join("\n")}\n\n## Remote evidence still required\n\n${evidence.remoteActionsRequired.map((item) => `- ${item}`).join("\n")}\n\nThis preflight proves repository and configuration readiness only. It does not prove that staging is deployed, migrations are applied, tenant isolation has passed, or the HSM pilot has run.\n`;
writeFileSync(mdPath, markdown);
writeFileSync(join(outputDir, "latest-staging-preflight.md"), markdown);

console.log(`Ground Control staging preflight: ${evidence.result.toUpperCase()}`);
console.log(`Evidence: ${relative(root, jsonPath)}`);
console.log(`Migration manifest: ${relative(root, manifestPath)}`);
if (warnings.length) console.log(`Review items: ${warnings.length}`);
process.exit(blockers.length === 0 ? 0 : 1);
