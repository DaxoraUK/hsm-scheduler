import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/202608230007_assert_matchday_approval.sql", "utf8");
const page = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");
const dispatch = readFileSync("server-api/communications/dispatch.js", "utf8");
const delivery = readFileSync("src/lib/communications/deliveryService.js", "utf8");

describe("all-channel matchday approval", () => {
  it("provides one secure assertion for the locked fixture version", () => {
    expect(migration).toContain("function public.assert_matchday_approval");
    expect(migration).toContain("approval.snapshot_hash is distinct from");
    expect(migration).toContain("public.is_club_member(target_club_id)");
  });
  it("checks browser copy and external-channel actions", () => {
    expect(page.match(/assertCurrentMatchdayApproval\(/g)?.length).toBeGreaterThanOrEqual(5);
    expect(page).toContain("approvalByDay");
    expect(page).toContain("buildMatchdaySnapshotHash(props.satFinal)");
  });
  it("rechecks approval server-side before provider delivery", () => {
    expect(delivery).toContain("matchdayApprovals");
    expect(dispatch).toContain('userRpc(token, "assert_matchday_approval"');
  });
});
