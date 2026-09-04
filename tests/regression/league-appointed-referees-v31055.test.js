import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const drawer = readFileSync("src/components/Operations/shared/FixtureDrawer.jsx", "utf8");
const roadmap = readFileSync("docs/roadmaps/FULL_TIME_INTEGRATION_ROADMAP.md", "utf8");

describe("league-appointed referee workflow", () => {
  test("offers the fixture link, referee-pool selector and free-text league appointment fallback", () => {
    expect(drawer).toContain("Open fixture on Full-Time");
    expect(drawer).toContain('aria-label="Select referee from pool"');
    expect(drawer).toContain("Select from referee pool...");
    expect(drawer).toContain('placeholder="Or type the league-appointed referee"');
    expect(drawer).toContain('officialRole: selectedRef?.role || (value ? "league_referee" : "")');
    expect(drawer).toContain('refStatus: value ? "Pending" : "TBC"');
    expect(drawer).toContain('officialSource: value ? (selectedRef ? "Internal" : "Unknown") : "Unknown"');
    expect(drawer).toContain("{canEdit ? (");
  });

  test("records the provider and governance boundary", () => {
    expect(roadmap).toContain("The league, not the club, is authoritative for league referee appointments.");
    expect(roadmap).toContain("does not scrape, bypass Full-Time protections");
    expect(roadmap).toContain("authorised integration or explicit written permission");
  });
});
