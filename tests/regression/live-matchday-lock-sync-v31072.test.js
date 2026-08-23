import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("live shared matchday lock synchronisation", () => {
  it("refreshes the shared approval while the operator remains on the page", () => {
    expect(page).toContain("window.setInterval(refreshSharedLock, 20000)");
    expect(page).toContain('window.addEventListener("focus", refreshOnFocus)');
    expect(page).toContain('window.removeEventListener("focus", refreshOnFocus)');
  });

  it("immediately applies remote lock changes and tells the operator", () => {
    expect(page).toContain("setIsLocked(sharedLocked)");
    expect(page).toContain("Editing has been disabled");
    expect(page).toContain("remoteLockRevisionRef.current");
  });
});
