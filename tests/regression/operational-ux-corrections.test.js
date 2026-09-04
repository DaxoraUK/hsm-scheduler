// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, test } from "vitest";
import {
  getMatchdayLockKey,
  readMatchdayLock,
  writeMatchdayLock,
} from "../../src/lib/operations/matchdayLock.js";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const appCoreSource = source("../../src/AppCore.jsx");
const shellSource = source("../../src/layout/ProductShell.jsx");
const dashboardSource = source("../../src/pages/DashboardPage.jsx");
const matchdaySource = source("../../src/pages/MatchdayPage.jsx");
const actionBarSource = source(
  "../../src/components/Operations/shared/MatchdayActionBar.jsx",
);
const optimiserSource = source(
  "../../src/components/Operations/shared/DayOptimiserCard.jsx",
);
const timelineSource = source(
  "../../src/components/Operations/shared/MatchdayTimelineCard.jsx",
);
const reportsSource = source("../../src/pages/ReportsPage.jsx");
const unresolvedSource = source(
  "../../src/components/Operations/shared/MatchdayUnresolvedCard.jsx",
);
const confirmDialogSource = source("../../src/ui/ConfirmDialog.jsx");

describe("combined operational UX corrections", () => {
  beforeEach(() => window.localStorage.clear());

  test("uses one discreet sidebar scroll area instead of a visible nested navigation scrollbar", () => {
    expect(shellSource).toContain("gc-sidebar-scroll");
    expect(shellSource).toContain("h-screen");
    expect(shellSource).toContain("overflow-y-auto");
    expect(shellSource).not.toContain("min-h-0 space-y-1 overflow-y-auto pr-1");
    expect(shellSource.indexOf("{workspaceCard}</div>")).toBeLessThan(
      shellSource.lastIndexOf("<NavigationItems"),
    );
  });

  test("builds selected matchdays from Mission Control and opens the plan-appropriate Operations workspace", () => {
    expect(dashboardSource).toContain("Build Matchweek");
    expect(dashboardSource).toContain("buildSelectedMatchweek");
    expect(dashboardSource).toContain("await Promise.resolve(item.run())");
    expect(dashboardSource).toContain('advancedOperationsEnabled ? "centre"');
    expect(dashboardSource).toContain("operationsLandingDay");
    expect(dashboardSource).toContain("Open Operations");
  });

  test("persists a browser-level lock by club, day and date", () => {
    const identity = { clubId: "hsm", day: "saturday", date: "2026-07-11" };
    expect(getMatchdayLockKey(identity)).toContain("hsm:saturday:2026-07-11");
    expect(readMatchdayLock(identity)).toBe(false);
    expect(writeMatchdayLock(identity, true)).toBe(true);
    expect(readMatchdayLock(identity)).toBe(true);
    writeMatchdayLock(identity, false);
    expect(readMatchdayLock(identity)).toBe(false);
  });

  test("wires direct schedule actions and optimiser actions instead of inert buttons", () => {
    expect(matchdaySource).toContain("saveCurrentSchedule");
    expect(actionBarSource).toContain("onOptimise");
    expect(actionBarSource).toContain("onPrint");
    expect(actionBarSource).not.toContain("window.print()");
    expect(matchdaySource).toContain("saveCurrentSchedule");
    expect(matchdaySource).toContain("applyOptimisationMove");
    expect(matchdaySource).toContain("applyAllOptimisationMoves");
    expect(optimiserSource).toContain("Apply this move");
    expect(optimiserSource).toContain("Apply all validated moves");
  });

  test("uses Ground Control confirmation dialogs instead of native browser popups", () => {
    expect(matchdaySource).toContain("<ConfirmDialog");
    expect(matchdaySource).not.toContain('eyebrow="Schedule approval"');
    expect(matchdaySource).toContain('eyebrow="Validated improvements"');
    expect(unresolvedSource).toContain(
      'title="Assign despite pitch conflict?"',
    );
    expect(confirmDialogSource).toContain('role="alertdialog"');
    expect(confirmDialogSource).toContain("success: {");

    [matchdaySource, unresolvedSource].forEach((content) => {
      expect(content).not.toContain("window.confirm");
      expect(content).not.toMatch(/\balert\s*\(/);
    });
  });

  test("normalises pitch labels and machine-format identifiers in the timeline", () => {
    expect(timelineSource).toContain("formatPitchLabel");
    expect(timelineSource).toContain("formatPitchFormat");
    expect(timelineSource).toContain('.replace(/[_-]+/g, " ")');
  });

  test("routes Operations print actions to Reports v1 and removes legacy print sheets", () => {
    expect(appCoreSource).toContain("openCurrentReport");
    expect(appCoreSource).toMatch(/target:\s*"reports"/);
    expect(appCoreSource).not.toContain("CombinedPrintSheet");
    expect(reportsSource).toContain("pendingAutoPrint");
    expect(reportsSource).toContain(
      'document.body.dataset.printTarget = "reports"',
    );

    [
      "../../src/components/SatPrintSheet.jsx",
      "../../src/components/SunPrintSheet.jsx",
      "../../src/components/CombinedPrintSheet.jsx",
    ].forEach((path) =>
      expect(existsSync(new URL(path, import.meta.url))).toBe(false),
    );
  });

  test("uses the shared unresolved card instead of day-specific duplicate wrappers", () => {
    expect(
      existsSync(
        new URL(
          "../../src/components/Operations/SaturdayUnresolvedCard.jsx",
          import.meta.url,
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        new URL(
          "../../src/components/Operations/SundayUnresolvedCard.jsx",
          import.meta.url,
        ),
      ),
    ).toBe(false);
  });
});
