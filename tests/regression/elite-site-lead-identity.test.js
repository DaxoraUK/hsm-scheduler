import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildEliteCommandModel } from "../../src/lib/elite/eliteCommandEngine.js";
import { normaliseEliteResponsibility } from "../../src/lib/elite/eliteGovernanceService.js";

const service = readFileSync("src/lib/elite/eliteGovernanceService.js", "utf8");
const migration = readFileSync("supabase/migrations/202607130004_elite_responsibility_labels.sql", "utf8");

const club = {
  primarySiteId: "main-ground",
  sites: [{ id: "main-ground", name: "Main Ground", isPrimary: true, postcode: "BL6 7QE", carParkSpaces: 80 }],
};

describe("Elite site lead identity", () => {
  test("uses the securely hydrated member display name without requiring the access-membership list", () => {
    const responsibility = normaliseEliteResponsibility({
      id: "responsibility-1",
      site_id: "main-ground",
      user_id: "ef532ae9-2bbb-42d1-9917-282b4fce64b9",
      display_name: "Andrew Manville",
      email: "andrew@example.com",
      responsibility: "site_lead",
      active: true,
    });
    const model = buildEliteCommandModel({
      club,
      pitchCfg: [{ id: "P1", siteId: "main-ground" }],
      siteResponsibilities: [responsibility],
    });

    expect(model.sites[0].leadName).toBe("Andrew Manville");
    expect(model.sites[0].leadName).not.toContain("ef532ae9");
    expect(model.sites[0].issues).not.toContain("Site lead not assigned");
  });

  test("never exposes a raw user UUID when a legacy row has no visible profile label", () => {
    const model = buildEliteCommandModel({
      club,
      pitchCfg: [{ id: "P1", siteId: "main-ground" }],
      siteResponsibilities: [{
        siteId: "main-ground",
        userId: "ef532ae9-2bbb-42d1-9917-282b4fce64b9",
        responsibility: "site_lead",
        active: true,
      }],
    });

    expect(model.sites[0].leadName).toBe("Assigned club member");
    expect(model.sites[0].leadName).not.toMatch(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
  });

  test("loads responsibility labels through a read-authorised security-definer function", () => {
    expect(service).toContain('rpc/list_elite_site_responsibilities');
    expect(migration).toContain("public.can_read_club(target_club_id)");
    expect(migration).toContain("private.club_has_entitlement(target_club_id, 'site_responsibility')");
    expect(migration).toContain("left join public.user_profiles");
    expect(migration).toContain("'display_name'");
    expect(migration).toContain("'email'");
  });
});
