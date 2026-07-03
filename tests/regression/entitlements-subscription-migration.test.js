import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/202607030004_entitlements_subscriptions.sql", import.meta.url),
  "utf8"
);

describe("entitlements and subscription migration", () => {
  test("seeds Link, Core, Pro and Elite without the retired Club Link name", () => {
    expect(migration).toContain("'link'");
    expect(migration).toContain("'Link'");
    expect(migration).toContain("'core'");
    expect(migration).toContain("'pro'");
    expect(migration).toContain("'elite'");
    expect(migration).not.toContain("Club Link");
  });

  test("protects existing pilot clubs and gives new clubs a Core trial", () => {
    expect(migration).toContain("'elite'");
    expect(migration).toContain("'internal'");
    expect(migration).toContain("existing pilot workspace");
    expect(migration).toContain("private.create_default_club_subscription");
    expect(migration).toContain("now() + interval '14 days'");
  });

  test("keeps subscription mutation behind a platform-staff RPC", () => {
    expect(migration).toContain("public.platform_set_club_subscription");
    expect(migration).toContain("public.platform_support_staff");
    expect(migration).toContain("staff.status = 'active'");
    expect(migration).toContain("subscription.assignment.update");
    expect(migration).not.toMatch(/create policy[\s\S]{0,180}club_subscriptions[\s\S]{0,180}for (insert|update|delete)/i);
  });

  test("server-side triggers enforce read-only status and plan limits", () => {
    expect(migration).toContain("private.enforce_subscription_write");
    expect(migration).toContain("The club subscription is read only");
    expect(migration).toContain("private.enforce_subscription_record_limit");
    expect(migration).toContain("private.enforce_membership_limit");
    expect(migration).toContain("private.enforce_venue_limit");
    expect(migration).toContain("private.prune_history_to_subscription_limits");
  });

  test("entitlements are explicit and provider-neutral", () => {
    expect(migration).toContain("entitlements text[]");
    expect(migration).toContain("entitlement_overrides jsonb");
    expect(migration).toContain("external_customer_id text");
    expect(migration).toContain("external_subscription_id text");
    expect(migration).toContain("This migration intentionally does not connect a payment provider");
  });

  test("migration is transactional", () => {
    expect(migration.trim().startsWith("-- Daxora Ground Control")).toBe(true);
    expect(migration.trim().endsWith("commit;")).toBe(true);
  });
});
