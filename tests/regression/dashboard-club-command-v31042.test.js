import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  canOpenClubCommand,
  canOpenWorkspacePage,
} from "../../src/lib/navigation/workspacePageAccess.js";
import { normaliseSubscriptionPayload, PLAN_CODES } from "../../src/lib/subscriptions/entitlements.js";

const shell = readFileSync("src/layout/ProductShell.jsx", "utf8");
const dashboard = readFileSync("src/pages/DashboardPage.jsx", "utf8");
const appCore = readFileSync("src/AppCore.jsx", "utf8");
const clubCommand = readFileSync("src/pages/EliteCommandCentrePage.jsx", "utf8");

describe("Daxora Ground Control v3.10.42 dashboard and Club Command simplification", () => {
  const elite = normaliseSubscriptionPayload({ planCode: PLAN_CODES.ELITE, status: "active", accessState: "full" });
  const pro = normaliseSubscriptionPayload({ planCode: PLAN_CODES.PRO, status: "active", accessState: "full" });

  test("requires both Elite entitlement and effective governance permission", () => {
    const leader = { canViewAudit: true, isSupport: false };
    const operator = { canViewAudit: false, isSupport: false };
    const support = { canViewAudit: true, isSupport: true };

    expect(canOpenClubCommand(leader)).toBe(true);
    expect(canOpenClubCommand(operator)).toBe(false);
    expect(canOpenClubCommand(support)).toBe(false);
    expect(canOpenWorkspacePage(elite, "executive", leader)).toBe(true);
    expect(canOpenWorkspacePage(elite, "executive", operator)).toBe(false);
    expect(canOpenWorkspacePage(pro, "executive", leader)).toBe(false);
  });

  test("keeps Mission Control primary and exposes one conditional leadership handoff", () => {
    expect(shell).toContain('["dashboard", "Mission Control"');
    expect(shell).toContain('["executive", "Club Command"');
    expect(shell).toContain("canOpenWorkspacePage(subscription, key, workspaceAccess)");
    expect(dashboard).toContain('title="Open Club Command"');
    expect(dashboard).toContain("clubCommandAvailable ? (");
  });

  test("guards rendering with the same effective access authority", () => {
    expect(appCore).toContain("const clubCommandAllowed = canOpenClubCommand(workspaceAccess)");
    expect(appCore).toContain('mainPage === "executive" && pageEntitled && clubCommandAllowed');
    expect(clubCommand).toContain("Club Command workspace");
    expect(clubCommand).toContain("Club Command");
  });
});
