# Canonical Control Centre Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every Control Centre fixture mutation through the immutable canonical provider identity.

**Architecture:** The override map has one merged record per canonical fixture identity. Drawer, planner, officials and operational actions resolve the same identity. Indexes remain legacy-display data only.

**Tech Stack:** React, JavaScript, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-09-03-canonical-control-centre-identity-design.md`

## Global Constraints

- Do not create, clone, or persist a secondary fixture for a venue reversal.
- Preserve legacy index-keyed override rehydration, but write new mutations by canonical identity.
- Do not deploy or touch production.

---

### Task 1: Canonical override mutation helper

**Files:**
- Modify: `src/lib/domain/fixtureVenueFlow.js`
- Test: `tests/regression/fixture-venue-flow.test.js`

**Interfaces:**
- Produces `mergeFixtureOverride(overrides, fixtureIdentity, patch)`.

- [ ] Write a failing test that merges a KO patch into a venue-reversal record.
- [ ] Run `npm test -- tests/regression/fixture-venue-flow.test.js` and confirm failure.
- [ ] Implement the smallest identity-keyed merge helper.
- [ ] Re-run the focused regression and confirm pass.

### Task 2: Canonical Control Centre mutations and selection

**Files:**
- Modify: `src/AppCore.jsx`
- Modify: `src/pages/MatchdayPage.jsx`
- Modify: `src/components/Operations/shared/FixtureDrawer.jsx`
- Modify: `src/lib/engines/matchdayPlannerEngine.js`
- Test: `tests/regression/fixture-venue-flow.test.js`

**Interfaces:**
- Consumes `mergeFixtureOverride` and `getFixtureFlowIdentity`.
- Produces `onFixturePatch(fixtureIdentity, patch)` for each mutation source.

- [ ] Write failing native and reversed fixture control-edit regressions.
- [ ] Run the focused regression and confirm numeric-index mutation fails to preserve reversal plus operational patch.
- [ ] Change drawer, selection and action paths to canonical identity.
- [ ] Re-run the focused regression and confirm pass.

### Task 3: Rebuild and count-invariant coverage

**Files:**
- Modify: `tests/regression/full-time-browser-feeds-v31044.test.js`
- Modify: `tests/regression/ground-control-matchday-planner-v384.test.js`

- [ ] Add failing refresh/rebuild tests for KO, pitch, referee and a single canonical fixture.
- [ ] Run the focused files and confirm the original path fails.
- [ ] Add the minimal fixtures/assertions needed for native/reversed parity.
- [ ] Re-run focused files and confirm pass.

### Task 4: Verify and release staging

**Files:**
- Verify only: modified source and regression files.

- [ ] Run targeted regressions.
- [ ] Run TypeScript, lint and production build.
- [ ] Run an application startup smoke test.
- [ ] Commit, push `referee-flow-staging`, deploy only the staging Vercel project and verify its alias.
