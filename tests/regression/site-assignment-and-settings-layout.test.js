import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildEliteCommandModel } from "../../src/lib/elite/eliteCommandEngine.js";
import {
  getClubSites,
  reconcileSiteAssignments,
  resolveSiteId,
} from "../../src/lib/siteAssignments.js";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const pitchPanel = readFileSync("src/components/Settings/PitchSettingsPanel.jsx", "utf8");
const teamPanel = readFileSync("src/components/Settings/TeamSettingsPanel.jsx", "utf8");

describe("site assignments and resource settings layout", () => {
  const oneSiteClub = {
    primarySiteId: "main-ground",
    sites: [{ id: "main-ground", name: "Main Ground", isPrimary: true, postcode: "BL6 7QE", carParkSpaces: 80 }],
  };

  test("repairs historic resource identifiers when the club has one current site", () => {
    const sites = getClubSites(oneSiteClub);
    expect(resolveSiteId("scholes-bank", sites, "main-ground")).toBe("main-ground");

    const result = reconcileSiteAssignments({
      club: oneSiteClub,
      teams: [{ name: "U14", siteId: "scholes-bank" }],
      pitches: [{ id: "P1", siteId: "scholes-bank" }],
    });

    expect(result.teams[0].siteId).toBe("main-ground");
    expect(result.pitches[0].siteId).toBe("main-ground");
    expect(result.repairedTeams).toBe(1);
    expect(result.repairedPitches).toBe(1);
  });

  test("does not silently move an unknown identifier when several sites exist", () => {
    const sites = getClubSites({
      primarySiteId: "north",
      sites: [
        { id: "north", name: "North", isPrimary: true },
        { id: "south", name: "South" },
      ],
    });
    expect(resolveSiteId("historic-third-site", sites, "north")).toBe("historic-third-site");
  });

  test("counts legacy HSM pitches and teams on the current sole venue in Organisation Command", () => {
    const model = buildEliteCommandModel({
      club: oneSiteClub,
      teamCfg: [{ name: "U14", siteId: "scholes-bank" }],
      pitchCfg: [{ id: "P1", label: "Pitch 1", siteId: "scholes-bank" }],
      memberships: [{ user_id: "owner-1", display_name: "Site Lead", role: "owner" }],
      siteResponsibilities: [{ siteId: "main-ground", userId: "owner-1", responsibility: "site_lead", active: true }],
    });

    expect(model.sites[0].teams).toBe(1);
    expect(model.sites[0].pitches).toBe(1);
    expect(model.sites[0].issues).not.toContain("No pitches assigned");
  });

  test("normalises assignments during hydration and saving, and keeps dense editors responsive to their own width", () => {
    expect(appCore).toContain("reconcileSiteAssignments");
    expect(appCore).toContain('data.pitchCfg || tab === "pitches"');
    expect(pitchPanel).toContain("@container");
    expect(pitchPanel).toContain("@4xl:grid-cols-[230px_minmax(0,1fr)]");
    expect(teamPanel).toContain("Protected coach contact");
    expect(teamPanel).toContain("grid-cols-[repeat(auto-fit,minmax(210px,1fr))]");
  });
});
