import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const fundingWorkspace = readFileSync("src/components/analytics/FundingWorkspacePanel.jsx", "utf8");
const analyticsPage = readFileSync("src/pages/AnalyticsPage.jsx", "utf8");
const reportsPage = readFileSync("src/pages/ReportsPage.jsx", "utf8");
const card = readFileSync("src/ui/Card.jsx", "utf8");
const pageHeader = readFileSync("src/ui/PageHeader.jsx", "utf8");
const releaseGates = readFileSync("scripts/run-release-gates.mjs", "utf8");
const runbook = readFileSync("docs/LAUNCH_ACCEPTANCE_RUNBOOK.md", "utf8");

describe("final UI polish and launch acceptance", () => {
  test("funding workspace opens on the project brief and keeps evidence actions separate", () => {
    expect(fundingWorkspace).toContain('useState("project")');
    expect(fundingWorkspace).toContain('const FUNDING_PRIMARY_VIEWS');
    expect(fundingWorkspace).toContain('const FUNDING_EVIDENCE_VIEWS');
    expect(fundingWorkspace).toContain('aria-label="Funding workspace sections"');
    expect(fundingWorkspace).toContain('Save the brief to unlock evidence tools');
    expect(fundingWorkspace).not.toContain('Secure club storage active.');
  });

  test("funding empty state is compact and action-led", () => {
    expect(fundingWorkspace).toContain("Create the project brief first");
    expect(fundingWorkspace).toContain("Open project");
    expect(fundingWorkspace).not.toContain("rounded-[26px] border border-amber-200 bg-amber-50 p-6");
  });

  test("analytics and reports expose selected tab state", () => {
    expect(analyticsPage).toContain('role="tablist"');
    expect(analyticsPage).toContain('aria-selected={active}');
    expect(reportsPage).toContain('aria-label="Report types"');
    expect(reportsPage).toContain('aria-selected={active}');
  });

  test("shared card and page headers adapt at smaller widths", () => {
    expect(card).toContain("flex flex-col gap-4");
    expect(card).toContain('p-4 sm:p-6');
    expect(pageHeader).toContain('text-3xl');
    expect(pageHeader).toContain('sm:text-4xl');
  });

  test("release evidence includes the launch acceptance matrix", () => {
    expect(releaseGates).toContain('Launch acceptance matrix');
    expect(releaseGates).toContain('scripts/launch-acceptance.mjs');
    expect(runbook).toContain('End-to-end matchweek proof');
    expect(runbook).toContain('Responsive checks');
  });

  test("the automated launch acceptance matrix passes", () => {
    const output = execFileSync(process.execPath, ["scripts/launch-acceptance.mjs", "--check-only"], {
      encoding: "utf8",
    });
    expect(output).toContain("Ground Control launch acceptance: PASS");
  });
});
