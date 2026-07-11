import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildFundingReadinessChecklist, getFundingRequirementGuidance } from "../../src/lib/grants/fundingReadinessEngine.js";

const projectRoot = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(projectRoot, "supabase/migrations/202607050008_funding_workspace.sql"), "utf8");
const dashboard = fs.readFileSync(path.join(projectRoot, "src/components/analytics/GrantImpactDashboard.jsx"), "utf8");
const workspacePanel = fs.readFileSync(path.join(projectRoot, "src/components/analytics/FundingWorkspacePanel.jsx"), "utf8");
const appCore = fs.readFileSync(path.join(projectRoot, "src/AppCore.jsx"), "utf8");

const programme = {
  id: "test-programme",
  funder: "Test Funder",
  name: "Facility Improvement Fund",
  evidenceRequirementIds: ["facility-use"],
  eligibilityNotes: ["Eligible security of tenure is required"],
  manualRequirements: ["Current governing document", "Two like-for-like quotations", "Project budget"],
};

const framework = {
  requirements: [{
    id: "facility-use",
    category: "Facilities",
    title: "Facility use and capacity pressure",
    status: "partial",
    source: "calculated",
    evidence: "Three matchdays recorded.",
    nextAction: "Save more fixture allocations.",
  }],
};

describe("funding project workspace", () => {
  test("builds a programme-specific checklist and puts missing work first", () => {
    const checklist = buildFundingReadinessChecklist({
      programme,
      framework,
      project: {
        title: "Drainage improvement",
        selectedProgrammeId: programme.id,
        projectType: "grass-pitch",
        postcode: "BL6 7QE",
        estimatedCost: 30000,
        targetFunding: 20000,
        legalStructure: "Constituted club",
        affiliation: "County FA affiliated",
        tenure: "15-year lease",
        summary: "Waterlogging causes lost fixtures.",
        beneficiaries: "18 teams and community users",
        outcomes: "Reduce weather postponements by 30%",
        deliveryPlan: "Survey, procure, install and monitor",
      },
      documents: [{
        id: "doc-1",
        projectId: "project-1",
        requirementKey: "document:current-governing-document",
        fileName: "constitution.pdf",
      }],
    });

    expect(checklist.total).toBeGreaterThan(10);
    expect(checklist.items[0].status).toBe("missing");
    expect(checklist.items.find((item) => item.title === "Current governing document")?.status).toBe("ready");
    expect(checklist.items.find((item) => item.title === "Facility use and capacity pressure")?.status).toBe("in_progress");
    expect(checklist.items.find((item) => item.title === "Target funding programme")?.status).toBe("ready");
  });

  test("guidance explains why a requirement matters and how to achieve it", () => {
    const tenure = getFundingRequirementGuidance("Tenure or landlord consent");
    const quotations = getFundingRequirementGuidance("Two like-for-like quotations");

    expect(tenure.why).toContain("control of the site");
    expect(tenure.steps.length).toBeGreaterThanOrEqual(4);
    expect(tenure.acceptedEvidence).toContain("Signed lease or licence");
    expect(quotations.why).toContain("value for money");
    expect(quotations.acceptedEvidence).toContain("Dated supplier quotation");
  });

  test("migration creates isolated project, requirement, document and snapshot storage", () => {
    for (const table of ["funding_projects", "funding_requirement_records", "funding_documents", "funding_evidence_snapshots"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
    expect(migration).toContain("public.can_read_club(club_id)");
    expect(migration).toContain("public.can_manage_club(club_id)");
    expect(migration).toContain("'funding-documents'");
    expect(migration).toContain("15728640");
    expect(migration.toLowerCase()).toContain("funding document storage path must begin with the selected club id");
    expect(migration).toContain("revoke update, delete on public.funding_evidence_snapshots from authenticated");
  });

  test("analytics receives secure club context and exposes the all-in-one workspace", () => {
    expect(appCore).toContain("activeClubId={activeClubId}");
    expect(appCore).toContain("workspaceAccess={workspaceAccess}");
    expect(dashboard).toContain("FundingWorkspacePanel");
    expect(dashboard).not.toContain("Four separate readiness checks");
    expect(workspacePanel).toContain("Build a grant-ready project");
    expect(workspacePanel).toContain("Evidence library");
    expect(workspacePanel).toContain("Immutable application snapshots");
    expect(workspacePanel).toContain("Why this matters");
    expect(workspacePanel).toContain("How to complete it");
  });
});
