import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release evidence runner", () => {
  const source = readFileSync("scripts/run-release-gates.mjs", "utf8");

  it("runs npm through npm-cli.js when npm launched the release command", () => {
    expect(source).toContain("process.env.npm_execpath");
    expect(source).toContain("process.execPath");
    expect(source).toContain("prefixArgs");
  });

  it("keeps a Windows command-shim fallback without relying on it by default", () => {
    expect(source).toContain('process.platform === "win32" ? "npm.cmd" : "npm"');
    expect(source).toContain("shell: process.platform === \"win32\"");
  });

  it("prints the exact failing command or repository check", () => {
    expect(source).toContain("Failed release checks:");
    expect(source).toContain("item.outputTail");
    expect(source).toContain("repository.filter");
  });
});
