# Matchweek Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair matchweek movement and printing, add an auditable postponement lifecycle, reopen on the relevant upcoming weekend, and enforce 25/30-minute inactivity security.

**Architecture:** Keep the existing fixture object as the single operational record. Add small pure helpers for fixture lifecycle, report input selection, matchweek initialisation and inactivity timing; UI components call those helpers while persistence and analytics consume the same status metadata already supported by the evidence engine.

**Tech Stack:** React 18, JavaScript, Vitest, Supabase persistence, Vite.

**Spec:** `docs/superpowers/specs/2026-08-31-matchweek-reliability-design.md`

## Global Constraints

- Warn after exactly 25 minutes of inactivity and sign out after exactly 30 minutes.
- Postponed fixtures retain their original date, pitch and kick-off plus reason, note, timestamp and actor where available.
- Postponed and cancelled fixtures do not occupy live resources or appear in the operational fixture-allocation print table.
- Existing matchweek-edit permissions govern moving, postponing and restoring fixtures.
- A fresh login selects the current or next weekend; explicitly loading history remains supported.
- Every production change starts with a failing regression test.

---

### Task 1: Stop a fixture colliding with its own Annual Planner booking

**Files:**
- Modify: `src/lib/planning/annualPlannerEngine.js`
- Modify: `src/lib/engines/timelineDragEngine.js`
- Test: `tests/regression/ground-control-timeline-drag-v383.test.js`

**Interfaces:**
- Consumes: `buildTimelineMoveCandidate({ fixtures, fixtureIndex, matchDate, resourceBookings, ... })`
- Produces: `detectAnnualPlannerConflicts(candidate, context, { excludeSourceIds })` or an equivalent explicit exclusion input.

- [ ] **Step 1: Write the failing self-booking regression**

Add a test that passes a fixture plus its already-synchronised Annual Planner booking, then proposes the same time on a different free compatible pitch:

```js
it("excludes the selected fixture's synced booking when validating a move", () => {
  const candidate = buildTimelineMoveCandidate({
    fixtures: [fixture], fixtureIndex: 0, pitchCfg: pitches, club,
    pitchId: "P1", koMins: 570, start: 510, end: 990,
    matchDate: "2026-09-05",
    resourceBookings: [{
      id: "booking-1", sourceId: fixture.id, sourceType: "matchday_saturday",
      teamKey: fixture.cfg.id, pitchId: fixture.pitchId,
      startAt: "2026-09-05T09:30:00", endAt: "2026-09-05T11:10:00",
      status: "confirmed",
    }],
  });
  expect(candidate.blocked).toBe(false);
  expect(candidate.patch.pitchId).toBe("P1");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/regression/ground-control-timeline-drag-v383.test.js`

Expected: FAIL because the synced booking is reported as a team conflict.

- [ ] **Step 3: Implement identity-aware resource exclusion**

Pass stable fixture source identities into Annual Planner conflict detection and filter only the selected fixture's corresponding synced booking. Do not suppress any other booking for the same team.

- [ ] **Step 4: Verify GREEN and existing clash coverage**

Run: `npm test -- tests/regression/ground-control-timeline-drag-v383.test.js`

Expected: PASS, including the existing real same-pitch overlap test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planning/annualPlannerEngine.js src/lib/engines/timelineDragEngine.js tests/regression/ground-control-timeline-drag-v383.test.js
git commit -m "fix matchday fixture move self conflict"
```

### Task 2: Make fixture-allocation printing use the complete active scope

**Files:**
- Modify: `src/lib/engines/operationalEvidenceEngine.js`
- Modify: `src/lib/reports/reportingEngine.js`
- Modify: `src/pages/ReportsPage.jsx`
- Modify: `src/components/reports/ReportDocument.jsx`
- Test: `tests/regression/analytics-reports.test.js`

**Interfaces:**
- Consumes: current `satFinal`, `sunFinal`, `midweekFinal` and selected report scope.
- Produces: `model.activeFixtures` as the authoritative fixture-allocation print rows and `model.exceptions` for postponed/cancelled rows.

- [ ] **Step 1: Add an eight-fixture print-model regression**

Build a current Saturday with eight scheduled fixtures, including imported, moved and manually identified records, and assert:

```js
expect(model.activeFixtures).toHaveLength(8);
expect(model.activeFixtures.map((row) => row.raw.id)).toEqual(expect.arrayContaining(ids));
```

Add postponed and cancelled records and assert they appear in `model.exceptions`, not `model.activeFixtures`.

- [ ] **Step 2: Run the focused report test and verify RED**

Run: `npm test -- tests/regression/analytics-reports.test.js`

Expected: FAIL on the reproduced partial-row path.

- [ ] **Step 3: Centralise the operational print-row selector**

Ensure all fixtures in the selected current scope are normalised and deduplicated by stable fixture identity. Use `activeFixtures` in the fixture-allocation document and keep exception rows in exception reporting. Preserve day/date labels and sort by date, kick-off and pitch.

- [ ] **Step 4: Verify row count and report variants**

Run: `npm test -- tests/regression/analytics-reports.test.js tests/regression/daxora-report-delivery-v382.test.js`

Expected: PASS with eight active allocation rows.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/operationalEvidenceEngine.js src/lib/reports/reportingEngine.js src/pages/ReportsPage.jsx src/components/reports/ReportDocument.jsx tests/regression/analytics-reports.test.js
git commit -m "fix complete matchweek fixture printing"
```

### Task 3: Add an auditable postpone and restore lifecycle

**Files:**
- Create: `src/lib/domain/fixtureLifecycle.js`
- Modify: `src/components/Operations/shared/FixtureDrawer.jsx`
- Modify: `src/pages/MatchdayPage.jsx`
- Modify: `src/hooks/useFixtureDayScheduling.js`
- Modify: `src/hooks/useWeekPersistence.js`
- Modify: `src/lib/engines/operationalEvidenceEngine.js`
- Test: `tests/regression/fixture-postponement-flow.test.js`

**Interfaces:**
- Produces: `postponeFixture(fixture, { reason, note, actor, now })` and `restoreFixture(fixture)`.
- Preserves: `postponement.originalDate`, `originalPitchId`, `originalPitchLabel`, `originalKoMins`, `originalKoTime`, `reason`, `note`, `recordedAt`, `actor`.

- [ ] **Step 1: Write lifecycle regressions**

Assert that postponement requires a valid reason, retains the original allocation, changes status, disappears from active resource calculations, survives saved-history splitting, and contributes to analytics by reason. Assert restoration returns the original allocation metadata for normal validation.

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- tests/regression/fixture-postponement-flow.test.js`

Expected: FAIL because `fixtureLifecycle.js` and metadata propagation do not exist.

- [ ] **Step 3: Implement pure lifecycle helpers**

Use these reason keys and labels:

```js
export const POSTPONEMENT_REASONS = {
  weather: "Weather",
  unsafe_pitch: "Waterlogged or unsafe pitch",
  ground_unavailable: "Ground unavailable",
  opposition_request: "Opposition request",
  league_decision: "League decision",
  other: "Other",
};
```

Never delete the fixture or its original allocation.

- [ ] **Step 4: Wire authorised UI actions**

Add Postpone and Restore controls to the existing fixture drawer. Require a reason, allow an optional note, confirm destructive state changes, and apply through the existing override/update callback so Saturday, Sunday and midweek behave identically.

- [ ] **Step 5: Propagate to persistence and evidence**

Ensure postponed metadata is retained by `useWeekPersistence`, excluded from live capacity/official checks, and exposed in operational evidence, reports and analytics.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- tests/regression/fixture-postponement-flow.test.js tests/regression/analytics-reports.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain/fixtureLifecycle.js src/components/Operations/shared/FixtureDrawer.jsx src/pages/MatchdayPage.jsx src/hooks/useFixtureDayScheduling.js src/hooks/useWeekPersistence.js src/lib/engines/operationalEvidenceEngine.js tests/regression/fixture-postponement-flow.test.js
git commit -m "feat add matchweek postponement lifecycle"
```

### Task 4: Reopen on the current or next matchweek after login

**Files:**
- Modify: `src/lib/date/weekendCalendar.js`
- Modify: `src/AppCore.jsx`
- Test: `tests/regression/matchweek-calendar-login.test.js`

**Interfaces:**
- Produces: `getInitialMatchWeekend(now, { freshSession })` or a separate `getLoginMatchWeekend(now)` that always returns `getCurrentMatchWeekend(now)`.

- [ ] **Step 1: Write date regressions**

Cover Sunday belonging to the weekend that began Saturday, Monday-Friday selecting the coming weekend, Saturday selecting today, and a fresh login ignoring both past and future convenience selections.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/regression/matchweek-calendar-login.test.js`

Expected: FAIL because a future persisted weekend currently remains selected.

- [ ] **Step 3: Reset only at the authentication/workspace boundary**

Keep manual date selection and saved-history loading intact during a session. When a fresh authenticated workspace hydrates, set Saturday/Sunday to the current match weekend and midweek to the current-or-next configured midweek date.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/regression/matchweek-calendar-login.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/date/weekendCalendar.js src/AppCore.jsx tests/regression/matchweek-calendar-login.test.js
git commit -m "fix matchweek date on fresh login"
```

### Task 5: Enforce inactivity warning and sign-out

**Files:**
- Create: `src/lib/security/inactivityPolicy.js`
- Modify: `src/hooks/useSessionLifecycle.js`
- Modify: `src/AppCore.jsx`
- Create or modify: `src/components/system/SessionInactivityWarning.jsx`
- Test: `tests/regression/session-inactivity.test.js`

**Interfaces:**
- Produces: `INACTIVITY_WARNING_MS = 25 * 60 * 1000`, `INACTIVITY_LOGOUT_MS = 30 * 60 * 1000`, and pure deadline helpers.
- Extends: `useSessionLifecycle` return value with warning state and `staySignedIn()`.

- [ ] **Step 1: Write fake-clock inactivity regressions**

Assert no warning before 25 minutes, warning at 25 minutes, reset on meaningful activity, sign-out at 30 minutes, and external-tab activity/sign-out synchronisation. Assert token refresh does not reset activity.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- tests/regression/session-inactivity.test.js`

Expected: FAIL because inactivity policy is not implemented.

- [ ] **Step 3: Implement throttled activity tracking**

Track `pointerdown`, throttled `pointermove`, `keydown`, `touchstart`, focus and internal navigation. Store the last activity timestamp under a versioned local-storage key and listen for storage events.

- [ ] **Step 4: Add warning UI and secure sign-out**

Render a blocking warning at 25 minutes with `Stay signed in` and `Sign out now`. At 30 minutes call the existing sign-out/revocation path, clear tenant context and show the inactivity-specific security message.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- tests/regression/session-inactivity.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/security/inactivityPolicy.js src/hooks/useSessionLifecycle.js src/AppCore.jsx src/components/system/SessionInactivityWarning.jsx tests/regression/session-inactivity.test.js
git commit -m "feat enforce workspace inactivity sign out"
```

### Task 6: Integrated release verification

**Files:**
- Modify only if a verification failure identifies a regression in the files above.

**Interfaces:**
- Consumes all completed behaviours; produces a staging-ready commit series.

- [ ] **Step 1: Run focused integration tests**

Run:

```bash
npm test -- tests/regression/ground-control-timeline-drag-v383.test.js tests/regression/analytics-reports.test.js tests/regression/fixture-postponement-flow.test.js tests/regression/matchweek-calendar-login.test.js tests/regression/session-inactivity.test.js
```

Expected: PASS.

- [ ] **Step 2: Run all release gates**

Run:

```bash
npm test
npx tsc -b
npm run build
```

Expected: all tests pass, type check exits 0, production build exits 0.

- [ ] **Step 3: Review the final diff**

Confirm only planned files changed, no credentials or generated build output are tracked, and postponement/security copy matches the specification.

- [ ] **Step 4: Deploy to staging and smoke-test**

Push the verified branch to staging, wait for the Vercel deployment to become ready, then verify: P2→P1 movement, eight-row print, postpone/restore, analytics evidence, upcoming-weekend login and inactivity warning controls.

