import { describe, expect, test } from "vitest";
import {
  buildFundingEvidencePack,
  fundingEvidencePackMarkdown,
} from "../../src/lib/grants/fundingEvidencePack.js";

function model() {
  return {
    filters: {
      selectedPeriod: "all",
      selectedScope: "matchweek",
      periodOptions: [{ value: "all", label: "All saved matchdays" }],
    },
    evidence: { score: 76, label: "Developing evidence", recordedWeeks: 4 },
    quality: {
      score: 76,
      label: "Developing evidence",
      methodology: "Built from saved club operational records.",
      provenance: [{ id: "fixture-records", label: "Fixture records", status: "available", detail: "Stored schedule rows." }],
      gaps: [{ id: "attendance", label: "Attendance", action: "Collect verified attendance separately." }],
    },
    metrics: {
      scheduledFixtures: 8,
      teamOpportunitySlots: 16,
      facilityHours: 12,
      postponedFixtures: 2,
      officialCoverage: 75,
    },
    framework: {
      disclaimer: "Operational records do not prove attendance.",
      requirements: [{
        id: "sustained-demand",
        category: "Need",
        title: "Sustained demand",
        status: "partial",
        source: "Saved matchweeks",
        evidence: "Four selected matchdays.",
        nextAction: "Build a longer baseline.",
      }],
    },
    funding: {
      filters: { selectedHomeNation: "england", selectedProjectType: "grass-pitch" },
      project: { label: "Grass pitch improvement" },
      coverage: { lastVerified: "11 Jul 2026" },
      programmes: [{
        id: "official-programme",
        funder: "Official Funder",
        name: "Facility Fund",
        amountLabel: "Up to £25,000",
        status: "rolling",
        resolvedStatus: { label: "Open year-round" },
        matchFunding: "25% club contribution",
        summary: "Facility improvements.",
        officialUrl: "https://example.org/official",
        lastVerified: "2026-07-11",
        verification: { label: "Verified today" },
        matchLabel: "Potential fit",
        matchScore: 72,
        eligibilityNotes: ["Eligible club type required"],
        manualRequirements: ["Two quotations"],
      }],
    },
    narrative: "The club recorded eight fixtures scheduled to proceed. This does not confirm attendance.",
    sourceRows: Array.from({ length: 10 }, (_, index) => ({ id: index + 1 })),
  };
}

describe("application-ready funding evidence draft", () => {
  test("exports traceable metrics with explicit evidence boundaries", () => {
    const pack = buildFundingEvidencePack({ club: { name: "Horwich St Mary's" }, model: model() });
    const scheduled = pack.metrics.find((item) => item.id === "scheduled-fixtures");
    const opportunities = pack.metrics.find((item) => item.id === "team-opportunity-slots");

    expect(pack.status).toBe("draft_for_human_review");
    expect(scheduled.value).toBe(8);
    expect(scheduled.definition).toContain("does not prove that the fixture took place");
    expect(opportunities.definition).toContain("not attendance");
    expect(pack.matchedProgrammes[0].officialUrl).toBe("https://example.org/official");
    expect(pack.matchedProgrammes[0].lastVerified).toBe("2026-07-11");
  });

  test("markdown is labelled as a draft and blocks unsupported participation claims", () => {
    const markdown = fundingEvidencePackMarkdown(buildFundingEvidencePack({ club: { name: "Horwich St Mary's" }, model: model() }));
    expect(markdown).toContain("Draft for human review");
    expect(markdown).toContain("Fixtures scheduled to proceed");
    expect(markdown).toContain("do not prove completed activity");
    expect(markdown).toContain("Official source");
    expect(markdown).not.toContain("confirmed beneficiaries");
    expect(markdown).not.toContain("fixtures delivered");
  });
});
