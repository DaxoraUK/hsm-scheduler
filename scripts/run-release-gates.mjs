import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, ".release-evidence");
mkdirSync(outputDir, { recursive: true });

const startedAt = new Date();
const runId = startedAt.toISOString().replaceAll(":", "-").replaceAll(".", "-");

function tail(text = "", lines = 60) {
  return String(text || "").split(/\r?\n/).slice(-lines).join("\n");
}

function run(name, command, args, options = {}) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    shell: false,
    ...options,
  });
  const output = [
    result.stdout || "",
    result.stderr || "",
    result.error ? `${result.error.name}: ${result.error.message}` : "",
  ].filter(Boolean).join("\n").trim();
  return {
    name,
    passed: result.status === 0,
    status: result.status ?? 1,
    signal: result.signal || null,
    durationMs: Date.now() - started,
    outputTail: tail(output),
  };
}

function resolveNpmInvocation() {
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath && existsSync(npmExecPath)) {
    return {
      command: process.execPath,
      prefixArgs: [npmExecPath],
      description: `node ${npmExecPath}`,
      shell: false,
    };
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return {
    command: npmCommand,
    prefixArgs: [],
    description: npmCommand,
    shell: process.platform === "win32",
  };
}

const npmInvocation = resolveNpmInvocation();

function runNpm(name, scriptName) {
  return run(
    name,
    npmInvocation.command,
    [...npmInvocation.prefixArgs, "run", scriptName],
    { shell: npmInvocation.shell },
  );
}

function listFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".release-evidence", "coverage"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) listFiles(path, output);
    else output.push(path);
  }
  return output;
}

function repositoryChecks() {
  const checks = [];
  const gitResult = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (gitResult.status === 0) {
    const tracked = String(gitResult.stdout || "").split(/\r?\n/).filter(Boolean);
    const trackedSecrets = tracked.filter((path) => path === ".env" || path === ".env.local" || /^\.env\..*\.local$/.test(path));
    checks.push({
      name: "No environment secret files tracked by Git",
      passed: trackedSecrets.length === 0,
      detail: trackedSecrets.length ? `Tracked secret-like files: ${trackedSecrets.join(", ")}` : "No .env or .env.*.local files are tracked.",
    });
  } else {
    checks.push({
      name: "Git secret-file check",
      passed: false,
      advisory: true,
      detail: "Git metadata was unavailable, so tracked environment files could not be verified.",
    });
  }

  const browserFiles = listFiles(join(root, "src")).filter((path) => /\.(js|jsx|ts|tsx)$/.test(path));
  const forbiddenNames = ["SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"];
  const browserSecretReferences = [];
  for (const path of browserFiles) {
    const content = readFileSync(path, "utf8");
    for (const name of forbiddenNames) {
      if (content.includes(name)) browserSecretReferences.push(`${relative(root, path)}:${name}`);
    }
  }
  checks.push({
    name: "No server-only secret names referenced by browser source",
    passed: browserSecretReferences.length === 0,
    detail: browserSecretReferences.length ? `References found: ${browserSecretReferences.join(", ")}` : "Browser source does not reference service-role or Stripe server secrets.",
  });

  const requiredExamples = [".env.example", ".env.production.example", ".env.staging.example", ".env.edge.example"];
  const missingExamples = requiredExamples.filter((path) => {
    try {
      return !statSync(join(root, path)).isFile();
    } catch {
      return true;
    }
  });
  checks.push({
    name: "Deployment environment examples present",
    passed: missingExamples.length === 0,
    detail: missingExamples.length ? `Missing: ${missingExamples.join(", ")}` : requiredExamples.join(", "),
  });

  return checks;
}

const commands = [
  runNpm("Lint", "lint"),
  runNpm("Regression tests", "test"),
  run("Launch acceptance matrix", process.execPath, ["scripts/launch-acceptance.mjs", "--check-only"]),
  runNpm("Production build", "build"),
];
const repository = repositoryChecks();
const requiredPassed = commands.every((item) => item.passed) && repository.filter((item) => !item.advisory).every((item) => item.passed);

const gitSha = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
const branch = spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8", windowsHide: true });
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const evidence = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  environment: process.env.RELEASE_ENVIRONMENT || "local",
  release: process.env.RELEASE_ID || process.env.GITHUB_SHA?.slice(0, 12) || "unlabelled-local-release",
  repository: {
    packageName: packageJson.name,
    packageVersion: packageJson.version,
    gitSha: gitSha.status === 0 ? gitSha.stdout.trim() : "unavailable",
    branch: branch.status === 0 ? branch.stdout.trim() : "unavailable",
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    npmInvocation: npmInvocation.description,
  },
  result: requiredPassed ? "pass" : "fail",
  commands,
  repositoryChecks: repository,
};

const jsonPath = join(outputDir, `release-evidence-${runId}.json`);
const markdownPath = join(outputDir, `release-evidence-${runId}.md`);
const latestJsonPath = join(outputDir, "latest.json");
const latestMarkdownPath = join(outputDir, "latest.md");
writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
writeFileSync(latestJsonPath, `${JSON.stringify(evidence, null, 2)}\n`);

const markdown = `# Ground Control release evidence\n\n- **Generated:** ${evidence.generatedAt}\n- **Environment:** ${evidence.environment}\n- **Release:** ${evidence.release}\n- **Result:** ${evidence.result.toUpperCase()}\n- **Git:** ${evidence.repository.gitSha} (${evidence.repository.branch})\n- **Node:** ${evidence.repository.node}\n- **npm runner:** ${evidence.repository.npmInvocation}\n\n## Automated release checks\n\n${commands.map((item) => `- **${item.name}:** ${item.passed ? "PASS" : "FAIL"} (${Math.round(item.durationMs / 1000)}s)`).join("\n")}\n\n## Repository safety checks\n\n${repository.map((item) => `- **${item.name}:** ${item.passed ? "PASS" : item.advisory ? "REVIEW" : "FAIL"} — ${item.detail}`).join("\n")}\n\n## Recording in Ground Control\n\nRecord this run against the **Automated lint, test and production-build evidence recorded** launch gate. Upload this folder as a CI artifact or link the relevant GitHub Actions run, then store that HTTPS link in the structured evidence register.\n`;
writeFileSync(markdownPath, markdown);
writeFileSync(latestMarkdownPath, markdown);

console.log(`Ground Control release evidence: ${evidence.result.toUpperCase()}`);
console.log(`JSON: ${relative(root, jsonPath)}`);
console.log(`Markdown: ${relative(root, markdownPath)}`);

if (!requiredPassed) {
  console.error("\nFailed release checks:");
  for (const item of commands.filter((entry) => !entry.passed)) {
    console.error(`\n[${item.name}] exit ${item.status}${item.signal ? `, signal ${item.signal}` : ""}`);
    console.error(item.outputTail || "No command output was captured.");
  }
  for (const item of repository.filter((entry) => !entry.passed && !entry.advisory)) {
    console.error(`\n[${item.name}] ${item.detail}`);
  }
}

process.exit(requiredPassed ? 0 : 1);
