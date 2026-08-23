import { describe, expect, it } from "vitest";
import {
  buildActionSummary,
  createPlatformAction,
  dedupeActions,
  getActionIdentity,
} from "../../src/lib/engines/actionFramework.js";
import { buildRecommendationCentre } from "../../src/lib/engines/recommendationCentreEngine.js";
import { calculateOperationsIntelligence } from "../../src/lib/engines/operationsIntelligenceEngine.js";

describe("shared intelligence action framework", () => {
  it("merges the same issue from multiple engines and retains the strongest guidance", () => {
    const merged = dedupeActions([
      { id: "watch", dedupeKey: "parking-pressure", severity: "watch", title: "Watch parking", detail: "95% peak" },
      { id: "review", dedupeKey: "parking-pressure", severity: "attention", title: "Prepare steward plan", guidance: "Cover arrivals" },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "review",
      severity: "attention",
      title: "Prepare steward plan",
      detail: "95% peak",
      guidance: "Cover arrivals",
    });
  });

  it("normalises domain aliases when an explicit issue key is unavailable", () => {
    expect(getActionIdentity({ id: "same", domain: "rules" }))
      .toBe(getActionIdentity({ id: "same", domain: "competitionRules" }));
  });

  it("provides the complete shared contract used by legacy intelligence engines", () => {
    const action = createPlatformAction({ title: "Review", priority: 10 });
    const summary = buildActionSummary([action, action]);
    expect(summary.actions).toHaveLength(1);
    expect(summary.nextAction).toEqual(summary.actions[0]);
  });

  it("gives overlapping matchday engines the same issue identities", () => {
    const input = {
      fixtures: [{ id: "f1", status: "scheduled", ko: "09:00", referee: "", refStatus: "TBC" }],
      active: [{ id: "f1", status: "scheduled", ko: "09:00", referee: "", refStatus: "TBC" }],
      refWarnings: 1,
      hasRun: true,
      competitionRules: { metrics: { danger: 1, warnings: 0 } },
    };
    const centre = buildRecommendationCentre(input);
    const intelligence = calculateOperationsIntelligence(input);
    const combined = dedupeActions([...centre.actions, ...intelligence.insights]);

    expect(combined.filter((item) => item.dedupeKey === "officials-readiness")).toHaveLength(1);
    expect(combined.filter((item) => item.dedupeKey === "competition-rules")).toHaveLength(1);
  });
});
