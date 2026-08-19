import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  new URL("../../src/lib/supabase.js", import.meta.url),
  "utf8",
);

describe("Supabase client integrity", () => {
  test("requires environment configuration instead of falling back to the legacy project", () => {
    expect(source).not.toContain("DEFAULT_SUPA_URL");
    expect(source).not.toContain("keanexqompimqafhuiow");
    expect(source).toContain("export const SUPA_URL = ENV_SUPA_URL.replace");
  });

  test("keeps launch evidence and pilot workflow methods available", () => {
    expect(source).toContain("async platformGetPilotEvidence");
    expect(source).toContain("async platformRecordLaunchGateEvidence");
    expect(source).toContain("async platformUpsertPilotSession");
    expect(source).toContain("async platformUpsertPilotFinding");
  });

  test("loads matchweek history through the guarded RPC", () => {
    expect(source).toContain('rpc/load_matchweek_history');
  });
});
