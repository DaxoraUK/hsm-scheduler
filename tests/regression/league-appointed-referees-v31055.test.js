import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const drawer = readFileSync("src/components/Operations/shared/FixtureDrawer.jsx", "utf8");
const roadmap = readFileSync("docs/roadmaps/FULL_TIME_INTEGRATION_ROADMAP.md", "utf8");

describe("league-appointed referee workflow", () => {
  test("offers the official fixture link and permits free-text league appointments only in the editable control", () => {
    expect(drawer).toContain("Open fixture on Full-Time");
    expect(drawer).toContain('placeholder="Type the league-appointed referee"');
    expect(drawer).toContain('officialRole: selectedRef?.role || (value ? "league_referee" : "")');
    expect(drawer).toContain("{canEdit ? (");
  });

  test("records the provider and governance boundary", () => {
    expect(roadmap).toContain("The league, not the club, is authoritative for league referee appointments.");
    expect(roadmap).toContain("does not scrape, bypass Full-Time protections");
    expect(roadmap).toContain("authorised integration or explicit written permission");
  });
});
