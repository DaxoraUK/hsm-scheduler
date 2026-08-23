import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildDaxoraAppEntry,
  getDaxoraAppUrl,
  getDaxoraPublicUrl,
  getDaxoraSurface,
} from "../../src/lib/platform/platformUrls.js";

const projectRoot = path.resolve(".");
const app = fs.readFileSync(path.join(projectRoot, "src/App.jsx"), "utf8");
const appCore = fs.readFileSync(path.join(projectRoot, "src/AppCore.jsx"), "utf8");

describe("Daxora public and application boundary", () => {
  test("classifies canonical hosts without changing previews or local development", () => {
    expect(getDaxoraSurface({ hostname: "www.daxora.co.uk" })).toBe("public");
    expect(getDaxoraSurface({ hostname: "daxora.co.uk" })).toBe("public");
    expect(getDaxoraSurface({ hostname: "app.daxora.co.uk" })).toBe("app");
    expect(getDaxoraSurface({ hostname: "localhost" })).toBe("combined");
    expect(getDaxoraSurface({ hostname: "ground-control-preview.vercel.app" })).toBe("combined");
  });

  test("uses canonical production URLs and preserves invitation context", () => {
    expect(getDaxoraPublicUrl()).toBe("https://www.daxora.co.uk");
    expect(getDaxoraAppUrl()).toBe("https://app.daxora.co.uk");
    expect(buildDaxoraAppEntry("signin", {
      search: "?coach_invite=secure-token&source=email",
    })).toBe("https://app.daxora.co.uk/signin?coach_invite=secure-token&source=email");
  });

  test("keeps the public host out of authenticated application startup", () => {
    expect(app).toContain('getDaxoraSurface() === "public"');
    expect(app).toContain('buildDaxoraAppEntry("signin")');
    expect(appCore).toContain('getDaxoraSurface() === "app"');
    expect(appCore).toContain("buildDaxoraPublicEntry()");
  });
});
