import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const settingsPage = readFileSync(
  new URL("../../src/pages/SettingsPage.jsx", import.meta.url),
  "utf8",
);
const settingsTabs = readFileSync(
  new URL("../../src/components/Settings/SettingsTabs.jsx", import.meta.url),
  "utf8",
);

describe("developer tools access", () => {
  test("keeps demonstration fixture tooling outside commercial entitlements", () => {
    expect(settingsPage).not.toContain(
      "testdata: ENTITLEMENTS.MATCHDAY_SCHEDULING",
    );
    expect(settingsTabs).not.toContain(
      "ENTITLEMENTS.MATCHDAY_SCHEDULING) return",
    );
  });

  test("requires development mode and platform staff access", () => {
    expect(settingsPage).toContain(
      "!productionMode && Boolean(platformContext?.isPlatformStaff)",
    );
    expect(settingsTabs).toContain(
      "!productionMode && Boolean(platformContext?.isPlatformStaff)",
    );
    expect(settingsPage).toContain(
      'activeTab === "testdata" && developerToolsAllowed',
    );
  });
});
