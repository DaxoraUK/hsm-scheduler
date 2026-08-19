import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const vitestCli = path.join(root, "node_modules", "vitest", "vitest.mjs");
const oxlintCli = path.join(root, "node_modules", "oxlint", "bin", "oxlint");
const acquisitionVitestConfig = "scripts/vitest.teamfeepay.config.mjs";
const acquisitionRenderVitestConfig = "scripts/vitest.teamfeepay.render.config.mjs";
const tscCli = path.join(root, "node_modules", "typescript", "bin", "tsc");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");

const focusedTests = [
  "tests/integrations/teamfeepayIntegration.test.js",
  "tests/regression/teamfeepay-acquisition-demo.test.js",
];
const fullEliteDemoTest = "tests/regression/teamfeepay-full-elite-demo.test.jsx";

// These checks are useful on Node 22, but older/newer Daxora branches do not
// always contain every regression file. Run only the files that actually exist.
const optionalEnvironmentRegressionCandidates = [
  "tests/regression/admin-support-repository.test.js",
  "tests/regression/multi-club-security.test.js",
  "tests/regression/operational-ux-corrections.test.js",
];
const optionalEnvironmentRegressionTests = optionalEnvironmentRegressionCandidates.filter((file) =>
  fs.existsSync(path.join(root, file)),
);

const lintCandidates = [
  "src/App.jsx",
  "src/demo/teamfeepay",
  "src/lib/integrations/teamfeepay",
  "src/lib/supabase.js",
  "tests/setup/browser-globals.js",
  ...focusedTests,
  fullEliteDemoTest,
  "scripts/teamfeepay-demo-api.mjs",
  "scripts/teamfeepay-readiness.mjs",
  "scripts/vitest.teamfeepay.config.mjs",
  "scripts/vitest.teamfeepay.render.config.mjs",
  "scripts/acquisition-secret-scan.mjs",
  "scripts/acquisition-license-report.mjs",
];
const lintTargets = lintCandidates.filter((file) => fs.existsSync(path.join(root, file)));

const steps = [
  ["Focused TeamFeePay integration tests", process.execPath, [vitestCli, "run", "--config", acquisitionVitestConfig, ...focusedTests]],
  ["Full Elite real-application demonstration", process.execPath, [vitestCli, "run", "--config", acquisitionRenderVitestConfig, fullEliteDemoTest]],
];
if (optionalEnvironmentRegressionTests.length) {
  steps.push([
    "Available Node browser-storage regressions",
    process.execPath,
    [vitestCli, "run", "--config", acquisitionVitestConfig, ...optionalEnvironmentRegressionTests],
  ]);
}
steps.push(
  // Invoke Oxlint through Node directly. On some Windows/npm combinations,
  // npx.cmd can drop the supplied target list and lint the entire repository.
  ["Acquisition-layer lint", process.execPath, [oxlintCli, ...lintTargets]],
  // Execute the build tools through Node directly. Spawning npm.cmd from a
  // Node child process can fail before npm starts on Windows, producing only
  // an empty build heading and a null exit status.
  ["TypeScript production build", process.execPath, [tscCli, "-b"]],
  ["Vite production build", process.execPath, [viteCli, "build"]],
  ["Secret scan", process.execPath, ["scripts/acquisition-secret-scan.mjs"]],
  ["Dependency licence inventory", process.execPath, ["scripts/acquisition-license-report.mjs"]],
);

const results = [];
for (const [label, command, args] of steps) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false });
  const passed = result.status === 0;
  const error = result.error ? String(result.error.message || result.error) : null;
  results.push({ label, passed, exitCode: result.status ?? -1, signal: result.signal ?? null, error });
  if (!passed) {
    if (error) console.error(`Unable to start ${label}: ${error}`);
    break;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  status: results.length === steps.length && results.every((item) => item.passed) ? "PASS" : "FAIL",
  results,
  validated: [
    "TeamFeePay synthetic demo and mapping contract",
    "Real v3.10.13 Elite application renders Mission Control, Organisation Command, Annual Planner and League Manager",
    "Annual Planner and League Manager open successfully from the live product navigation",
    "Windows-safe acquisition-only lint targeting",
    "Deterministic Vitest localStorage/sessionStorage through an explicit acquisition-only config",
    "Direct TypeScript and Vite production builds without Windows .cmd spawning",
    "Secret scan and dependency licence inventory",
  ],
  optionalEnvironmentRegressionTests,
  limitations: [
    "This focused gate does not replace the full Ground Control regression suite.",
    "This installer deliberately does not modify unrelated League Manager or Ground Control business logic.",
    "No production TeamFeePay connection is tested because no authorised API specification is configured.",
    "Legal, tax and IP conclusions require professional review.",
  ],
};
const outputDir = path.join(root, ".release-evidence");
fs.mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const reportPath = path.join(outputDir, `teamfeepay-readiness-${stamp}.json`);
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nTeamFeePay acquisition readiness: ${report.status}`);
console.log(`Evidence: ${path.relative(root, reportPath)}`);
process.exitCode = report.status === "PASS" ? 0 : 1;
