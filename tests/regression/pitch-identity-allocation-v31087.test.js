import { describe, expect, test } from "vitest";
import { createNextPitchIdentity } from "../../src/lib/pitches.js";

describe("new pitch identity allocation", () => {
  test("uses the first unused whole-pitch number instead of the array length", () => {
    const pitches = [
      { id: "3v3", label: "3v3 Area" },
      { id: "AST", label: "Astro" },
      { id: "P1", label: "Pitch 1" },
      { id: "P1a", label: "Pitch 1a" },
      { id: "P2", label: "Pitch 2" },
      { id: "P2a", label: "Pitch 2a" },
      { id: "P3", label: "Pitch 3" },
      { id: "P3a", label: "Pitch 3a" },
      { id: "P4", label: "Pitch 4" },
      { id: "P4a", label: "Pitch 4a" },
      { id: "P5", label: "Pitch 5" },
    ];

    expect(createNextPitchIdentity(pitches)).toEqual({ id: "P6", label: "Pitch 6" });
  });

  test("checks both identifiers and labels case-insensitively", () => {
    expect(createNextPitchIdentity([
      { id: "p1", label: "Main" },
      { id: "custom", label: "PITCH 2" },
    ])).toEqual({ id: "P3", label: "Pitch 3" });
  });
});
