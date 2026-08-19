import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { createNavigationController } from "../../src/lib/navigation/navigationService.js";
import {
  NAV_TARGETS,
  getNavigationTarget,
} from "../../src/lib/navigation/navigationTargets.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const shellSource = source("../../src/layout/ProductShell.jsx");
const dayTabsSource = source("../../src/components/Operations/DayTabs.jsx");
const overviewSource = source("../../src/pages/OperationsCentrePage.jsx");

describe("UX and information architecture phase 1", () => {
  test("keeps the canonical Operations target at the cross-day overview", () => {
    expect(getNavigationTarget(NAV_TARGETS.OPERATIONS)).toMatchObject({
      page: "operations",
      dayTab: "centre",
      label: "Operations Overview",
    });

    const setMainPage = vi.fn();
    const setDayTab = vi.fn();
    const setNavigationTarget = vi.fn();
    const navigation = createNavigationController({
      setMainPage,
      setDayTab,
      setNavigationTarget,
    });

    navigation.goToOperations();
    expect(setMainPage).toHaveBeenCalledWith("operations");
    expect(setDayTab).toHaveBeenCalledWith("centre");
    expect(setNavigationTarget).toHaveBeenCalledWith(null);
  });

  test("falls back safely when requestAnimationFrame is unavailable", () => {
    const navigationService = source("../../src/lib/navigation/navigationService.js");
    expect(navigationService).toContain(
      'typeof window.requestAnimationFrame === "function"',
    );
    expect(navigationService).toContain(
      "window.setTimeout(reset, 0)",
    );
  });

  test("makes the sidebar Operations landing package-aware rather than inheriting dashboard scope", () => {
    expect(shellSource).toContain("advancedOperationsEnabled");
    expect(shellSource).toContain(
      'advancedOperationsEnabled ? "centre" : "saturday"',
    );
    expect(shellSource).not.toContain("getDayTabFromScope(matchdayScope)");
  });

  test("shows Overview and Matchweek Timeline only with advanced operations", () => {
    expect(dayTabsSource).toContain("advancedOperationsEnabled");
    expect(dayTabsSource).toContain(
      '["centre", "Overview", "Cross-day readiness and priority actions"]',
    );
    expect(dayTabsSource).toContain(
      '["timeline", "Matchweek Timeline", "Combined operational sequence"]',
    );
    expect(dayTabsSource).not.toContain('"Operations Centre"');
  });

  test("keeps customer navigation and primary tabs free of test terminology", () => {
    [shellSource, dayTabsSource].forEach((content) => {
      expect(content).not.toMatch(/label:\s*["'][^"']*test/i);
      expect(content).not.toMatch(/\[["'][^"']+["'],\s*["'][^"']*test/i);
    });
  });

  test("keeps day-specific navigation in the main tabs rather than duplicating it inside Overview", () => {
    expect(overviewSource).toContain(
      "midweekEnabled ? MATCHDAY_SCOPES.MATCHWEEK : MATCHDAY_SCOPES.WEEKEND",
    );
    expect(overviewSource).toContain(
      '[[MATCHDAY_SCOPES.MATCHWEEK, "Matchweek"]]',
    );
    expect(overviewSource).toContain('[MATCHDAY_SCOPES.WEEKEND, "Weekend"]');
    expect(overviewSource).not.toContain(
      '[[MATCHDAY_SCOPES.MIDWEEK, "Midweek"]]',
    );
    expect(overviewSource).not.toContain(
      '[MATCHDAY_SCOPES.SATURDAY, "Saturday"]',
    );
    expect(overviewSource).not.toContain('[MATCHDAY_SCOPES.SUNDAY, "Sunday"]');
  });
});
