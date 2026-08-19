import fs from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseSource = fs.readFileSync("src/lib/supabase.js", "utf8");
const accessSource = fs.readFileSync("src/hooks/useClubAccess.js", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/202607160007_coach_hub_pending_invitation_recovery.sql",
  "utf8",
);

describe("Ground Control v3.10.3.3 Coach Hub access recovery", () => {
  it("exposes the verified-email recovery RPC", () => {
    expect(supabaseSource).toMatch(/claimPendingCoachHubInvitations\(\)/);
    expect(supabaseSource).toMatch(/rpc\/claim_my_pending_coach_hub_invitations/);
  });

  it("attempts recovery before denying the coach", () => {
    const recoveryIndex = accessSource.indexOf("DB.claimPendingCoachHubInvitations()");
    const deniedIndex = accessSource.indexOf("if (!nextMemberships.length) {", recoveryIndex + 1);
    expect(recoveryIndex).toBeGreaterThan(0);
    expect(deniedIndex).toBeGreaterThan(recoveryIndex);
    expect(accessSource).toMatch(/recoveredCount > 0/);
    expect(accessSource).toMatch(/nextMemberships = await DB\.listMemberships\(\)/);
  });

  it("defers explicit invitation errors until recovery has run", () => {
    expect(accessSource).toMatch(/let coachInviteError = null/);
    expect(accessSource).toMatch(/if \(!nextMemberships\.length && coachInviteError\) throw coachInviteError/);
  });

  it("requires an authenticated exact email match and live invitation", () => {
    expect(migration).toMatch(/actor_id uuid := auth\.uid\(\)/);
    expect(migration).toMatch(/lower\(trim\(invitation\.email\)\) = actor_email/);
    expect(migration).toMatch(/invitation\.status in \('pending', 'delivery_failed'\)/);
    expect(migration).toMatch(/invitation\.expires_at > now\(\)/);
  });

  it("cannot replace a person linked to another user", () => {
    expect(migration).toMatch(/person\.user_id is null or person\.user_id = actor_id/);
    expect(migration).toMatch(/user_id is null or user_id = actor_id/);
  });

  it("requires an active assignment and enabled Annual Planner", () => {
    expect(migration).toMatch(/assignment\.status = 'active'/);
    expect(migration).toMatch(/private\.club_has_entitlement\(invitation\.club_id, 'annual_planner'\)/);
  });

  it("accepts and audits recovered invitations", () => {
    expect(migration).toMatch(/status = 'accepted'/);
    expect(migration).toMatch(/accepted_by = actor_id/);
    expect(migration).toMatch(/coach_hub\.invitation\.recovered_by_verified_email/);
  });
});
