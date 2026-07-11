import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildCommunicationsModel } from "../../src/lib/communications/communicationsEngine.js";
import { buildGrantEvidenceFramework } from "../../src/lib/grants/grantEvidenceFramework.js";
import { VERIFIED_GRANT_PROGRAMMES } from "../../src/lib/grants/grantProgrammeCatalogue.js";
import { REPORT_TYPES } from "../../src/lib/reports/reportingEngine.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function scheduledFixture(overrides = {}) {
  return {
    id: "fixture-1",
    homeTeam: "HSM U14",
    awayTeam: "Visitors U14",
    koTime: "10:00",
    pitchLabel: "Pitch 1",
    format: "11v11",
    referee: "Alex Referee",
    refStatus: "confirmed",
    ...overrides,
  };
}

const teamCfg = [
  {
    name: "HSM U14",
    managerName: "Jordan",
    managerPhone: "07123 456789",
    managerEmail: "jordan@example.org",
    communicationChannel: "whatsapp",
  },
];

describe("communications, reports and grant evidence truthfulness", () => {
  test("classifies complete, review and blocked communications accurately", () => {
    const ready = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg,
      satFinal: [scheduledFixture()],
      satHasRun: true,
      satDateLabel: "Saturday 19 September",
      midweekEnabled: false,
    });
    expect(ready.counts.ready).toBe(1);
    expect(ready.rows[0].message).toContain("Kick-off: 10:00");
    expect(ready.rows[0].message).toContain("Pitch: Pitch 1");

    const review = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg: [],
      satFinal: [scheduledFixture({ referee: "", refStatus: "" })],
      satHasRun: true,
      midweekEnabled: false,
    });
    expect(review.counts.review).toBe(1);
    expect(review.rows[0].issues).toContain("Official not assigned");
    expect(review.rows[0].issues).toContain("Manager contact missing");

    const blocked = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg,
      satUnresolved: [scheduledFixture({ koTime: "", pitchLabel: "" })],
      satHasRun: true,
      midweekEnabled: false,
    });
    expect(blocked.counts.blocked).toBe(1);
    expect(blocked.rows[0].status).toBe("unresolved");
  });

  test("prepares exception messages without claiming external delivery", () => {
    const model = buildCommunicationsModel({
      club: { name: "Horwich St Mary's" },
      teamCfg,
      satFinal: [scheduledFixture({ status: "postponed" })],
      satHasRun: true,
      midweekEnabled: false,
    });
    expect(model.rows[0].message).toContain("Please do not travel");
    expect(model.disclaimer).toContain("does not confirm");
    expect(model.disclaimer).toContain("delivered the message");
  });

  test("keeps operational evidence separate from attendance and completed participation", () => {
    const framework = buildGrantEvidenceFramework({
      club: { name: "Horwich St Mary's", postcode: "BL6" },
      evidence: {
        entries: [{ id: "week-1" }],
        summary: { scheduled: 4, postponed: 1, scheduleCompletionRate: 80 },
      },
      metrics: { scheduledFixtures: 4, postponedFixtures: 1 },
    });
    const opportunity = framework.requirements.find((item) => item.id === "participation-opportunity");
    const demand = framework.requirements.find((item) => item.id === "sustained-demand");
    expect(demand.evidence).toContain("scheduled to proceed");
    expect(opportunity.evidence).toContain("not a player or attendance count");
    expect(framework.disclaimer).toContain("do not prove attendance");
    expect(framework.disclaimer).toContain("completed activity");
  });

  test("uses the verified Lionesses team and facilities programme limits", () => {
    const teams = VERIFIED_GRANT_PROGRAMMES.find((item) => item.id === "ff-lionesses-here-to-play");
    const facilities = VERIFIED_GRANT_PROGRAMMES.find((item) => item.id === "ff-lionesses-here-to-play-facilities");
    expect(teams.amountLabel).toContain("£500 to £7,500");
    expect(teams.amountLabel).toContain("five opportunities");
    expect(teams.deadline).toBe("2026-09-30");
    expect(facilities.amountLabel).toContain("£25,000");
    expect(facilities.amountLabel).toContain("75%");
    expect(facilities.matchFunding).toContain("25%");
    expect(facilities.eligibilityNotes.join(" ")).toContain("five years");
    expect(facilities.lastVerified).toBe("2026-07-11");
  });

  test("labels the report as an evidence draft and removes unsupported delivery claims", () => {
    expect(REPORT_TYPES.find((item) => item.id === "funding")?.label).toBe("Funding evidence draft");

    const visibleSources = [
      read("../../src/components/analytics/AnalyticsVisualDashboard.jsx"),
      read("../../src/components/analytics/GrantImpactDashboard.jsx"),
      read("../../src/components/reports/ReportDocument.jsx"),
      read("../../src/lib/reports/csvExport.js"),
    ].join("\n");

    expect(visibleSources).not.toContain("Fixtures delivered");
    expect(visibleSources).not.toContain('label="Delivery rate"');
    expect(visibleSources).not.toContain("Team delivery");
    expect(visibleSources).toContain("Schedule completion");
    expect(visibleSources).toContain("Fixtures scheduled");
  });

  test("exposes communications as an entitled, lazy-loaded customer route", () => {
    const app = read("../../src/AppCore.jsx");
    const shell = read("../../src/layout/ProductShell.jsx");
    const entitlements = read("../../src/lib/subscriptions/entitlements.js");
    expect(app).toMatch(/const\s+CommunicationsPage\s*=\s*lazy/);
    expect(app).toContain('mainPage === "communications"');
    expect(shell).toContain('["communications", "Communications"');
    expect(entitlements).toContain("communications: ENTITLEMENTS.COMMUNICATIONS");
  });
});
