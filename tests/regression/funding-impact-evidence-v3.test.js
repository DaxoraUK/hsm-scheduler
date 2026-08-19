import fs from "node:fs";
import { describe, expect, test } from "vitest";
import {
  normaliseFundingImpactRecord,
  summariseFundingImpactEvidence,
  validateFundingImpactRecord,
} from "../../src/lib/grants/fundingImpactEvidenceService.js";
import {
  buildFundingEvidencePack,
  fundingApplicationPackHtml,
} from "../../src/lib/grants/fundingEvidencePack.js";

function baseModel() {
  return {
    filters: { selectedPeriod: "all", selectedScope: "matchweek", periodOptions: [{ value: "all", label: "All saved matchdays" }] },
    quality: { score: 80, label: "Strong operational evidence", methodology: "Saved records.", provenance: [], gaps: [] },
    evidence: { score: 80, label: "Strong operational evidence", recordedWeeks: 3, summary: { scheduled: 6, postponed: 1, cancelled: 0 } },
    metrics: { scheduledFixtures: 6, teamOpportunitySlots: 12, facilityHours: 9, postponedFixtures: 1, officialCoverage: 100 },
    framework: { disclaimer: "Schedules do not prove attendance.", requirements: [] },
    funding: {
      filters: { selectedHomeNation: "england", selectedProjectType: "participation" },
      project: { label: "Participation project" },
      programmes: [{
        id: "programme",
        funder: "Official funder",
        name: "Community programme",
        amountLabel: "£300 to £20,000",
        status: "open",
        resolvedStatus: { label: "Open" },
        matchFunding: "No standard requirement",
        summary: "Community activity.",
        officialUrl: "https://example.org/fund",
        lastVerified: "2026-07-11",
        eligibilityNotes: ["Eligible community organisation"],
        requiredDocuments: ["Project budget"],
        manualRequirements: ["Safeguarding evidence"],
      }],
    },
    narrative: "Six fixtures were scheduled to proceed.",
    sourceRows: [{ id: 1 }],
  };
}

function evidence(overrides = {}) {
  return normaliseFundingImpactRecord({
    id: "impact-1",
    projectId: "project-1",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    status: "verified",
    sourceLabel: "Signed attendance register",
    verifiedBy: "Club secretary",
    completedSessions: 8,
    attendanceVisits: 120,
    uniqueParticipants: 42,
    youthParticipants: 30,
    womenGirlsParticipants: 18,
    disabilityParticipants: 4,
    volunteerCount: 7,
    volunteerHours: 36.5,
    ...overrides,
  });
}

describe("funding impact evidence v3", () => {
  test("verified records contribute to totals while drafts remain excluded", () => {
    const summary = summariseFundingImpactEvidence([evidence(), evidence({ id: "draft", status: "draft", completedSessions: 99 })]);
    expect(summary.verifiedRecords).toBe(1);
    expect(summary.draftRecords).toBe(1);
    expect(summary.completedSessions).toBe(8);
    expect(summary.uniqueParticipants).toBe(42);
  });

  test("validation prevents unsupported or internally inconsistent verified claims", () => {
    expect(validateFundingImpactRecord(evidence({ sourceLabel: "" }))).toContain("Verified evidence needs a clear source label.");
    expect(validateFundingImpactRecord(evidence({ verifiedBy: "" }))).toContain("Record who checked the figures before marking the evidence verified.");
    expect(validateFundingImpactRecord(evidence({ uniqueParticipants: 50, attendanceVisits: 20 }))).toContain("Unique participants cannot exceed total attendance visits.");
    expect(validateFundingImpactRecord(evidence({ youthParticipants: 50, uniqueParticipants: 42 }))).toContain("Under-18 participants cannot exceed unique participants.");
  });

  test("application pack keeps scheduling evidence separate from verified participation", () => {
    const pack = buildFundingEvidencePack({ club: { name: "Example & Club" }, model: baseModel(), impactEvidence: [evidence()] });
    expect(pack.schemaVersion).toBe(2);
    expect(pack.impactEvidence.verifiedRecords).toBe(1);
    expect(pack.metrics.find((item) => item.id === "completed-sessions")?.provenance).toBe("manually_verified");
    expect(pack.metrics.find((item) => item.id === "scheduled-fixtures")?.definition).toContain("does not prove");
  });

  test("printable application pack escapes club-entered content and includes official sources", () => {
    const pack = buildFundingEvidencePack({ club: { name: "<script>alert(1)</script>" }, model: baseModel(), impactEvidence: [evidence({ outcomeSummary: "<b>unsafe</b>" })] });
    const html = fundingApplicationPackHtml(pack);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("https://example.org/fund");
    expect(html).toContain("Scheduled fixtures and scheduled pitch hours do not prove");
  });

  test("migration enforces tenancy, verification and evidence boundaries", () => {
    const migration = fs.readFileSync("supabase/migrations/202607110007_funding_impact_evidence.sql", "utf8");
    expect(migration).toContain("funding_impact_records");
    expect(migration).toContain("public.can_read_club(club_id)");
    expect(migration).toContain("public.can_manage_club(club_id)");
    expect(migration).toContain("funding_impact_verified_source");
    expect(migration).toContain("funding_impact_participant_boundary");
  });
});
