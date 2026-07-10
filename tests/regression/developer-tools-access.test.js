import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const settingsPage = readFileSync(new URL("../../src/pages/SettingsPage.jsx", import.meta.url), "utf8");
const settingsTabs = readFileSync(new URL("../../src/components/Settings/SettingsTabs.jsx", import.meta.url), "utf8");

describe("platform developer tools access", () => {
  test("does not tie the fixture generator to a commercial entitlement", () => {
    expect(settingsPage).not.toContain("testdata: ENTITLEMENTS.MATCHDAY_SCHEDULING");
    expect(settingsTabs).not.toContain('["timing", "history", "testdata"]');
  });

  test("shows developer tools only to platform staff outside production mode", () => {
    expect(settingsPage).toContain("developerToolsAllowed");
    expect(settingsTabs).toContain('if (key === "testdata")');
    expect(settingsTabs).toContain("Boolean(platformContext?.isPlatformStaff) && !productionMode");
  });
});
