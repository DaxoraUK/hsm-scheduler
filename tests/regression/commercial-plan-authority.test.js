import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  LIMIT_KEYS,
  PLAN_CATALOGUE,
  getEntitlementLimit,
  normaliseSubscriptionPayload,
} from "../../src/lib/subscriptions/entitlements.js";
import {
  evaluatePlanCompliance,
  formatPlanOverage,
} from "../../src/lib/subscriptions/planCompliance.js";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const weekPersistence = readFileSync("src/hooks/useWeekPersistence.js", "utf8");
const migration = readFileSync("supabase/migrations/202607120001_commercial_limits_and_server_authority.sql", "utf8");
const teamPanel = readFileSync("src/components/Settings/TeamSettingsPanel.jsx", "utf8");
const pitchPanel = readFileSync("src/components/Settings/PitchSettingsPanel.jsx", "utf8");

describe("commercial plan authority and secure persistence", () => {
  test("uses the tightened launch limits", () => {
    expect(PLAN_CATALOGUE.core.limits).toMatchObject({
      teams: 15,
      venues: 1,
      users: 5,
      pitches: 15,
      history_entries: 52,
      history_retention_days: 365,
    });
    expect(PLAN_CATALOGUE.pro.limits).toMatchObject({
      teams: 40,
      venues: 4,
      users: 15,
      pitches: 50,
      history_entries: 156,
      history_retention_days: 730,
    });
  });

  test("ignores stale database plan limits but honours deliberate club overrides", () => {
    const core = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      plan_limits: { teams: 20, pitches: 20 },
      limit_overrides: {},
    });
    expect(getEntitlementLimit(core, LIMIT_KEYS.TEAMS)).toBe(15);
    expect(getEntitlementLimit(core, LIMIT_KEYS.PITCHES)).toBe(15);

    const overridden = normaliseSubscriptionPayload({
      plan_code: "core",
      status: "active",
      access_state: "full",
      limit_overrides: { teams: 18 },
    });
    expect(getEntitlementLimit(overridden, LIMIT_KEYS.TEAMS)).toBe(18);
  });

  test("blocks operations when active resources exceed the package", () => {
    const core = normaliseSubscriptionPayload({ plan_code: "core", status: "active", access_state: "full" });
    const compliance = evaluatePlanCompliance(core, { teams: 26, pitches: 10, venues: 1 });
    expect(compliance.compliant).toBe(false);
    expect(compliance.operationalBlocked).toBe(true);
    expect(formatPlanOverage(compliance)).toContain("26 active teams");
  });

  test("authenticated workspace saves never fall back to browser-only business data", () => {
    expect(appCore).toContain("Changes were not saved");
    expect(appCore).toContain("restored the last server-approved data");
    expect(appCore).toContain("will not use browser-cached operational data");
    expect(appCore).not.toContain("Saved on this device only");
    expect(weekPersistence).toContain("No browser-only copy was created");
    expect(weekPersistence).not.toContain("Saved on this device only");
  });

  test("settings prevent silent import truncation and disable saving while over limit", () => {
    expect(teamPanel).toContain("Import blocked:");
    expect(teamPanel).toContain("disabled={overTeamLimit}");
    expect(pitchPanel).toContain("Import blocked:");
    expect(pitchPanel).toContain("disabled={overPitchLimit}");
  });

  test("database validates the complete replacement before deleting approved rows", () => {
    const checkIndex = migration.indexOf("record_count > maximum");
    const deleteIndex = migration.indexOf("delete from public.team_config");
    expect(checkIndex).toBeGreaterThan(0);
    expect(deleteIndex).toBeGreaterThan(checkIndex);
    expect(migration).toContain('"teams":15');
    expect(migration).toContain('"venues":4');
  });
});
