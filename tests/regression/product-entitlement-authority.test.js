import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = path.resolve(".");
const migration = fs.readFileSync(
  path.join(projectRoot, "supabase/migrations/202608230013_product_entitlement_authority.sql"),
  "utf8",
);
const adminPage = fs.readFileSync(path.join(projectRoot, "src/pages/PlatformAdminPage.jsx"), "utf8");
const supabaseClient = fs.readFileSync(path.join(projectRoot, "src/lib/supabase.js"), "utf8");

describe("persistent product entitlement authority", () => {
  test("limits writes to platform administrators and an allow-listed product set", () => {
    expect(migration).toContain("private.require_platform_staff('admin')");
    expect(migration).toContain("array['ground_control', 'coach_hub']");
    expect(migration).toContain("Unsupported product entitlement");
    expect(migration).toContain("subscription.product_access.update");
  });

  test("preserves inferred legacy access until an explicit product array exists", () => {
    expect(migration).toContain("if products is null then");
    expect(migration).toContain("return null");
    expect(supabaseClient).toContain("product_entitlements: Array.isArray(productEntitlements) ? productEntitlements : null");
  });

  test("exposes distinct audited controls in Daxora Admin", () => {
    expect(adminPage).toContain("Product access");
    expect(adminPage).toContain("Apply and audit product access");
    expect(adminPage).toContain("platformSetClubProductEntitlements");
  });
});
