import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel build and browser branding", () => {
  it("ships the Ground Control favicon assets referenced by index.html", () => {
    const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

    expect(index).toContain("/ground-control-icon.svg");
    expect(index).not.toMatch(/vite\.svg/i);
    expect(existsSync(new URL("../../public/ground-control-icon.svg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../public/favicon-32x32.png", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../public/apple-touch-icon.png", import.meta.url))).toBe(true);
  });

  it("includes the operations intelligence engine imported by MatchdayPage", () => {
    expect(
      existsSync(
        new URL(
          "../../src/lib/engines/operationsIntelligenceEngine.js",
          import.meta.url,
        ),
      ),
    ).toBe(true);
  });
});
