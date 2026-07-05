import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  new URL("../../src/pages/OperationsCentrePage.jsx", import.meta.url),
  "utf8"
);

describe("Operations Centre hero refinement", () => {
  test("uses an operational heading rather than marketing copy", () => {
    expect(source).toContain('title: "Weekend Operations"');
    expect(source).toContain('label="Operational readiness"');
    expect(source).not.toContain("Run the matchday from one control room.");
    expect(source).not.toContain("Fixtures, pitches, parking, officials, weather, people and incidents");
  });

  test("keeps scope and date controls outside the hero in a responsive toolbar", () => {
    expect(source).toContain('aria-label="Operations scope and dates"');
    expect(source).toContain("flex flex-wrap gap-1");
    expect(source).toContain('scope === MATCHDAY_SCOPES.MATCHWEEK ? "xl:grid-cols-2"');
  });

  test("removes the duplicate live weekend action and prevents clipped primary actions", () => {
    expect(source).not.toContain("Live weekend");
    expect(source).toContain("Current weekend");
    expect(source).toContain("whitespace-nowrap rounded-2xl bg-emerald-300");
  });

  test("links the hero action to the real priority queue", () => {
    expect(source).toContain('target: "priorityQueue"');
    expect(source).toContain('id="operations-centre-priority-actions"');
    expect(source).toContain("Review ${openActionCount} action");
  });
});
