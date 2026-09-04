import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync("src/pages/MatchdayPage.jsx", "utf8");

describe("retired shared matchday lock synchronisation", () => {
  it("does not poll a shared approval lock for scheduling", () => {
    expect(page).not.toContain("window.setInterval(refreshSharedLock, 20000)");
    expect(page).not.toContain('window.addEventListener("focus", refreshOnFocus)');
  });

  it("leaves scheduling editable to users holding the operate capability", () => {
    expect(page).not.toContain("setIsLocked(sharedLocked)");
    expect(page).not.toContain("Editing has been disabled");
    expect(page).not.toContain("remoteLockRevisionRef.current");
  });
});
