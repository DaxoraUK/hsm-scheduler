import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ENTITLEMENTS,
  LIMIT_KEYS,
  PLAN_CODES,
  getEntitlementLimit,
  hasEntitlement,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";
import {
  buildEliteBoardCsv,
  buildEliteBoardHtml,
  buildEliteCommandModel,
} from "../../src/lib/elite/eliteCommandEngine.js";

const shell = readFileSync("src/layout/ProductShell.jsx", "utf8");
const appCore = readFileSync("src/AppCore.jsx", "utf8");
const settings = readFileSync("src/components/Settings/SettingsTabs.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202607130001_elite_operating_layer.sql", "utf8");

function subscription(planCode) {
  return normaliseSubscriptionPayload({
    club_id: `club-${planCode}`,
    plan_code: planCode,
    status: "active",
    access_state: "full",
  });
}

describe("Elite organisation operating layer", () => {
  test("Elite is commercially distinct from Pro", () => {
    const pro = subscription(PLAN_CODES.PRO);
    const elite = subscription(PLAN_CODES.ELITE);

    expect(hasEntitlement(pro, ENTITLEMENTS.ORGANISATION_COMMAND)).toBe(false);
    expect(hasEntitlement(elite, ENTITLEMENTS.ORGANISATION_COMMAND)).toBe(true);
    expect(hasEntitlement(elite, ENTITLEMENTS.EXECUTIVE_REPORTING)).toBe(true);
    expect(hasEntitlement(elite, ENTITLEMENTS.GOVERNANCE_CONTROLS)).toBe(true);
    expect(getEntitlementLimit(elite, LIMIT_KEYS.TEAMS)).toBe(60);
    expect(getEntitlementLimit(elite, LIMIT_KEYS.VENUES)).toBe(8);
    expect(getEntitlementLimit(elite, LIMIT_KEYS.USERS)).toBe(25);
    expect(getEntitlementLimit(elite, LIMIT_KEYS.PITCHES)).toBe(80);
  });

  test("builds a factual cross-site command model from current club data", () => {
    const model = buildEliteCommandModel({
      club: {
        name: "Daxora Community Club",
        primarySiteId: "north",
        features: { parkingEnabled: true },
        eliteGovernance: {
          executiveSponsorName: "Alex Chair",
          executiveSponsorTitle: "Chair",
          siteLeads: { north: { name: "North Lead", role: "Site Manager" } },
        },
        sites: [
          { id: "north", name: "North Ground", postcode: "BL1 1AA", carParkSpaces: 80, isPrimary: true },
          { id: "south", name: "South Ground", postcode: "", carParkSpaces: 0 },
        ],
      },
      teamCfg: [
        { id: "u14", name: "U14", siteId: "north" },
        { id: "open", name: "First Team", siteId: "south" },
      ],
      pitchCfg: [
        { id: "N1", label: "North 1", siteId: "north" },
        { id: "S1", label: "South 1", siteId: "south" },
      ],
      memberships: [
        { user_id: "owner-1", display_name: "North Lead", role: "owner" },
        { user_id: "admin-1", display_name: "Club Admin", role: "admin" },
      ],
      siteResponsibilities: [
        { siteId: "north", userId: "owner-1", responsibility: "site_lead", active: true },
      ],
      satFinal: [
        { homeTeam: "U14", pitchId: "N1", referee: "Official A" },
        { homeTeam: "First Team", pitchId: "S1" },
      ],
      satUnresolved: [{ homeTeam: "First Team", pitchId: "S1" }],
      closedPitches: ["S1"],
    });

    expect(model.siteCount).toBe(2);
    expect(model.fixtureCount).toBe(2);
    expect(model.readySites).toBe(1);
    expect(model.sites.find((site) => site.id === "south")?.status.key).toBe("action");
    expect(model.actions.map((item) => item.label).join(" ")).toContain("South Ground");
    expect(model.governanceScore).toBe(75);
  });

  test("exports board-ready site evidence without claiming delivered participation", () => {
    const model = buildEliteCommandModel({
      club: { name: "Elite Club", sites: [{ id: "main", name: "Main", postcode: "BL1 1AA", carParkSpaces: 50, isPrimary: true }] },
      pitchCfg: [{ id: "P1", siteId: "main" }],
      satFinal: [{ homeTeam: "U12", pitchId: "P1", referee: "Ref" }],
      teamCfg: [{ name: "U12", siteId: "main" }],
      memberships: [{ role: "owner" }, { role: "admin" }],
    });
    const csv = buildEliteBoardCsv(model);
    const html = buildEliteBoardHtml(model);

    expect(csv).toContain("Scheduled fixtures");
    expect(csv).toContain("Main");
    expect(html).toContain("Elite organisation report");
    expect(html).toContain("Scheduled fixtures do not prove completed activity");
    expect(html).not.toContain("delivered participants");
  });

  test("exposes the Elite route and governance settings only through entitlement checks", () => {
    expect(shell).toContain('["executive", "Organisation Command"');
    expect(appCore).toContain('mainPage === "executive"');
    expect(appCore).toContain("<EliteCommandCentrePage");
    expect(settings).toContain('key === "governance"');
    expect(settings).toContain("ENTITLEMENTS.GOVERNANCE_CONTROLS");
  });

  test("database packaging installs the Elite 60 band and organisation entitlements", () => {
    expect(migration).toContain("organisation_command");
    expect(migration).toContain("executive_reporting");
    expect(migration).toContain("governance_controls");
    expect(migration).toContain('"teams":60');
    expect(migration).toContain('"venues":8');
    expect(migration).toContain("custom_contracted_capacity");
  });
});
