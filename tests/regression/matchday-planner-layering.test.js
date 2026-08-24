import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plannerSource = readFileSync(
  "src/components/Operations/shared/MatchdayTimelineCard.jsx",
  "utf8",
);

describe("Matchday planner layering", () => {
  it("contains the sticky timeline beneath the global navigation", () => {
    expect(plannerSource).toContain(
      'className="isolate max-h-[720px] overflow-auto overscroll-contain bg-slate-50/70"',
    );
    expect(plannerSource).toContain(
      'className="sticky top-0 z-20 grid border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"',
    );
    expect(plannerSource).not.toContain(
      'className="sticky top-0 z-40 grid border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur"',
    );
  });
});
