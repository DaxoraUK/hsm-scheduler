import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const settingsPage = readFileSync(new URL("../../src/pages/SettingsPage.jsx", import.meta.url), "utf8");
const settingsTabs = readFileSync(new URL("../../src/components/Settings/SettingsTabs.jsx", import.meta.url), "utf8");

describe("developer tools access", () => {
  test("does not tie the fixture generator to a commercial entitlement", () => {
    expect(settingsPage).not.toContain("testdata: ENTITLEMENTS.MATCHDAY_SCHEDULING");
    expect(settingsTabs).not.toContain('["timing", "history", "testdata"]');
  });

  test("shows the fixture generator whenever the secured workspace is in development mode", () => {
    expect(settingsPage).toContain("const developerToolsAllowed = !productionMode");
    expect(settingsTabs).toContain('if (key === "testdata") return !productionMode');
    expect(settingsPage).toContain('activeTab === "testdata" && developerToolsAllowed');
  });
});
