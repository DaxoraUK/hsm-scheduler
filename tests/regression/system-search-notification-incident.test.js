import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSystemSearchIndex, searchSystem } from "../../src/lib/search/systemSearch.js";

describe("pilot system search, incidents and notifications", () => {
  it("searches permitted workspaces, settings and current fixture fields", () => {
    const index = buildSystemSearchIndex({ availablePages: ["dashboard", "operations", "settings", "communications"], canOpenSettings: true, fixturesByDay: { saturday: [{ id: "f1", homeTeam: "U13 Vulcans", awayTeam: "Bury Juniors", pitch: "Pitch 2", referee: "Sam Official", time: "10:15" }] } });
    expect(searchSystem(index, "Bury Juniors")[0].label).toContain("U13 Vulcans");
    expect(searchSystem(index, "official pool")[0].label).toBe("Officials pool settings");
    expect(searchSystem(index, "league manager")).toEqual([]);
  });

  it("never exposes settings results to a role without settings access", () => {
    const index = buildSystemSearchIndex({ availablePages: ["dashboard", "operations"], canOpenSettings: false });
    expect(searchSystem(index, "roles invitations")).toEqual([]);
    expect(searchSystem(index, "Bury Juniors")).toEqual([]);
  });

  it("provides global incident reporting and consistent mark-all controls", () => {
    const shell = readFileSync("src/layout/ProductShell.jsx", "utf8");
    const incident = readFileSync("src/components/system/PilotIncidentReporter.jsx", "utf8");
    const coach = readFileSync("src/pages/CoachHubPage.jsx", "utf8");
    const bell = readFileSync("src/components/system/DaxoraNotificationBell.jsx", "utf8");
    expect(shell).toContain("PilotIncidentReporter");
    expect(incident).toContain("DB.recordClientEvent");
    expect(incident).toContain("Passwords, tokens, emails, contacts, teams and fixture records are never included");
    expect(coach).toContain("Mark all as read");
    expect(bell).toContain("Mark all read");
  });
});
