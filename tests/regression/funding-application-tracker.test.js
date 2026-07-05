import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const tracker = read("../../src/components/analytics/FundingApplicationTracker.jsx");
const panel = read("../../src/components/analytics/FundingWorkspacePanel.jsx");
const service = read("../../src/lib/grants/fundingWorkspaceService.js");
const migration = read("../../supabase/migrations/202607050010_funding_application_tracker.sql");

describe("funding application tracker", () => {
  it("adds a dedicated Applications workspace to funding intelligence", () => {
    expect(panel).toContain('["applications", "Applications", Send]');
    expect(panel).toContain("<FundingApplicationTracker");
    expect(panel).toContain("onSaveApplication={saveApplication}");
  });

  it("tracks ownership, deadlines, submissions, decisions and award conditions", () => {
    expect(tracker).toContain("Application owner");
    expect(tracker).toContain("Application deadline");
    expect(tracker).toContain("Submitted date");
    expect(tracker).toContain("Expected decision");
    expect(tracker).toContain("Decision and award conditions");
    expect(tracker).toContain("Funding conditions");
  });

  it("supports accountable tasks and post-award monitoring", () => {
    expect(tracker).toContain("Application tasks");
    expect(tracker).toContain("Post-award monitoring");
    expect(tracker).toContain("Reporting period start");
    expect(tracker).toContain("Evidence required");
    expect(tracker).toContain("This task is overdue and still open");
  });

  it("persists tracker records in remote or local fallback storage", () => {
    expect(service).toContain("export async function saveFundingApplication(");
    expect(service).toContain("export async function saveFundingApplicationTask(");
    expect(service).toContain("export async function saveFundingMonitoringObligation(");
    expect(service).toContain("applicationTasks: asArray(stored?.applicationTasks)");
    expect(service).toContain('trackerMode: trackerResult.available ? "remote" : "local"');
  });

  it("creates club-isolated application, task and monitoring tables", () => {
    expect(migration).toContain("create table if not exists public.funding_applications");
    expect(migration).toContain("create table if not exists public.funding_application_tasks");
    expect(migration).toContain("create table if not exists public.funding_monitoring_obligations");
    expect(migration).toContain("public.can_read_club(club_id)");
    expect(migration).toContain("public.can_manage_club(club_id)");
    expect(migration).toContain("Funding application does not belong to the selected club");
  });
});
