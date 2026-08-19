import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const drawerSource = readFileSync(
  new URL("../../src/components/Operations/shared/FixtureDrawer.jsx", import.meta.url),
  "utf8"
);

describe("manual parking-risk fixture changes", () => {
  test("keeps hard operational conflicts blocked but allows an explicit parking override", () => {
    expect(drawerSource).toContain('"parking_capacity"');
    expect(drawerSource).toContain('"parking_concurrency"');
    expect(drawerSource).toContain("canOverride");
    expect(drawerSource).toContain("applyPendingOverride");
    expect(drawerSource).toContain("Apply anyway");
  });

  test("makes it clear that the selected change is pending rather than already saved", () => {
    expect(drawerSource).toContain("This change has not been applied yet");
    expect(drawerSource).toContain("Cancel change");
    expect(drawerSource).toContain("Fixture change applied with a parking warning");
  });
});
