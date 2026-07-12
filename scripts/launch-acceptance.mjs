import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildLaunchAcceptanceReport } from "../src/lib/platform/launchAcceptance.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(root, ".release-evidence");
const checkOnly = process.argv.includes("--check-only");
const evidence = buildLaunchAcceptanceReport();

if (!checkOnly) {
  mkdirSync(outputDir, { recursive: true });
  const runId = evidence.generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  const jsonPath = join(outputDir, `launch-acceptance-${runId}.json`);
  const markdownPath = join(outputDir, `launch-acceptance-${runId}.md`);
  const markdown = `# Ground Control launch acceptance\n\n- **Generated:** ${evidence.generatedAt}\n- **Result:** ${evidence.result.toUpperCase()}\n- **Scope:** Subscription, route and read-only acceptance\n\n## Automated checks\n\n${evidence.checks.map((item) => `- **${item.name}:** ${item.passed ? "PASS" : "FAIL"} — ${item.detail}`).join("\n")}\n\n## Real-account scenarios\n\n${evidence.scenarios.map((scenario) => `### ${scenario.title}\n${scenario.expected.map((item) => `- ${item}`).join("\n")}`).join("\n\n")}\n\n## Manual evidence still required\n\n${evidence.manualEvidenceRequired.map((item) => `- ${item}`).join("\n")}\n`;
  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(markdownPath, markdown);
  writeFileSync(join(outputDir, "latest-launch-acceptance.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(join(outputDir, "latest-launch-acceptance.md"), markdown);
  console.log(`Evidence: ${relative(root, jsonPath)}`);
}

for (const item of evidence.checks) console.log(`${item.passed ? "PASS" : "FAIL"} ${item.name}`);
console.log(`Ground Control launch acceptance: ${evidence.result.toUpperCase()}`);
process.exit(evidence.failed ? 1 : 0);
