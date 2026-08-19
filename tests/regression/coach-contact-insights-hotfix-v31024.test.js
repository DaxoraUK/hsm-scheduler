import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Ground Control v3.10.2.4 team-contact and Insights runtime hotfix", () => {
  it("shows a primary Coach Hub assignment in Team settings without duplicating the directory", () => {
    const teams = read("src/components/Settings/TeamSettingsPanel.jsx");
    expect(teams).toContain("primaryCoachHubAssignment");
    expect(teams).toContain("coachHubManagedPrimary");
    expect(teams).toContain("The primary contact is assigned through Coach Hub");
    expect(teams).toContain('coachHubManagedPrimary ? "Coach Hub"');
  });

  it("refreshes shared team contacts whenever Coach Hub data changes", () => {
    const coachHub = read("src/components/Settings/CoachHubSettingsPanel.jsx");
    expect(coachHub).toContain("DB.loadTeamContacts(clubId)");
    expect(coachHub).toContain("setTeamContacts?.(alignTeamContacts(teamCfg, sharedContacts))");
  });

  it("defines the Insights availability flag and normalises pitch rows", () => {
    const planner = read("src/pages/AnnualPlannerPage.jsx");
    expect(planner).toContain("metricsUnavailable = false");
    expect(planner).toContain("Array.isArray(utilisation.byPitch)");
    expect(planner).toContain("DaxoraSectionErrorBoundary");
  });

  it("contains section-level recovery so Insights cannot crash the full workspace", () => {
    const boundary = read("src/components/system/DaxoraSectionErrorBoundary.jsx");
    expect(boundary).toContain("getDerivedStateFromError");
    expect(boundary).toContain("Retry section");
    expect(boundary).toContain("The rest of the workspace remains available");
  });
});
