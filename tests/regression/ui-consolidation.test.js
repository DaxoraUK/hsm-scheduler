import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const sourceRoot = join(projectRoot, "src");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe("canonical UI architecture", () => {
  test("uses one UI component library", () => {
    expect(existsSync(join(sourceRoot, "components", "ui"))).toBe(false);
    expect(existsSync(join(sourceRoot, "ui", "ConfirmDialog.jsx"))).toBe(true);
  });

  test("does not import the removed compatibility UI path", () => {
    const offenders = sourceFiles(sourceRoot)
      .filter((path) => readFileSync(path, "utf8").includes("components/ui"))
      .map((path) => relative(projectRoot, path));

    expect(offenders).toEqual([]);
  });

  test("contains no empty source placeholders", () => {
    const emptyFiles = sourceFiles(sourceRoot)
      .filter((path) => statSync(path).size === 0)
      .map((path) => relative(projectRoot, path));

    expect(emptyFiles).toEqual([]);
  });
});
