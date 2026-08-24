import { describe, expect, it, vi } from "vitest";
import { installStaleDeploymentRecovery, isStaleDeploymentChunkError, recoverStaleDeploymentChunk } from "../../src/lib/errors/staleDeploymentRecovery.js";

function fakeWindow() {
  const values = new Map();
  return {
    sessionStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    location: { reload: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

describe("stale deployment recovery", () => {
  it("recognises missing Vite lazy chunks", () => {
    expect(isStaleDeploymentChunkError(new TypeError("Failed to fetch dynamically imported module: https://app.daxora.co.uk/assets/OperationsCentrePage-old.js"))).toBe(true);
    expect(isStaleDeploymentChunkError(new Error("Database request failed"))).toBe(false);
  });

  it("reloads once for each obsolete asset and never loops", () => {
    const browser = fakeWindow();
    const error = new TypeError("Failed to fetch dynamically imported module: https://app.daxora.co.uk/assets/OperationsCentrePage-old.js");
    expect(recoverStaleDeploymentChunk(error, browser)).toBe(true);
    expect(recoverStaleDeploymentChunk(error, browser)).toBe(false);
    expect(browser.location.reload).toHaveBeenCalledTimes(1);
  });

  it("intercepts Vite preload failures before React reaches recovery mode", () => {
    const browser = fakeWindow();
    installStaleDeploymentRecovery(browser);
    expect(browser.addEventListener).toHaveBeenCalledWith("vite:preloadError", expect.any(Function));
  });
});
