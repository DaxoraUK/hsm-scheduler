/** @vitest-environment jsdom */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const sonnerToast = Object.assign(vi.fn(), {
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
  promise: vi.fn(),
  custom: vi.fn(),
});

vi.mock("sonner", () => ({ toast: sonnerToast, Toaster: () => null }));

const notifications = await import("../../src/lib/notifications/daxoraNotifications.js");

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(js|jsx)$/.test(name) ? [path] : [];
  });
}

const mainSource = readFileSync("src/main.jsx", "utf8");
const shellSource = readFileSync("src/layout/ProductShell.jsx", "utf8");
const confirmSource = readFileSync("src/components/system/DaxoraConfirmDialog.jsx", "utf8");
const promptSource = readFileSync("src/components/system/DaxoraPromptDialog.jsx", "utf8");
const bellSource = readFileSync("src/components/system/DaxoraNotificationBell.jsx", "utf8");
const toasterSource = readFileSync("src/components/system/DaxoraToaster.jsx", "utf8");
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));

beforeEach(() => {
  window.localStorage.clear();
  sonnerToast.mockClear();
  sonnerToast.success.mockClear();
  sonnerToast.error.mockClear();
  sonnerToast.warning.mockClear();
});

describe("Daxora v3.8.1 interaction and notification system", () => {
  test("replaces browser-owned alert, confirm and prompt calls across product source", () => {
    const offending = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      if (path.endsWith("DaxoraInteractionContext.jsx")) return false;
      return /window\.(?:alert|confirm|prompt)\s*\(/.test(source)
        || /(^|[^\w.])(?:alert|confirm|prompt)\s*\(/m.test(source);
    });
    expect(offending).toEqual([]);
    expect(confirmSource).toContain("Daxora Ground Control");
    expect(promptSource).toContain("Daxora guided response");
  });

  test("wires global branded dialogues, toasts and the persistent activity centre", () => {
    expect(mainSource).toContain("DaxoraInteractionProvider");
    expect(shellSource).toContain("DaxoraNotificationBell");
    expect(shellSource).toContain("DaxoraToaster");
    expect(bellSource).toContain("Daxora activity centre");
    expect(bellSource).toContain("Mark all read");
    expect(toasterSource).toContain("daxora-toast");
  });

  test("retains warning and error notifications after the transient toast closes", () => {
    notifications.setDaxoraNotificationContext({ workspaceType: "league", workspaceId: "league-1", workspaceName: "Pilot League" });
    notifications.toast.error("Schedule publication failed", { description: "Validation found two unresolved fixtures." });
    notifications.toast.success("Draft saved");

    let items = notifications.readDaxoraNotifications();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(expect.objectContaining({
      title: "Schedule publication failed",
      description: "Validation found two unresolved fixtures.",
      severity: "error",
      workspaceType: "league",
      workspaceId: "league-1",
      workspaceName: "Pilot League",
      readAt: null,
    }));

    notifications.markDaxoraNotificationRead(items[0].id);
    items = notifications.readDaxoraNotifications();
    expect(items[0].readAt).toBeTruthy();
    notifications.clearReadDaxoraNotifications();
    expect(notifications.readDaxoraNotifications()).toEqual([]);
  });

  test("ships installable Daxora PWA identity assets", () => {
    expect(manifest.name).toBe("Daxora Ground Control");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#07121f");
    expect(manifest.icons).toHaveLength(4);
    manifest.icons.forEach((icon) => expect(existsSync(`public${icon.src}`)).toBe(true));
    expect(readFileSync("index.html", "utf8")).toContain("manifest.webmanifest");
  });
});
