import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608230004_intelligence_feedback.sql", "utf8");
const dbSource = readFileSync("src/lib/supabase.js", "utf8");

describe("governed shared intelligence feedback", () => {
  it("stores one response per operator, club, day and issue", () => {
    expect(migration).toContain("unique (club_id, actor_id, day_scope, issue_key)");
    expect(migration).toContain("response in ('useful','dismissed')");
  });

  it("allows members to read aggregates but only operational publishers to respond", () => {
    expect(migration).toContain("public.is_club_member(target_club_id)");
    expect(migration).toContain("public.can_publish_club_matchweek(target_club_id)");
  });

  it("records feedback and reset events in the club audit trail", () => {
    expect(migration).toContain("'intelligence.feedback.'||saved.response");
    expect(migration).toContain("'intelligence.feedback.cleared'");
  });

  it("exposes list, record and clear client operations", () => {
    expect(dbSource).toContain('rpc/list_intelligence_feedback');
    expect(dbSource).toContain('rpc/record_intelligence_feedback');
    expect(dbSource).toContain('rpc/clear_intelligence_feedback');
  });
});
