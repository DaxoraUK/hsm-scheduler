import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const appCore = readFileSync("src/AppCore.jsx", "utf8");
const saturdayPage = readFileSync("src/pages/SaturdayPage.jsx", "utf8");
const sundayPage = readFileSync("src/pages/SundayPage.jsx", "utf8");
const control = readFileSync("src/components/Operations/MatchdayDateControl.jsx", "utf8");

describe("Core matchweek date selection", () => {
  test("keeps Saturday and Sunday date selection inside the Core day workspaces", () => {
    expect(saturdayPage).toContain("<MatchdayDateControl");
    expect(saturdayPage).toContain("onDateChange={props.setSatDate}");
    expect(sundayPage).toContain("<MatchdayDateControl");
    expect(sundayPage).toContain("onDateChange={props.setSunDate}");
  });

  test("passes the paired weekend labels and current-weekend action from AppCore", () => {
    expect(appCore).toContain("sunDateLabel={sunDateLabel}");
    expect(appCore).toContain("satDateLabel={satDateLabel}");
    expect(appCore.match(/useCurrentMatchWeekend=\{useCurrentMatchWeekend\}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  test("date changes explain that the existing built weekend is cleared", () => {
    expect(control).toContain("Changing the date clears the built weekend schedule");
    expect(control).toContain('aria-label={`Select ${day} fixture date`}');
    expect(control).toContain("Current weekend");
  });
});
