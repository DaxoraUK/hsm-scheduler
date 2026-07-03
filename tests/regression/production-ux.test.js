import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  createSupportReference,
  getSessionRefreshDelay,
  getSyncBanner,
} from "../../src/lib/errors/recovery.js";

describe("production recovery and status model", () => {
  test("creates a support-safe diagnostic reference without user data", () => {
    const reference = createSupportReference({
      now: new Date("2026-07-03T12:34:56.000Z"),
      random: 0.12345,
    });

    expect(reference).toMatch(/^GC-20260703123456-[A-Z0-9]{5}$/);
    expect(reference).not.toContain("@");
  });

  test("refreshes sessions before expiry and never schedules faster than one second", () => {
    const now = Date.parse("2026-07-03T12:00:00.000Z");
    expect(getSessionRefreshDelay(
      { expires_at: Math.floor((now + 10 * 60_000) / 1000) },
      { now, bufferMs: 120_000, fallbackMs: 60_000 }
    )).toBe(60_000);

    expect(getSessionRefreshDelay(
      { expires_at: Math.floor((now + 30_000) / 1000) },
      { now, bufferMs: 120_000, fallbackMs: 60_000 }
    )).toBe(1_000);
  });

  test("offline status takes priority over a cloud error", () => {
    expect(getSyncBanner({ online: false, dbStatus: "error" })).toMatchObject({
      kind: "offline",
      retryable: false,
    });
  });

  test("cloud failures expose the real retryable message", () => {
    expect(getSyncBanner({
      online: true,
      dbStatus: "error",
      syncError: "Fixture history could not be saved",
    })).toMatchObject({
      kind: "error",
      message: "Fixture history could not be saved",
      retryable: true,
    });
  });

  test("session refresh has a non-destructive progress state", () => {
    expect(getSyncBanner({ online: true, dbStatus: "connected", sessionStatus: "refreshing" })).toMatchObject({
      kind: "refreshing",
    });
  });

  test("the application root is protected by the branded error boundary", () => {
    const source = readFileSync(new URL("../../src/main.jsx", import.meta.url), "utf8");
    expect(source).toContain("<AppErrorBoundary>");
    expect(source).toContain("<App />");
  });

  test("the product shell includes an accessible mobile navigation route", () => {
    const source = readFileSync(new URL("../../src/layout/ProductShell.jsx", import.meta.url), "utf8");
    expect(source).toContain('aria-label="Open navigation"');
    expect(source).toContain('aria-label="Primary navigation"');
    expect(source).toContain("lg:hidden");
  });
});
