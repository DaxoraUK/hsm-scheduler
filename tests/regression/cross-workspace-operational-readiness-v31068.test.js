import { describe, expect, it } from "vitest";
import { buildCoreOperationalReadiness } from "../../src/lib/engines/operationalReadinessEngine.js";
import { buildOperationsCentreSnapshot } from "../../src/lib/engines/operationsCentreEngine.js";
import { readFileSync } from "node:fs";

describe("cross-workspace operational readiness", () => {
  it("blocks on unresolved fixtures but keeps officials, closures and parking advisory", () => {
    const readiness = buildCoreOperationalReadiness({
      scheduleBuilt: true,
      unresolvedCount: 2,
      officialOutstanding: 3,
      parkingOverCapacity: true,
      closedPitchCount: 1,
      communicationsReady: true,
    });
    expect(readiness.blockerCount).toBe(2);
    expect(readiness.warningCount).toBe(5);
    expect(readiness.readyToLock).toBe(false);
  });

  it("allows lock readiness with advisory warnings still visible", () => {
    const readiness = buildCoreOperationalReadiness({
      scheduleBuilt: true,
      officialOutstanding: 4,
      parkingHighPressure: true,
      communicationsReady: true,
    });
    expect(readiness.blockerCount).toBe(0);
    expect(readiness.warningCount).toBe(5);
    expect(readiness.readyToLock).toBe(true);
  });

  it("exposes the same affected-item counts to Operations Centre", () => {
    const snapshot = buildOperationsCentreSnapshot({
      fixtures: [{ id: "f1", status: "scheduled", referee: "", refStatus: "TBC" }],
      scheduleBuilt: true,
      unresolvedCount: 1,
      pitchCfg: [{ id: "p1" }],
      closedPitches: ["p1"],
      club: { carCap: 0 },
    });
    expect(snapshot.metrics.blockingItems).toBe(snapshot.coreReadiness.blockerCount);
    expect(snapshot.metrics.warningItems).toBe(snapshot.coreReadiness.warningCount);
  });

  it("labels action areas separately from affected blockers and warnings", () => {
    const source = readFileSync("src/pages/OperationsCentrePage.jsx", "utf8");
    expect(source).toContain("action area");
    expect(source).toContain("snapshot.metrics.blockingItems");
    expect(source).toContain("snapshot.metrics.warningItems");
  });
});
