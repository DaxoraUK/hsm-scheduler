import { describe, expect, it } from "vitest";
import { buildHostedPrivacyNoticeUrl, clubPrivacySlug } from "../../src/lib/communications/privacyModel.js";

describe("hosted club privacy notice", () => {
  it("uses the authoritative club slug when available", () => {
    expect(buildHostedPrivacyNoticeUrl({ name: "Wrong", slug: "horwich-st-marys-fc" })).toBe("https://app.daxora.co.uk/privacy/horwich-st-marys-fc");
  });

  it("derives a safe fallback slug for unsaved local clubs", () => {
    expect(clubPrivacySlug({ name: "Horwich St Mary's FC" })).toBe("horwich-st-mary-s-fc");
  });
});
