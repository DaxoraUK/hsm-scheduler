import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Coach Hub pilot metrics runtime hotfix v3.10.2.1", () => {
  it("keeps optional metrics faults from taking down core workspaces", () => {
    const source = read("src/lib/supabase.js");
    expect(source).toContain("Pilot metrics are supplementary");
    expect(source).toContain("unavailable: true");
    expect(source).toContain("COACH_HUB_METRICS_UNAVAILABLE");
  });

  it("uses deterministic calendar-year boundaries in PostgreSQL", () => {
    const sql = read("supabase/migrations/202607160001_coach_hub_pilot_metrics_runtime_hotfix.sql");
    expect(sql).toContain("make_date(current_year, 1, 1)");
    expect(sql).toContain("make_date(current_year, 12, 31)");
    expect(sql).toContain("requested_end + 1");
    expect(sql).not.toContain("1 year-1 day");
  });

  it("shows a controlled reporting warning rather than crashing", () => {
    const planner = read("src/pages/AnnualPlannerPage.jsx");
    const settings = read("src/components/Settings/CoachHubSettingsPanel.jsx");
    expect(planner).toContain("Coach engagement metrics are temporarily unavailable");
    expect(settings).toContain("Contacts, invitations, requests and booking operations remain available");
  });
});
