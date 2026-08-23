import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const panel = readFileSync("src/components/Settings/CoachHubSettingsPanel.jsx", "utf8");
const client = readFileSync("src/lib/supabase.js", "utf8");
const migration = readFileSync("supabase/migrations/202608230009_reissue_coach_hub_access.sql", "utf8");
const cryptoRepair = readFileSync("supabase/migrations/202608230010_coach_invitation_crypto_schema.sql", "utf8");

describe("Coach Hub access reissue", () => {
  test("offers a confirmed recovery action for accepted access", () => {
    expect(panel).toContain("Reissue access");
    expect(panel).toContain("currently linked login will immediately lose Coach Hub access");
    expect(panel).toContain("DB.reissueCoachHubAccess");
  });

  test("revokes historical recovery paths before issuing a fresh token", () => {
    expect(client).toContain('rpc/reissue_coach_hub_access');
    expect(migration).toContain("status in ('pending','delivery_failed','accepted')");
    expect(migration).toContain("set user_id=null");
    expect(migration).toContain("coach_hub.access.reissued");
  });

  test("schema-qualifies Supabase cryptographic functions", () => {
    expect(cryptoRepair).toContain("extensions.gen_random_bytes(32)");
    expect(cryptoRepair).toContain("extensions.digest(raw_token,'sha256')");
    expect(cryptoRepair).toContain("public.create_coach_hub_invitation");
    expect(cryptoRepair).toContain("public.reissue_coach_hub_access");
  });
});
