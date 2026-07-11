import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { createNavigationController } from "../../src/lib/navigation/navigationService.js";
import { NAV_TARGETS, getNavigationTarget } from "../../src/lib/navigation/navigationTargets.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const shellSource = source("../../src/layout/ProductShell.jsx");
const dayTabsSource = source("../../src/components/Operations/DayTabs.jsx");
const overviewSource = source("../../src/pages/OperationsCentrePage.jsx");

describe("UX and information architecture phase 1", () => {
  test("opens the sidebar Operations destination at the cross-day overview", () => {
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

  test("does not make the sidebar Operations link inherit a dashboard day scope", () => {
    expect(shellSource).toContain('nav.goTo(target, { scroll: false });');
    expect(shellSource).not.toContain("getDayTabFromScope(matchdayScope)");
  });

  test("uses one clear overview tab and one clearly named matchweek timeline", () => {
    expect(dayTabsSource).toContain('["centre", "Overview", "Cross-day readiness and priority actions"]');
    expect(dayTabsSource).toContain('["timeline", "Matchweek Timeline", "Combined operational sequence"]');
    expect(dayTabsSource).not.toContain('"Operations Centre"');
  });

  test("keeps day-specific navigation in the main Operations tabs rather than duplicating it inside the overview", () => {
    expect(overviewSource).toContain("midweekEnabled ? MATCHDAY_SCOPES.MATCHWEEK : MATCHDAY_SCOPES.WEEKEND");
    expect(overviewSource).toContain('[[MATCHDAY_SCOPES.MATCHWEEK, "Matchweek"]]');
    expect(overviewSource).toContain('[MATCHDAY_SCOPES.WEEKEND, "Weekend"]');
    expect(overviewSource).not.toContain('[[MATCHDAY_SCOPES.MIDWEEK, "Midweek"]]');
    expect(overviewSource).not.toContain('[MATCHDAY_SCOPES.SATURDAY, "Saturday"]');
    expect(overviewSource).not.toContain('[MATCHDAY_SCOPES.SUNDAY, "Sunday"]');
  });
});
