import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  getSettingsGroupKey,
  getVisibleSettingsGroups,
} from "../../src/components/Settings/SettingsTabs.jsx";
import {
  normaliseSubscriptionPayload,
  PLAN_CATALOGUE,
} from "../../src/lib/subscriptions/entitlements.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const dashboard = read("../../src/pages/DashboardPage.jsx");
const statusStrip = read(
  "../../src/components/dashboard/DashboardStatusStrip.jsx",
);
const matchday = read("../../src/pages/MatchdayPage.jsx");
const weatherService = read("../../src/lib/services/weatherService.js");
const vercelConfig = read("../../vercel.json");

function subscription(planCode, accessState = "full") {
  return normaliseSubscriptionPayload({
    plan_code: planCode,
    status: "active",
    access_state: accessState,
    plan_limits: PLAN_CATALOGUE[planCode]?.limits,
  });
}

const ownerAccess = {
  canManageSubscription: true,
  canViewAudit: true,
};

describe("live interface polish", () => {
  test("uses a compact full-word matchweek control bar", () => {
    expect(statusStrip).toContain("Matchweek overview");
    expect(statusStrip).toContain('label: "Matchweek"');
    expect(statusStrip).toContain('label: "Weekend"');
    expect(statusStrip).toContain('label: "Midweek"');
    expect(statusStrip).toContain('label: "Saturday"');
    expect(statusStrip).toContain('label: "Sunday"');
    expect(statusStrip).not.toContain('label: "W/end"');
    expect(statusStrip).not.toContain("Matchday status");
    expect(dashboard).toContain("More matchweek actions");
    expect(dashboard).toContain("Awaiting schedule");
    expect(statusStrip).toContain("relative z-20 overflow-visible");
    expect(statusStrip).toContain("overflow-hidden rounded-b-[26px]");
    expect(statusStrip).not.toContain(
      '<section className="overflow-hidden rounded-[26px]',
    );
  });

  test("keeps matchday workspaces compact and collapsed by default", () => {
    expect(matchday).toContain("min-h-[60px]");
    expect(matchday).toContain("function shouldAutoExpandSection()");
    expect(matchday).toContain("return false;");
    expect(matchday).toContain("getParkingStats");
    expect(matchday).toContain("Configure parking");
  });

  test("reduces Settings to six customer-facing top-level groups", () => {
    const groups = getVisibleSettingsGroups({
      productionMode: true,
      workspaceAccess: ownerAccess,
      subscription: subscription("pro"),
      platformContext: { isPlatformStaff: false },
    });

    expect(groups.map((group) => group.key)).toEqual([
      "overview",
      "club",
      "resources",
      "scheduling",
      "access-data",
      "plan",
    ]);
    expect(getSettingsGroupKey("venues")).toBe("club");
    expect(getSettingsGroupKey("refs")).toBe("resources");
    expect(getSettingsGroupKey("history")).toBe("access-data");
  });

  test("keeps suspended workspaces understandable rather than showing an empty Settings menu", () => {
    const groups = getVisibleSettingsGroups({
      productionMode: true,
      workspaceAccess: ownerAccess,
      subscription: subscription("pro", "read_only"),
      platformContext: { isPlatformStaff: false },
    });

    expect(groups.map((group) => group.key)).toEqual(["overview", "plan"]);
    expect(groups.find((group) => group.key === "plan")?.tabs).toEqual([
      ["subscription", "Plan & subscription"],
      ["billing", "Billing & legal"],
    ]);
  });

  test("routes production weather through the Vercel API without exposing provider secrets", () => {
    expect(weatherService).toContain('url: "/api/weather"');
    expect(weatherService).toContain('usageMode: "server-proxy"');
    const config = JSON.parse(vercelConfig);
    expect(config.rewrites.some((rewrite) => rewrite.source.includes("(?!api/)"))).toBe(true);
    expect(config.rewrites.some((rewrite) => rewrite.source === "/(.*)")).toBe(false);
  });
});
