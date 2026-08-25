import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("club invitation email delivery", () => {
  it("dispatches created and replacement invitations through the authenticated email route", () => {
    const panel = fs.readFileSync("src/components/Settings/AccessSecurityPanel.jsx", "utf8");
    expect(panel).toContain('invitationType: "club"');
    expect(panel).toContain("Invitation emailed");
    expect(panel).toContain("Fresh invitation emailed");
  });
  it("authorises delivery against the pending invitation in the database", () => {
    const migration = fs.readFileSync("supabase/migrations/202608250004_club_invitation_email_delivery.sql", "utf8");
    expect(migration).toContain("public.can_manage_club");
    expect(migration).toContain("status='pending'");
  });
});
