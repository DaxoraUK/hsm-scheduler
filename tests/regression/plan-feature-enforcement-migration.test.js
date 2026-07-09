import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607050001_plan_feature_enforcement.sql", import.meta.url),
  "utf8"
);

function planUpdateBlock(code) {
  const pattern = new RegExp(
    `update public\\.subscription_plans[\\s\\S]*?where code = '${code}';`
  );
  return migration.match(pattern)?.[0] || "";
}

describe("reviewed plan feature enforcement migration", () => {
  test("keeps advanced operations out of Link and Core", () => {
    const linkBlock = planUpdateBlock("link");
    const coreBlock = planUpdateBlock("core");

    expect(linkBlock).not.toBe("");
    expect(coreBlock).not.toBe("");
    expect(linkBlock).not.toContain("operations_advanced");
    expect(coreBlock).not.toContain("operations_advanced");
  });

  test("adds the reviewed Pro-only capability to Pro and Elite", () => {
    expect(planUpdateBlock("pro")).toContain("'operations_advanced','reports_advanced','analytics_advanced','multi_venue'");
    expect(planUpdateBlock("elite")).toContain("'priority_support','advanced_integrations','premium_support'");
  });

  test("retains existing club assignments and changes the plan source of truth only", () => {
    expect(migration).toContain("update public.subscription_plans");
    expect(migration).not.toContain("update public.club_subscriptions");
  });

  test("fails the migration if the expected plan rows or boundaries are missing", () => {
    expect(migration).toContain("missing plans");
    expect(migration).toContain("advanced operations leaked into Link/Core");
    expect(migration).toContain("Pro/Elite missing advanced operations");
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
