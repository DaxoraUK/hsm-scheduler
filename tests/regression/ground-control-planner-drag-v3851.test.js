import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const plannerSource = readFileSync("src/components/Operations/shared/MatchdayTimelineCard.jsx", "utf8");

describe("Ground Control v3.8.5.1 whole-card planner dragging", () => {
  it("starts pointer dragging from the fixture card rather than only the grip handle", () => {
    expect(plannerSource).toContain("data-fixture-card");
    expect(plannerSource).toContain('onPointerDown={(event) => onPointerDrag(event, fixture, fixtureIndex)}');
    expect(plannerSource).toContain('title={`${fixture.title} vs ${fixture.opposition} · ${fixture.koTime}${canEdit ? " · Drag anywhere on this card to move" : ""}`}');
    expect(plannerSource).not.toContain('title="Drag to move"');
  });

  it("preserves click-to-open by requiring intentional pointer movement", () => {
    expect(plannerSource).toContain("Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 6");
    expect(plannerSource).toContain("suppressFixtureClickRef.current = true");
    expect(plannerSource).toContain("if (shouldSuppressFixtureClick?.())");
    expect(plannerSource).toContain("onFixtureSelect(fixture.source, fixtureIndex)");
  });

  it("supports mouse and touch pointer capture with clear movement feedback", () => {
    expect(plannerSource).toContain("event.currentTarget.setPointerCapture?.(event.pointerId)");
    expect(plannerSource).toContain('window.addEventListener("pointermove", onPointerMove, { passive: false })');
    expect(plannerSource).toContain("touch-none select-none");
    expect(plannerSource).toContain('document.body.style.cursor = "grabbing"');
    expect(plannerSource).toContain('cursor-grab active:cursor-grabbing');
  });

  it("shows an explicit locked schedule state instead of silently disabling movement", () => {
    expect(plannerSource).toContain("Schedule locked — unlock it to move fixtures");
    expect(plannerSource).toContain("Drag any fixture card or select it");
  });
});
