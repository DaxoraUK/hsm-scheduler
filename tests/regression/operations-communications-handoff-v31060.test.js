import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildWhatsAppFixtureSchedule } from "../../src/pages/ReportsPage.jsx";

const matchday = readFileSync("src/pages/MatchdayPage.jsx", "utf8");
const command = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");
const report = readFileSync("src/components/reports/ReportDocument.jsx", "utf8");

describe("operations to communications handoff", () => {
  test("removes the embedded communications workspace and retains a gated page handoff", () => {
    expect(matchday).not.toContain('id: "communications"');
    expect(matchday).not.toContain('id: "coachMessages"');
    expect(command).toContain("Review & publish");
    expect(command).toContain("disabled={!hasRun || blockingCount > 0 || !isLocked || approvalStale}");
    expect(matchday).toContain('className="grid gap-2 sm:grid-cols-3"');
  });

  test("builds a clean club WhatsApp schedule without internal governance labels", () => {
    const message = buildWhatsAppFixtureSchedule({
      sourceLabel: "Current matchweek",
      scope: "matchweek",
      fixtures: [{ dateLabel: "Saturday, 29 August", koTime: "09:00", homeTeam: "U8 Sharks", awayTeam: "Westhoughton U8", pitchLabel: "Pitch 5", format: "5v5", referee: "Ivor Altdorf", status: "delivered", statusLabel: "Scheduled" }],
    }, { name: "Horwich St Mary's FC" });
    expect(message).toContain("Horwich St Mary's FC fixture allocations");
    expect(message).toContain("09:00 · U8 Sharks v Westhoughton U8");
    expect(message).toContain("Ref: Ivor Altdorf");
    expect(message).not.toContain("Review required");
    expect(message).not.toContain("Evidence confidence");
    expect(report).toContain('model.reportType !== "fixtures"');
  });

  test("balances the three fixture-report actions", () => {
    const reportsPage = readFileSync("src/pages/ReportsPage.jsx", "utf8");
    expect(reportsPage).toContain('"grid w-full gap-2 sm:grid-cols-3"');
    expect(reportsPage).toContain('Share to club WhatsApp');
    expect(reportsPage).toContain('reportType === "fixtures" ? "w-full"');
  });
});
