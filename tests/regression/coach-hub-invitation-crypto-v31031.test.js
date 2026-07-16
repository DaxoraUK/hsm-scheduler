import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migrationPath = "supabase/migrations/202607160005_crypto_search_path_token_functions.sql";

describe("Ground Control v3.10.3.1 secure invitation token repair", () => {
  it("discovers the real pgcrypto extension schema", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("from pg_catalog.pg_extension extension_row");
    expect(migration).toContain("extension_row.extname = 'pgcrypto'");
    expect(migration).toContain("extension_row.extnamespace");
  });

  it("verifies both token functions before changing live RPC configuration", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("gen_random_bytes(integer)");
    expect(migration).toContain("digest(text,text)");
    expect(migration).toContain("pg_catalog.to_regprocedure");
  });

  it("repairs every affected public or private token function", () => {
    const migration = read(migrationPath);
    expect(migration).toContain("namespace.nspname in ('public', 'private')");
    expect(migration).toContain("procedure_row.prosrc ~ '(^|[^[:alnum:]_])gen_random_bytes");
    expect(migration).toContain("procedure_row.prosrc ~ '(^|[^[:alnum:]_])digest");
    expect(migration).toContain("alter function %s set search_path = pg_catalog, %I");
  });

  it("keeps the security-definer search path restricted", () => {
    const migration = read(migrationPath);
    expect(migration).not.toContain("search_path = public");
    expect(migration).not.toContain("search_path = pg_catalog, public");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });
});
