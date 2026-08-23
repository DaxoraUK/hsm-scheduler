import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = path.resolve(".");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("src/App.jsx");
const landing = read("src/pages/DaxoraLandingPage.jsx");
const publicPages = read("src/pages/DaxoraPublicPage.jsx");
const metadata = read("src/lib/platform/publicMetadata.js");

describe("Daxora public launch layer", () => {
  test("uses neutral Daxora metadata before client rendering", () => {
    expect(html).toContain('content="Daxora"');
    expect(html).toContain("Daxora | Connected operations for grassroots sport");
    expect(html).toContain('rel="canonical" href="https://www.daxora.co.uk/"');
    expect(html).not.toContain("<title>Ground Control</title>");
  });

  test("publishes durable commercial and trust routes", () => {
    for (const page of ["pricing", "security", "privacy", "cookies", "terms", "contact"]) {
      expect(app).toContain(`"${page}"`);
      expect(landing).toContain(`href="/${page}"`);
    }
    expect(publicPages).toContain("Daxora Pay remains in development");
    expect(publicPages).toContain("This page is a summary, not the contract");
    expect(publicPages).toContain("support@daxora.co.uk");
  });

  test("publishes an accurate essential-storage cookie position", () => {
    expect(publicPages).toContain("does not currently use advertising or behavioural-marketing trackers");
    expect(publicPages).toContain("Secure sign-in");
    expect(publicPages).toContain("Workspace preferences");
    expect(publicPages).toContain("providing an appropriate choice where consent is required");
  });

  test("keeps authenticated application pages out of search indexes", () => {
    expect(metadata).toContain('"noindex,nofollow"');
    expect(app).toContain("applyAppMetadata()");
  });
});
