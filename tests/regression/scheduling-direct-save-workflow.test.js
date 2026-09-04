import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("authorised matchday direct-save workflow", () => {
  test("routes Calendar Save through canonical matchday state, never matchweek history", () => {
    const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

    expect(page).toContain("saveSchedule");
    expect(page).not.toContain("const published = await props.saveWeek?.();");
  });

  test("uses capability checks and a revisioned scheduling state for save and publish", () => {
    const app = readFileSync("src/AppCore.jsx", "utf8");

    expect(app).toContain("DB.saveMatchdaySchedulingState");
    expect(app).toContain("DB.publishMatchdaySchedulingState");
    expect(app).toContain("operationalWorkspaceAccess.canOperate");
    expect(app).toContain("operationalWorkspaceAccess.canPublish");
  });

  test("removes schedule approval locks from the command workflow", () => {
    const command = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");

    expect(command).not.toContain("Approve and lock the schedule");
    expect(command).not.toContain("Review & publish");
    expect(command).toContain("Publish schedule");
  });

  test("does not report a Resolution Centre assignment successful before the canonical rebuild confirms it", () => {
    const resolution = readFileSync("src/components/Operations/shared/MatchdayUnresolvedCard.jsx", "utf8");
    const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

    expect(resolution).toContain("await onResolveFixture");
    expect(resolution).toContain("Fixture remains unresolved after validation");
    expect(page).toContain("state?.state !== \"scheduled\"");
  });
});
