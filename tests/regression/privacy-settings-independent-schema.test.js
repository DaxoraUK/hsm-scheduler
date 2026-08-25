import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("privacy settings availability", () => {
  it("does not disable privacy saving when the optional contact loader is unavailable", () => {
    const source = fs.readFileSync("src/AppCore.jsx", "utf8");
    const privacyFirst = source.indexOf("DB.getCommunicationPrivacy(activeClubId)");
    const contactFallback = source.indexOf("DB.loadTeamContacts(activeClubId).catch", privacyFirst);
    const availableResult = source.indexOf("available: true, contacts, privacy", contactFallback);
    expect(privacyFirst).toBeGreaterThan(-1);
    expect(contactFallback).toBeGreaterThan(privacyFirst);
    expect(availableResult).toBeGreaterThan(contactFallback);
  });
});
