import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("club invitation crypto schema repair", () => {
  it("repairs token producers created by later migrations", () => {
    const migration = fs.readFileSync(path.resolve("supabase/migrations/202608250003_repair_all_invitation_crypto_paths.sql"), "utf8");
    expect(migration).toContain("pg_extension");
    expect(migration).toContain("gen_random_bytes(integer)");
    expect(migration).toContain("alter function %s set search_path = pg_catalog, %I");
  });
});
