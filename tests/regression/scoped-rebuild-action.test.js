import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRebuildAction } from "../../src/lib/domain/rebuildAction.js";

describe("scoped scheduling rebuild action", () => {
  it("serialises rebuilds and allows a later rebuild after completion", async () => {
    let resolve;
    let attempts = 0;
    const rebuild = createRebuildAction(() => {
      attempts += 1;
      return attempts === 1 ? new Promise((done) => { resolve = done; }) : "rebuilt";
    });
    const first = rebuild();
    const second = await rebuild();
    expect(second).toEqual({ skipped: true });
    resolve("rebuilt");
    await expect(first).resolves.toBe("rebuilt");
    await expect(rebuild()).resolves.toBe("rebuilt");
  });

  it("exposes the same scoped rebuild control on every scheduling page", () => {
    const matchday = readFileSync("src/pages/MatchdayPage.jsx", "utf8");
    expect(matchday).toContain("onRebuild={runRebuild}");
    expect(readFileSync("src/components/Operations/shared/MatchweekCommandBar.jsx", "utf8")).toContain("Rebuild Schedule");
    for (const page of ["SaturdayPage.jsx", "SundayPage.jsx", "MidweekPage.jsx"]) {
      expect(readFileSync(`src/pages/${page}`, "utf8")).toContain("MatchdayPage");
    }
    const app = readFileSync("src/AppCore.jsx", "utf8");
    expect(app.match(/getFixtureIdentityCollisions\(applied\)/g)?.length).toBe(3);
  });
});
