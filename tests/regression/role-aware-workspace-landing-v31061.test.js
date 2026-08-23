import { describe, expect, test } from "vitest";
import { createWorkspaceAccess } from "../../src/lib/security/permissions.js";
import {
  applySubscriptionAccess,
  normaliseSubscriptionPayload,
  PLAN_CODES,
} from "../../src/lib/subscriptions/entitlements.js";
import {
  canLandOnWorkspacePage,
  resolveWorkspaceLanding,
} from "../../src/lib/navigation/workspaceLanding.js";

function subscription(planCode, accessState = "full") {
  return normaliseSubscriptionPayload({ planCode, status: "active", accessState });
}

function access(role = "viewer", additionalRoles = [], plan = PLAN_CODES.ELITE, accessState = "full") {
  const base = createWorkspaceAccess({
    role,
    roleAssignments: additionalRoles.map((additionalRole) => ({
      role: additionalRole,
      scopeType: "club",
      status: "active",
    })),
  });
  const planAccess = subscription(plan, accessState);
  return { workspaceAccess: applySubscriptionAccess(base, planAccess), subscription: planAccess };
}

describe("role-aware workspace landing", () => {
  test("keeps owners and administrators in Mission Control", () => {
    expect(resolveWorkspaceLanding(access("owner", [], PLAN_CODES.ELITE))).toBe("dashboard");
    expect(resolveWorkspaceLanding(access("admin", [], PLAN_CODES.PRO))).toBe("dashboard");
  });

  test("returns operators to Operations and communications-only users to Communications", () => {
    const operator = access("scheduler", [], PLAN_CODES.PRO);
    const communicator = access("viewer", ["communications_officer"], PLAN_CODES.CORE);
    expect(resolveWorkspaceLanding(operator)).toBe("operations");
    expect(resolveWorkspaceLanding(communicator)).toBe("communications");
  });

  test("routes finance and leadership roles to entitled specialist workspaces", () => {
    const treasurer = access("viewer", ["treasurer"], PLAN_CODES.CORE);
    const chair = access("viewer", ["chair"], PLAN_CODES.ELITE);
    expect(resolveWorkspaceLanding(treasurer)).toBe("analytics");
    expect(resolveWorkspaceLanding(chair)).toBe("executive");
  });

  test("falls back safely when a role's preferred workspace is outside the plan", () => {
    const chair = access("viewer", ["chair"], PLAN_CODES.PRO);
    expect(resolveWorkspaceLanding(chair)).toBe("dashboard");
  });

  test("remembers only a page still allowed by both role and subscription", () => {
    const owner = access("owner", [], PLAN_CODES.ELITE);
    const viewer = access("viewer", [], PLAN_CODES.ELITE);
    expect(resolveWorkspaceLanding({ ...owner, rememberedPage: "settings" })).toBe("settings");
    expect(canLandOnWorkspacePage(viewer.subscription, "settings", viewer.workspaceAccess)).toBe(false);
    expect(resolveWorkspaceLanding({ ...viewer, rememberedPage: "communications" })).toBe("dashboard");
  });

  test("subscription read-only state removes write-workspace landing choices", () => {
    const communicator = access("viewer", ["communications_officer"], PLAN_CODES.CORE, "read_only");
    expect(communicator.workspaceAccess.canCommunicate).toBe(false);
    expect(resolveWorkspaceLanding(communicator)).toBe("dashboard");
  });
});
