import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const page = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");
const supabase = readFileSync("src/lib/supabase.js", "utf8");
const migration = readFileSync("supabase/migrations/202608230001_coach_hub_matchweek_communications.sql", "utf8");

describe("Coach Hub matchweek communications bridge", () => {
  test("publishes reviewed team messages and reports first-party engagement", () => {
    expect(page).toContain("Publish to Coach Hub");
    expect(page).toContain("Reads and acknowledgements");
    expect(page).toContain("DB.publishCoachHubMatchweekMessages");
    expect(page).toContain("DB.listCoachHubMatchweekDeliveryStatus");
    expect(supabase).toContain('rpc/publish_coach_hub_matchweek_messages');
    expect(supabase).toContain('rpc/list_coach_hub_matchweek_delivery_status');
  });

  test("enforces communication roles, team scope, idempotency and audit", () => {
    expect(migration).toContain("public.can_communicate_club(target_club_id)");
    expect(migration).toContain("'communications_officer'");
    expect(migration).toContain("No active Coach Hub assignment exists for team");
    expect(migration).toContain("on conflict (club_id, team_key, related_type, related_id)");
    expect(migration).toContain("communications.coach_hub.published");
    expect(migration).toContain("assignment.person_id = coach_person_id");
    expect(migration).not.toContain("delete from public.coach_hub_message_receipts");
  });
});
