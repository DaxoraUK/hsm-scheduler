import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { buildLocalFundingDiscovery, fundingProfileGaps } from "../../src/lib/grants/localFundingDiscovery.js";
import { normaliseUkPostcode, resolveFundingPostcode } from "../../src/lib/grants/postcodeService.js";

const projectRoot = path.resolve(process.cwd());
const workspacePanel = fs.readFileSync(path.join(projectRoot, "src/components/analytics/FundingWorkspacePanel.jsx"), "utf8");
const uploadDialog = fs.readFileSync(path.join(projectRoot, "src/components/analytics/FundingDocumentUploadDialog.jsx"), "utf8");
const locationPanel = fs.readFileSync(path.join(projectRoot, "src/components/analytics/FundingLocationPanel.jsx"), "utf8");
const migration = fs.readFileSync(path.join(projectRoot, "supabase/migrations/202607050009_funding_local_discovery.sql"), "utf8");

describe("funding documents and local discovery", () => {
  test("makes document upload visible from the workspace and evidence library", () => {
    expect(workspacePanel).toContain('"Upload document"');
    expect(workspacePanel).toContain("Upload first document");
    expect(workspacePanel).toContain("Attach evidence");
    expect(workspacePanel).toContain("FundingDocumentUploadDialog");
    expect(uploadDialog).toContain("Upload and link evidence");
    expect(uploadDialog).toContain("moves a missing requirement to");
    expect(uploadDialog).toContain("In progress");
  });

  test("builds England local discovery around council, community foundation and County FA routes", () => {
    const discovery = buildLocalFundingDiscovery({
      profile: {
        postcode: "BL6 7QE",
        facilityPostcode: "BL6 7QE",
        homeNation: "england",
        region: "North West",
        localAuthority: "Bolton",
        countyFa: "Lancashire FA",
        legalStructure: "Constituted club",
        affiliation: "Lancashire FA",
        tenure: "Lease to 2041",
      },
      projectType: "grass-pitch",
    });
    const ids = discovery.sources.map((item) => item.id);
    expect(discovery.readyForLocalSearch).toBe(true);
    expect(ids).toContain("local-council-finder");
    expect(ids).toContain("uk-community-foundations");
    expect(ids).toContain("england-county-fa");
    expect(ids).toContain("gov-find-a-grant");
    expect(discovery.sources.find((item) => item.id === "england-county-fa")?.reason).toContain("Lancashire FA");
  });

  test("identifies missing location and organisation fields before local matching", () => {
    const gaps = fundingProfileGaps({ homeNation: "england", postcode: "BL6 7QE" });
    expect(gaps.map((gap) => gap.key)).toEqual(expect.arrayContaining(["localAuthority", "region", "legalStructure", "affiliation", "tenure", "countyFa"]));
    expect(locationPanel).toContain("profile item");
    expect(locationPanel).toContain("Resolve postcode");
  });

  test("resolves a UK postcode into funding geography using the postcode service", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          postcode: "BL6 7QE",
          country: "England",
          region: "North West",
          admin_district: "Bolton",
          admin_county: null,
          parliamentary_constituency: "Bolton West",
          latitude: 53.58,
          longitude: -2.54,
          codes: { admin_district: "E08000001" },
        },
      }),
    });
    const result = await resolveFundingPostcode("bl67qe", { fetchImpl, timeoutMs: 1000 });
    expect(normaliseUkPostcode("bl67qe")).toBe("BL6 7QE");
    expect(result.homeNation).toBe("england");
    expect(result.localAuthority).toBe("Bolton");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  test("stores the funding profile behind club-isolated row level security", () => {
    expect(migration).toContain("create table if not exists public.funding_profiles");
    expect(migration).toContain("alter table public.funding_profiles force row level security");
    expect(migration).toContain("public.can_read_club(club_id)");
    expect(migration).toContain("public.can_manage_club(club_id)");
    expect(migration).toContain("revoke all on table public.funding_profiles from public, anon, authenticated");
  });
});
