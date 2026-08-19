import { describe, expect, test } from "vitest";
import fs from "node:fs";

const demoPath = "src/demo/teamfeepay/TeamFeePayAcquisitionDemo.jsx";
const dbPath = "src/demo/teamfeepay/teamfeepayAppDemoDb.js";

describe("TeamFeePay real application demo", () => {
  test("renders AppCore instead of copying product pages", () => {
    const source = fs.readFileSync(demoPath, "utf8");
    expect(source).toContain('import AppCore from "../../AppCore.jsx"');
    expect(source).toContain("<AppCore />");
    expect(source).not.toMatch(/pages\//);
  });

  test("uses synthetic data and an isolated DB adapter", () => {
    const source = fs.readFileSync(dbPath, "utf8");
    expect(source).toContain("ACQUISITION_DEMO_CLUB");
    expect(source).toContain("listMemberships");
    expect(source).toContain("getClubSubscription");
    expect(source).toContain("getLeagueWorkspace");
  });

  test("does not claim a live TeamFeePay connection", () => {
    const source = fs.readFileSync(demoPath, "utf8");
    expect(source).toContain("No TeamFeePay production connection is active");
  });
});
