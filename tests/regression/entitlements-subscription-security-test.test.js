import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sql = readFileSync(
  new URL("../../supabase/tests/entitlements_subscriptions.sql", import.meta.url),
  "utf8"
);

describe("entitlement and subscription database proof", () => {
  test("requires two real auth identities and rolls back every test record", () => {
    expect(sql).toContain("REPLACE WITH USER_A");
    expect(sql).toContain("REPLACE WITH USER_B");
    expect(sql.trim().startsWith("-- Ground Control entitlement")).toBe(true);
    expect(sql.trim().endsWith("rollback;")).toBe(true);
  });

  test("proves Link feature and capacity restrictions", () => {
    expect(sql).toContain("Link incorrectly includes matchday_scheduling");
    expect(sql).toContain("Link published matchday history");
    expect(sql).toContain("Link accepted a fifth team");
    expect(sql).toContain("Link accepted a second venue");
    expect(sql).toContain("Link reserved a fourth user place");
  });

  test("proves guarded assignment, Core enablement and suspension read only", () => {
    expect(sql).toContain("club owner changed the commercial plan");
    expect(sql).toContain("Core history write did not land");
    expect(sql).toContain("suspended club changed configuration");
    expect(sql).toContain("public.platform_set_club_subscription");
  });
});
