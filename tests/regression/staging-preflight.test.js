import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(path, "utf8");

describe("staging preflight and database evidence", () => {
  it("provides a staging preflight command", () => {
    const packageJson = JSON.parse(read("package.json"));
    expect(packageJson.scripts["preflight:staging"]).toBe("node scripts/staging-preflight.mjs");
  });

  it("requires an explicit staging Supabase project reference", () => {
    const example = read(".env.staging.example");
    const script = read("scripts/staging-preflight.mjs");
    expect(example).toContain("STAGING_SUPABASE_PROJECT_REF=");
    expect(script).toContain('"STAGING_SUPABASE_PROJECT_REF"');
    expect(script).toContain("Supabase project reference matches the staging URL");
  });

  it("keeps local readiness separate from remote proof", () => {
    const script = read("scripts/staging-preflight.mjs");
    expect(script).toContain('"ready_for_remote_verification"');
    expect(script).toContain("This preflight proves repository and configuration readiness only");
    expect(script).toContain("Run supabase/tests/rls_isolation.sql");
  });

  it("audits critical staging schema and forced RLS", () => {
    const audit = read("supabase/tests/staging_schema_audit.sql");
    expect(audit).toContain("platform_launch_gate_evidence");
    expect(audit).toContain("platform_pilot_sessions");
    expect(audit).toContain("relation.relforcerowsecurity");
    expect(audit).toContain("advanced operations leaked into Link/Core");
    expect(audit).toContain("'result', 'PASS'");
  });

  it("documents the staging to pilot execution sequence", () => {
    const checklist = read("docs/STAGING_EXECUTION_CHECKLIST.md");
    expect(checklist).toContain("Historical replay");
    expect(checklist).toContain("Shadow live");
    expect(checklist).toContain("Controlled use");
    expect(checklist).toContain("Create the isolation-test club");
  });
});
