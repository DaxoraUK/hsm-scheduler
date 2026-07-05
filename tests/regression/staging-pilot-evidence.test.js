import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  createLaunchEvidenceDraft,
  createPilotFindingDraft,
  createPilotSessionDraft,
  normalisePilotEvidencePayload,
  validateLaunchEvidenceDraft,
  validatePilotFindingDraft,
  validatePilotSessionDraft,
} from "../../src/lib/platform/pilotEvidenceModel.js";

const migrationPath = path.resolve("supabase/migrations/202607050011_staging_pilot_evidence.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const repository = fs.readFileSync(path.resolve("src/lib/supabase.js"), "utf8");
const component = fs.readFileSync(path.resolve("src/components/PlatformPilotEvidencePanel.jsx"), "utf8");
const workflow = fs.readFileSync(path.resolve(".github/workflows/release-gates.yml"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));

describe("staging and pilot evidence migration", () => {
  test("creates protected append-only launch and pilot evidence tables", () => {
    for (const table of ["platform_launch_gate_evidence", "platform_pilot_sessions", "platform_pilot_findings"]) {
      expect(migration).toContain(`create table if not exists public.${table}`);
      expect(migration).toContain(`alter table public.${table} force row level security`);
      expect(migration).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
    }
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)\s+on\s+public\.platform_launch_gate_evidence/i);
  });

  test("requires passing structured evidence before a launch gate can be marked ready", () => {
    expect(migration).toContain("Record current passing evidence before marking this gate Ready");
    expect(migration).toContain("result in ('pass', 'fail')");
    expect(migration).toContain("latest_definitive_result is distinct from 'pass'");
  });

  test("adds the four controlled pilot cycles and HSM evidence gates", () => {
    for (const cycle of ["historical_replay", "shadow_live", "controlled_use", "signoff"]) {
      expect(migration).toContain(`'${cycle}'`);
    }
    for (const gate of ["hsm_historical_replay", "hsm_shadow_live", "hsm_controlled_use", "hsm_pilot_signoff"]) {
      expect(migration).toContain(`'${gate}'`);
    }
  });

  test("uses restricted RPCs for evidence, sessions and findings", () => {
    for (const rpc of [
      "rpc/platform_get_pilot_evidence",
      "rpc/platform_record_launch_gate_evidence",
      "rpc/platform_upsert_pilot_session",
      "rpc/platform_upsert_pilot_finding",
    ]) {
      expect(repository).toContain(rpc);
    }
    expect(migration).toContain("perform private.require_platform_staff('admin')");
  });
});

describe("release evidence automation", () => {
  test("adds release evidence and staging smoke commands", () => {
    expect(packageJson.scripts["release:evidence"]).toContain("run-release-gates.mjs");
    expect(packageJson.scripts["smoke:staging"]).toContain("staging-smoke.mjs");
    expect(fs.existsSync(path.resolve(".env.staging.example"))).toBe(true);
    expect(fs.existsSync(path.resolve("vercel.json"))).toBe(true);
  });

  test("runs the evidence generator in CI and uploads the result", () => {
    expect(workflow).toContain("npm run release:evidence");
    expect(workflow).toContain("actions/upload-artifact@v4");
    expect(workflow).toContain(".release-evidence/");
  });

  test("presents explicit staging checks and factual pilot evidence fields", () => {
    expect(component).toContain("Staging environment self-check");
    expect(component).toContain("Record structured launch evidence");
    expect(component).toContain("Controlled pilot evidence");
    expect(component).toContain("Invalid recommendations");
    expect(component).toContain("Missed warnings");
    expect(component).toContain("Time saved (minutes)");
  });
});

describe("pilot evidence model", () => {
  test("normalises evidence, pilot sessions and findings", () => {
    const payload = normalisePilotEvidencePayload({
      launch_evidence: [{ id: "e1", gate_code: "staging_environment", result: "pass", summary: "Staging passed", observed_at: "2026-07-05T12:00:00Z" }],
      sessions: [{ id: "s1", club_id: "c1", cycle: "historical_replay", status: "completed", outcome: "pass", fixture_count: 12 }],
      findings: [{ id: "f1", session_id: "s1", finding_type: "usability", severity: "medium", status: "open", title: "Button unclear", description: "Operator hesitated before publishing." }],
    });
    expect(payload.launchEvidence[0].gateCode).toBe("staging_environment");
    expect(payload.sessions[0].fixtureCount).toBe(12);
    expect(payload.findings[0].findingType).toBe("usability");
  });

  test("validates launch evidence, sessions and findings", () => {
    const evidence = createLaunchEvidenceDraft({ gateCode: "staging_environment", environment: "staging", release: "release-1" });
    evidence.summary = "Five browser-visible staging checks passed.";
    expect(validateLaunchEvidenceDraft(evidence)).toEqual([]);
    expect(validateLaunchEvidenceDraft({ ...evidence, artifactUrl: "http://insecure.test" })[0]).toContain("HTTPS");

    const session = createPilotSessionDraft("club-1");
    session.status = "completed";
    expect(validatePilotSessionDraft(session)[0]).toContain("outcome");
    session.outcome = "pass";
    expect(validatePilotSessionDraft(session)).toEqual([]);

    const finding = createPilotFindingDraft("session-1");
    finding.title = "Closed pitch";
    finding.description = "The closed pitch remained selectable in the manual drawer.";
    expect(validatePilotFindingDraft(finding)).toEqual([]);
  });
});
