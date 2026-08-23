import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const accessPanel = readFileSync("src/components/Settings/AccessSecurityPanel.jsx", "utf8");
const settingsTabs = readFileSync("src/components/Settings/SettingsTabs.jsx", "utf8");
const overview = readFileSync("src/components/Settings/SettingsOverviewPanel.jsx", "utf8");

describe("Settings access and navigation clarity", () => {
  test("separates protected primary access from additional responsibilities", () => {
    expect(accessPanel).toContain("Your primary access");
    expect(accessPanel).toContain("Additional responsibilities");
    expect(accessPanel).toContain("Members and responsibilities");
    expect(accessPanel).toContain("Primary access levels");
  });

  test("supports club, team and site scoped responsibilities, including the current owner", () => {
    expect(accessPanel).toContain('<option value="club">Whole club</option>');
    expect(accessPanel).toContain('<option value="team">One team</option>');
    expect(accessPanel).toContain('<option value="site">One site</option>');
    expect(accessPanel).toContain("canManageResponsibilities");
    expect(accessPanel).not.toContain("canEdit && canAssignAdditionalRole");
  });

  test("adds a settings finder and removes obsolete explanatory clutter", () => {
    expect(settingsTabs).toContain("Find a setting");
    expect(settingsTabs).toContain("No matching settings");
    expect(overview).not.toContain("What no longer belongs in Settings");
  });
});
