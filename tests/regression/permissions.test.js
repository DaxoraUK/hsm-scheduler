import { describe, expect, test } from "vitest";
import {
  canAssignRole,
  createWorkspaceAccess,
  getRoleLabel,
  WORKSPACE_ROLES,
} from "../../src/lib/security/permissions.js";

describe("workspace permission model", () => {
  test("owner has full club administration and operational access", () => {
    const access = createWorkspaceAccess({ role: "owner", accessMode: "membership" });
    expect(access).toMatchObject({
      role: WORKSPACE_ROLES.OWNER,
      canOperate: true,
      canPublish: true,
      canManageSettings: true,
      canManageMembers: true,
      canViewAudit: true,
      canManageSupport: true,
      canTransferOwnership: true,
      isReadOnly: false,
    });
  });

  test("administrator cannot transfer ownership or grant support access", () => {
    const access = createWorkspaceAccess({ role: "admin" });
    expect(access.canOperate).toBe(true);
    expect(access.canManageSettings).toBe(true);
    expect(access.canManageMembers).toBe(true);
    expect(access.canTransferOwnership).toBe(false);
    expect(access.canManageSupport).toBe(false);
  });

  test("scheduler can operate and publish but cannot administer the club", () => {
    const access = createWorkspaceAccess({ role: "scheduler" });
    expect(access.canOperate).toBe(true);
    expect(access.canPublish).toBe(true);
    expect(access.canManageSettings).toBe(false);
    expect(access.canViewAudit).toBe(false);
  });

  test("viewer and support access are read-only", () => {
    const viewer = createWorkspaceAccess({ role: "viewer" });
    const support = createWorkspaceAccess({
      role: "support",
      accessMode: "support",
      supportSessionId: "session-1",
    });
    expect(viewer.isReadOnly).toBe(true);
    expect(viewer.canOperate).toBe(false);
    expect(support.isReadOnly).toBe(true);
    expect(support.isSupport).toBe(true);
    expect(support.canManageSettings).toBe(false);
    expect(getRoleLabel(support.role)).toBe("Daxora Support");
  });

  test("admins cannot assign administrator or owner roles", () => {
    expect(canAssignRole("admin", "viewer")).toBe(true);
    expect(canAssignRole("admin", "scheduler")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
    expect(canAssignRole("admin", "owner")).toBe(false);
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "owner")).toBe(false);
  });
});
