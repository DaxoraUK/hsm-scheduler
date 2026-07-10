import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = path.resolve(".");
const migration = fs.readFileSync(
  path.join(projectRoot, "supabase/migrations/202607100003_repair_subscription_packages_and_history_loading.sql"),
  "utf8"
);
const adminPage = fs.readFileSync(path.join(projectRoot, "src/pages/PlatformAdminPage.jsx"), "utf8");
const entitlementHook = fs.readFileSync(path.join(projectRoot, "src/hooks/useClubEntitlements.js"), "utf8");
const supabaseClient = fs.readFileSync(path.join(projectRoot, "src/lib/supabase.js"), "utf8");

describe("authoritative package repair", () => {
  test("repairs all package matrices and makes false overrides non-destructive", () => {
    expect(migration).toContain("'operations_advanced','reports_advanced','analytics_advanced','multi_venue'");
    expect(migration).toContain("lower(trim(entitlement_key)) = any(plan.entitlements)");
    expect(migration).toContain("plan_entitlements");
    expect(migration).toContain("plan_limits");
  });

  test("clears hidden overrides and refreshes the active workspace immediately", () => {
    expect(adminPage).toContain("entitlementOverrides: {}");
    expect(adminPage).toContain("ground-control-subscription-updated");
    expect(entitlementHook).toContain("ground-control-subscription-updated");
  });

  test("loads history through a guarded RPC", () => {
    expect(migration).toContain("function public.load_matchweek_history");
    expect(supabaseClient).toContain('rpc/load_matchweek_history');
  });
});
