import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outputDir = join(root, ".release-evidence");
  mkdirSync(outputDir, { recursive: true });

  const rawUrl = process.argv[2] || process.env.STAGING_URL || "";
  if (!rawUrl) {
    console.error(
      "Provide the staging URL: npm run smoke:staging -- https://your-staging-domain",
    );
    return 2;
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    console.error("STAGING_URL is not a valid URL.");
    return 2;
  }

  const checks = [];
  checks.push({
    name: "HTTPS URL",
    passed: target.protocol === "https:",
    detail: target.href,
  });

  let response;
  let body = "";

  try {
    response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });

    body = await response.text();

    checks.push({
      name: "Staging root responds",
      passed: response.ok,
      detail: `HTTP ${response.status}`,
    });

    checks.push({
      name: "React mount point present",
      passed: /id=["']root["']/.test(body),
      detail: "Expected #root in deployed HTML.",
    });

    checks.push({
      name: "No environment placeholders in HTML",
      passed: !/YOUR_PROJECT|REPLACE_ME|YOUR_PUBLIC_/i.test(body),
      detail: "Deployed HTML must not contain example placeholders.",
    });

    const header = (name) => response.headers.get(name) || "";

    checks.push({
      name: "X-Content-Type-Options",
      passed: header("x-content-type-options").toLowerCase() === "nosniff",
      detail: header("x-content-type-options") || "Missing",
    });

    checks.push({
      name: "Referrer-Policy",
      passed: Boolean(header("referrer-policy")),
      detail: header("referrer-policy") || "Missing",
    });

    checks.push({
      name: "Framing protection",
      passed: Boolean(
        header("x-frame-options") ||
          /frame-ancestors/i.test(header("content-security-policy")),
      ),
      detail:
        header("x-frame-options") ||
        header("content-security-policy") ||
        "Missing",
    });

    checks.push({
      name: "HSTS",
      passed: Boolean(header("strict-transport-security")),
      detail: header("strict-transport-security") || "Missing",
    });
  } catch (error) {
    checks.push({
      name: "Staging root responds",
      passed: false,
      detail: error?.message || "Network failure",
    });
  }

  const result = checks.every((item) => item.passed) ? "pass" : "fail";
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: "staging",
    release: process.env.RELEASE_ID || "unlabelled-staging-release",
    target: target.href,
    result,
    checks,
  };

  const runId = evidence.generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  const jsonPath = join(outputDir, `staging-smoke-${runId}.json`);
  const markdownPath = join(outputDir, `staging-smoke-${runId}.md`);

  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(
    join(outputDir, "latest-staging-smoke.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );

  const markdown = `# Ground Control staging smoke test\n\n- **Generated:** ${evidence.generatedAt}\n- **Target:** ${evidence.target}\n- **Release:** ${evidence.release}\n- **Result:** ${evidence.result.toUpperCase()}\n\n${checks
    .map(
      (item) =>
        `- **${item.name}:** ${item.passed ? "PASS" : "FAIL"} — ${item.detail}`,
    )
    .join("\n")}\n`;

  writeFileSync(markdownPath, markdown);
  writeFileSync(join(outputDir, "latest-staging-smoke.md"), markdown);

  console.log(`Ground Control staging smoke test: ${result.toUpperCase()}`);
  console.log(`Evidence: ${relative(root, jsonPath)}`);

  const failures = checks.filter((item) => !item.passed);
  if (failures.length > 0) {
    console.log("\nFailed checks:");
    for (const failure of failures) {
      console.log(`- ${failure.name}: ${failure.detail}`);
    }
  }

  return result === "pass" ? 0 : 1;
}

process.exitCode = await main();
