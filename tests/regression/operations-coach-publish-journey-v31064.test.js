import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const app = readFileSync("src/AppCore.jsx", "utf8");
const command = readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8");
const communications = readFileSync("src/pages/CommunicationsPage.jsx", "utf8");
const migration = readFileSync("supabase/migrations/202608230003_matchweek_publish_authority.sql", "utf8");

describe("approved matchweek to Coach Hub journey", () => {
  test("carries the selected matchday into an automatically opened ready queue", () => {
    expect(app).toContain('source: "matchday"');
    expect(app).toContain("autoOpen: true");
    expect(communications).toContain('source: "approved_matchday"');
    expect(communications).toContain("openQueueWithRows(readyRows");
  });

  test("requires a lock before the publish handoff while keeping advisories visible", () => {
    expect(command).toContain('if (isLocked) return "publish"');
    expect(command).toContain("blockingCount = unresolvedCount");
    expect(command).toContain("warningCount = refWarnings + closedPitches.length");
    expect(command).toContain("Lock approved schedule");
    expect(command).toContain("Review and publish");
  });

  test("enforces publisher authority in both interface and database", () => {
    expect(communications).toContain("const canPublish = Boolean(props.workspaceAccess?.canPublish");
    expect(communications).toContain("Publisher access required");
    expect(migration).toContain("can_publish_club_matchweek");
    expect(migration).toContain("Matchweek publisher access required");
    expect(migration).not.toContain("communications_officer");
  });
});
