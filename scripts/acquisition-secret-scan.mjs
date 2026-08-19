import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outputDir = path.join(root, ".release-evidence");
fs.mkdirSync(outputDir, { recursive: true });

let trackedFiles = new Set();
try {
  trackedFiles = new Set(
    execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((item) => item.trim().replaceAll("\\", "/"))
      .filter(Boolean),
  );
} catch {
  // Source archives may not contain Git metadata.
}

const ignoredSegments = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  ".daxora-backups",
  ".release-evidence",
  ".vercel",
  ".supabase",
]);

const permittedSecretExamples = new Set([
  ".env.example",
  ".env.edge.example",
  ".env.production.example",
  ".env.staging.example",
]);

const forbiddenFileNames = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.staging",
  ".env.development",
  "service-account.json",
];

const patterns = [
  ["Supabase service role JWT", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?eyJ[A-Za-z0-9_-]{20,}/i],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["OpenAI API key", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Vercel token assignment", /\bVERCEL_TOKEN\s*=\s*[^\s#]{20,}/i],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Database URL with password", /(?:postgres|postgresql):\/\/[^\s:]+:[^\s@]+@[^\s/]+/i],
  ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
  ["Resend live key", /\bre_[A-Za-z0-9]{20,}\b/],
];

function allFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) allFiles(fullPath, output);
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

const findings = [];
const files = allFiles(root);

for (const filePath of files) {
  const rel = relative(filePath);
  const base = path.basename(filePath);
  if (forbiddenFileNames.includes(base) && !permittedSecretExamples.has(base)) {
    const tracked = trackedFiles.has(rel);
    findings.push({
      severity: tracked ? "high" : "review",
      type: "forbidden-file",
      file: rel,
      message: tracked
        ? `${base} is tracked and must not be included in an acquisition package.`
        : `${base} exists locally but is untracked. Confirm the clean Git archive excludes it.`,
    });
  }

  const stats = fs.statSync(filePath);
  if (stats.size > 2_000_000) continue;
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    continue;
  }

  for (const [label, pattern] of patterns) {
    if (pattern.test(content)) {
      const exampleFile = permittedSecretExamples.has(base);
      const tracked = trackedFiles.has(rel);
      findings.push({
        severity: exampleFile || !tracked ? "review" : "high",
        type: "pattern",
        file: rel,
        message: `${label}${exampleFile ? " appears in an example template; confirm it is a placeholder." : " detected."}`,
      });
    }
  }
}

let trackedEnvFiles = [];
try {
  trackedEnvFiles = execFileSync("git", ["ls-files", ".env", ".env.*"], { cwd: root, encoding: "utf8" })
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !permittedSecretExamples.has(path.basename(item)));
} catch {
  // The scan remains useful in a source archive without Git metadata.
}

for (const file of trackedEnvFiles) {
  findings.push({ severity: "high", type: "tracked-env", file, message: "A non-example environment file is tracked by Git." });
}

const high = findings.filter((item) => item.severity === "high");
const report = {
  generatedAt: new Date().toISOString(),
  root,
  scannedFiles: files.length,
  status: high.length ? "FAIL" : "PASS",
  highRiskFindings: high.length,
  reviewFindings: findings.length - high.length,
  findings,
};

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const reportPath = path.join(outputDir, `teamfeepay-secret-scan-${stamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`TeamFeePay acquisition secret scan: ${report.status}`);
console.log(`Scanned files: ${report.scannedFiles}`);
console.log(`High-risk findings: ${report.highRiskFindings}`);
console.log(`Review findings: ${report.reviewFindings}`);
console.log(`Evidence: ${path.relative(root, reportPath)}`);
if (findings.length) {
  for (const finding of findings.slice(0, 20)) {
    console.log(`${finding.severity.toUpperCase()} ${finding.file}: ${finding.message}`);
  }
}
process.exitCode = high.length ? 1 : 0;
