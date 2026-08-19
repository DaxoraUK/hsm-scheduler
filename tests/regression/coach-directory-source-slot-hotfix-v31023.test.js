import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Ground Control v3.10.2.3 coach-directory source-slot hotfix", () => {
  it("allows directory-managed team assignments", () => {
    const migration = read("supabase/migrations/202607160003_coach_assignment_source_slot_and_contacts_rpc.sql");
    expect(migration).toContain("drop constraint if exists coach_hub_team_assignments_source_slot_check");
    expect(migration).toContain("'coach','assistant','manual','directory'");
  });

  it("publishes an explicitly granted v2 contact-list RPC and reloads PostgREST", () => {
    const migration = read("supabase/migrations/202607160003_coach_assignment_source_slot_and_contacts_rpc.sql");
    expect(migration).toContain("function public.list_team_contacts_v2(target_club_id uuid)");
    expect(migration).toContain("grant execute on function public.list_team_contacts_v2(uuid) to authenticated");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("uses the stable v2 RPC with a legacy rollout fallback", () => {
    const source = read("src/lib/supabase.js");
    expect(source).toContain('"rpc/list_team_contacts_v2"');
    expect(source).toContain('"rpc/list_team_contacts"');
    expect(source).toContain('String(error.code || "") === "PGRST202"');
  });
});
