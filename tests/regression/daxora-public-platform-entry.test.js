import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const app = readFileSync("src/AppCore.jsx", "utf8");
const landing = readFileSync("src/pages/DaxoraLandingPage.jsx", "utf8");
const login = readFileSync("src/components/LoginScreen.jsx", "utf8");
const splash = readFileSync("src/components/BrandSplash.jsx", "utf8");

describe("Daxora public platform entry", () => {
  test("places the public Daxora website before authentication", () => {
    expect(app).toContain('useState("landing")');
    expect(app).toContain("<DaxoraLandingPage");
    expect(app.indexOf('authView === "landing"')).toBeLessThan(app.indexOf("<LoginScreen"));
  });

  test("presents the product family before sending users to secure sign-in", () => {
    expect(landing).toContain("Ground Control");
    expect(landing).toContain("Coach Hub");
    expect(landing).toContain("League Manager");
    expect(landing).toContain("Daxora Pay");
    expect(landing).toContain("onSignIn");
  });

  test("uses neutral Daxora identity for authentication and loading", () => {
    expect(login).toContain("Daxora platform introduction");
    expect(login).toContain("Continue to Daxora");
    expect(splash).toContain('aria-label="Daxora"');
    expect(splash).toContain("GRASSROOTS SPORT, CONNECTED");
  });
});
