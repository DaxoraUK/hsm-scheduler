import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildDaxoraAccessContext, buildDaxoraHomeAlerts } from "../../src/pages/DaxoraHomePage.jsx";

describe("Daxora organisation and role context", () => {
  it("shows combined roles, assigned scope, plan and league context", () => {
    const context = buildDaxoraAccessContext({
      activeMembership: { role: "admin" },
      workspaceAccess: {
        role: "admin",
        roles: ["admin", "communications_officer", "team_manager"],
        roleAssignments: [
          { role: "communications_officer", scopeType: "club" },
          { role: "team_manager", scopeType: "team", scopeId: "team-1" },
        ],
        isReadOnly: false,
      },
      subscription: { planName: "Elite" },
      leagueMemberships: [{ leagueId: "league-1" }],
    });

    expect(context.roles.map((role) => role.label)).toEqual([
      "Club Administrator",
      "Communications Officer",
      "Team Manager",
    ]);
    expect(context.scopes).toEqual(["Club-wide", "Assigned team"]);
    expect(context.planLabel).toBe("Elite");
    expect(context.leagueCount).toBe(1);
  });

  it("keeps the organisation selector bound to the verified membership id", () => {
    const source = readFileSync("src/pages/DaxoraHomePage.jsx", "utf8");
    expect(source).toContain('value={activeClubId}');
    expect(source).toContain('onClubChange?.(event.target.value)');
    expect(source).toContain('workspaceAccess?.roleAssignments');
  });

  it("shows platform-only alerts without duplicating matchday intelligence", () => {
    const alerts = buildDaxoraHomeAlerts({
      products: [{ canOpen: true }],
      memberships: [{ clubId: "one" }, { clubId: "two" }],
      subscription: { planName: "Pro", isReadOnly: true, message: "Payment action is required." },
      leagueMemberships: [{ leagueId: "league-1" }],
    });
    expect(alerts.map((alert) => alert.id)).toEqual(["subscription", "organisations", "leagues"]);
    expect(alerts[0].detail).toBe("Payment action is required.");
  });
});
