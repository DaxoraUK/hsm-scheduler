import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const shellSource = readFileSync(
  new URL("../../src/layout/ProductShell.jsx", import.meta.url),
  "utf8"
);
const stylesSource = readFileSync(
  new URL("../../src/index.css", import.meta.url),
  "utf8"
);

describe("compact responsive sidebar", () => {
  test("uses compact fixture chips instead of three tall counter cards", () => {
    expect(shellSource).toContain('["Sat", satCount]');
    expect(shellSource).toContain('["Sun", sunCount]');
    expect(shellSource).toContain('[["Mid", midweekCount]]');
    expect(shellSource).not.toContain('grid-cols-3');
  });

  test("hides the native scrollbar while preserving sidebar scrolling", () => {
    expect(shellSource).toContain("gc-sidebar-scroll");
    expect(stylesSource).toContain("scrollbar-width: none");
    expect(stylesSource).toContain(".gc-sidebar-scroll::-webkit-scrollbar");
    expect(stylesSource).toContain("display: none");
  });
});
