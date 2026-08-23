import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { buildEvidenceQuality } from "../../src/lib/engines/evidenceQualityEngine.js";
import {
  GRANT_HOME_NATIONS,
  VERIFIED_GRANT_PROGRAMMES,
} from "../../src/lib/grants/grantProgrammeCatalogue.js";
import {
  buildGrantFundingModel,
  resolveProgrammeStatus,
} from "../../src/lib/grants/grantMatchingEngine.js";

const projectRoot = path.resolve(process.cwd());

function completeEvidence({ weatherCoverage = 0, parkingConfigured = false } = {}) {
  const date = new Date("2026-07-04T12:00:00Z");
  return {
    entries: Array.from({ length: 8 }, (_, index) => ({ date: new Date(date.getTime() + index * 86400000) })),
    evidence: {
      rows: [{
        status: "delivered",
        date,
        dateLabel: "Saturday 4 July",
        homeTeam: "Horwich St Mary's FC U14",
        awayTeam: "Bolton United U14",
        format: "11v11-youth",
        pitchId: "pitch-1",
        koMins: 600,
        referee: "A. Referee",
        officialStatus: "confirmed",
      }],
      weekly: [{
        dayParking: [{ snapshot: { enabled: true, configured: parkingConfigured } }],
      }],
      summary: { weatherCoverage },
    },
  };
}

describe("verified grant programme matrix", () => {
  test("catalogue covers every UK home nation and uses traceable official sources", () => {
    expect(VERIFIED_GRANT_PROGRAMMES.length).toBeGreaterThanOrEqual(39);

    const coveredNations = new Set(VERIFIED_GRANT_PROGRAMMES.flatMap((programme) => programme.nations));
    GRANT_HOME_NATIONS.forEach(({ value }) => expect(coveredNations.has(value)).toBe(true));

    VERIFIED_GRANT_PROGRAMMES.forEach((programme) => {
      expect(programme.sourceType).toBe("official");
      expect(programme.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(programme.officialUrl).toMatch(/^https:\/\//);
      expect(programme.projectTypes.length).toBeGreaterThan(0);
      expect(programme.evidenceRequirementIds.length).toBeGreaterThan(0);
    });
  });

  test("programme status changes safely around opening dates and deadlines", () => {
    const beActive = VERIFIED_GRANT_PROGRAMMES.find((programme) => programme.id === "sport-wales-be-active");
    const before = resolveProgrammeStatus(beActive, new Date("2026-07-05T12:00:00Z"));
    const during = resolveProgrammeStatus(beActive, new Date("2026-07-09T12:00:00Z"));
    const after = resolveProgrammeStatus(beActive, new Date("2026-09-12T12:00:00Z"));

    expect(before.key).toBe("upcoming");
    expect(before.label).toContain("8 Jul 2026");
    expect(during.key).toBe("open");
    expect(during.label).toContain("11 Sept 2026");
    expect(after.key).toBe("closed");
  });

  test("current Wales matches include the live EOI and upcoming window but exclude closed legacy rounds", () => {
    const model = buildGrantFundingModel({
      homeNation: "wales",
      projectType: "all",
      availability: "current",
      quality: { measures: [] },
      framework: { requirements: [] },
      today: new Date("2026-07-05T12:00:00Z"),
    });
    const ids = model.programmes.map((programme) => programme.id);

    expect(ids).toContain("cff-fit-for-future-eoi");
    expect(ids).toContain("sport-wales-be-active");
    expect(ids).not.toContain("cff-equipment-fund");
    expect(ids).not.toContain("cff-facilities-programme");
    expect(ids).not.toContain("sport-wales-energy-saving");
    expect(model.coverage.staleProgrammes).toBe(0);
  });

  test("general evidence confidence is not reduced by project-specific weather or parking gaps", () => {
    const input = completeEvidence({ weatherCoverage: 0, parkingConfigured: false });
    const quality = buildEvidenceQuality({
      ...input,
      club: { name: "Horwich St Mary's FC", venue: "Scholes Bank" },
      pitchCfg: [{ id: "pitch-1" }],
      teamCfg: [{ name: "U14" }],
      refs: [{ name: "A. Referee" }],
    });

    expect(quality.score).toBe(100);
    expect(quality.coreMeasures.every((measure) => measure.value === 100)).toBe(true);
    expect(quality.contextualMeasures.map((measure) => measure.id)).toEqual(["parking-coverage", "weather-coverage"]);
    expect(quality.gaps.some((gap) => gap.id === "weather-coverage")).toBe(true);
  });

  test("official evidence requires a referee or an explicitly recorded appointment status", () => {
    const input = completeEvidence();
    const missing = buildEvidenceQuality({
      ...input,
      evidence: {
        ...input.evidence,
        rows: input.evidence.rows.map((row) => ({ ...row, referee: "", officialStatus: "" })),
      },
    });
    const explicitlyOutstanding = buildEvidenceQuality({
      ...input,
      evidence: {
        ...input.evidence,
        rows: input.evidence.rows.map((row) => ({ ...row, referee: "", officialStatus: "unconfirmed" })),
      },
    });

    expect(missing.measures.find((measure) => measure.id === "officials-coverage")?.value).toBe(0);
    expect(explicitlyOutstanding.measures.find((measure) => measure.id === "officials-coverage")?.value).toBe(100);
  });

  test("funding UI keeps contextual evidence and verification freshness visible", () => {
    const analyticsSource = fs.readFileSync(
      path.join(projectRoot, "src/components/analytics/AnalyticsVisualDashboard.jsx"),
      "utf8"
    );
    const fundingSource = fs.readFileSync(
      path.join(projectRoot, "src/components/analytics/GrantImpactDashboard.jsx"),
      "utf8"
    );

    expect(analyticsSource).toContain("Contextual evidence");
    expect(analyticsSource).toContain("do not reduce the general confidence score");
    expect(fundingSource).toContain("Verified opportunities");
    expect(fundingSource).toContain("Re-check required");
    expect(fundingSource).toContain("Club contribution");
    expect(fundingSource).not.toContain("Grant-ready");
  });
});
