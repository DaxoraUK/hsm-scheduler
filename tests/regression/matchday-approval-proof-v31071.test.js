import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildMatchdaySnapshotHash } from "../../src/lib/operations/matchdayApproval.js";

const migration = readFileSync("supabase/migrations/202608230006_matchday_lock_approval_proof.sql", "utf8");
const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("matchday approval proof", () => {
  it("produces stable hashes and detects operational changes", () => {
    const fixture = { id: "1", team: "U12", opposition: "Town", time: "10:00", pitch: "P1" };
    expect(buildMatchdaySnapshotHash([fixture])).toBe(buildMatchdaySnapshotHash([{ ...fixture }]));
    expect(buildMatchdaySnapshotHash([fixture])).not.toBe(buildMatchdaySnapshotHash([{ ...fixture, pitch: "P2" }]));
  });

  it("binds Coach Hub publication to the locked version in the database", () => {
    expect(migration).toContain("approval.snapshot_hash is distinct from");
    expect(migration).toContain("The fixture plan changed after approval");
    expect(migration).toContain("locked_by_label");
  });

  it("shows approval provenance and blocks stale publication", () => {
    expect(page).toContain("lockInfo.locked_by_label");
    expect(page).toContain("approvalStale");
  });
});
