# Canonical Scheduling State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Saturday, Sunday and Midweek scheduling from canonical fixtures plus explicit user intent, so generated allocations can never persist as manual decisions.

**Architecture:** Add a pure scheduling-state domain service which materialises effective fixtures and a deterministic build from provider facts, manual fixtures and typed intent. AppCore owns persisted intent and the latest derived build; every operational view consumes selectors from that build. Existing provider reconciliation and canonical fixture identity remain authoritative.

**Tech Stack:** React 19, JavaScript modules, Vitest, Vite, Supabase RPC client.

**Spec:** `docs/superpowers/specs/2026-09-03-scheduling-state-contract-design.md`

## Global Constraints

- Keep provider canonical identity unchanged; Away-to-Home is a venue intent only.
- Do not modify production, Supabase credentials, environment configuration or unrelated temporary files.
- A generated allocation is never persisted as manual intent.
- All mutable fixture actions use canonical identity; manual fixtures use a stable `manual:<uuid>` identity.
- Refresh reconciles provider facts only; Rebuild derives a replacement allocation.
- Maintain staging-only deployment and preserve existing Vercel Analytics and Speed Insights root mounting.

---

### Task 1: Pure intent and build domain

**Files:**
- Create: `src/lib/domain/schedulingState.js`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Produces `createManualFixture`, `mergeFixtureIntent`, `materialiseEffectiveFixtures`, `buildSchedulingState` and `selectEffectiveAllocation`.
- Consumes canonical fixture identity helpers and `scheduleFixtureDay`.

- [ ] **Step 1: Write failing tests** for venue intent, locked allocation intent, excluded fixtures, generated allocations, unresolved exclusivity and repeated deterministic builds.
- [ ] **Step 2: Run the isolated test** and confirm it fails because the scheduling-state module does not exist.
- [ ] **Step 3: Implement the minimal pure state service** with explicit `allocation.mode` semantics and canonical-ID validation.
- [ ] **Step 4: Run the isolated test** and confirm it passes.
- [ ] **Step 5: Commit** `feat: add canonical scheduling state service`.

### Task 2: Persist typed intent and separate scope actions

**Files:**
- Modify: `src/AppCore.jsx`
- Modify: `src/hooks/useWeekPersistence.js`
- Modify: `src/lib/history/historyRestore.js`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Consumes Task 1 service.
- Produces per-scope `fixtureIntent`, provider facts and latest derived build without treating a saved snapshot as live input.

- [ ] **Step 1: Write failing tests** that distinguish a provider refresh from rebuild and show that history snapshots do not rehydrate allocation intent.
- [ ] **Step 2: Run the tests** and confirm the current override/snapshot flow fails.
- [ ] **Step 3: Replace the broad day override map** with typed intent, route venue reversal and Control Centre mutations through it, and retain old snapshots only as historical output.
- [ ] **Step 4: Split live refresh and rebuild entry points** for every scope; guard concurrent builds.
- [ ] **Step 5: Run focused regression tests** and commit `feat: separate fixture intent from schedule builds`.

### Task 3: Unify operational consumers and manual fixture identity

**Files:**
- Modify: `src/pages/MatchdayPage.jsx`
- Modify: `src/components/Operations/shared/MatchdayUnresolvedCard.jsx`
- Modify: `src/components/Operations/shared/MatchdayManualFixtures.jsx`
- Modify: `src/components/ManualForm.jsx`
- Modify: `src/components/Operations/shared/FixtureDrawer.jsx`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Consumes task 2 build and intent mutation service.
- Produces a single allocation selector shared by Control Centre, timeline, unresolved work and manual fixture UI.

- [ ] **Step 1: Write failing tests** for manual stable IDs, resolved/unresolved exclusivity and fixture-count invariance after every mutation.
- [ ] **Step 2: Run the tests** and confirm existing append/remove and index deletion behaviour fails.
- [ ] **Step 3: Change resolution to write locked allocation intent and rebuild**, never append a separate scheduled object; make manual deletion identity-based.
- [ ] **Step 4: Route KO, pitch, official and reference changes through the common intent service.**
- [ ] **Step 5: Run focused tests** and commit `feat: unify matchday mutations on fixture intent`.

### Task 4: Calendar, optimiser and derived recommendations

**Files:**
- Modify: `src/pages/MatchdayPage.jsx`
- Modify: `src/components/Operations/shared/MatchdayTimelineCard.jsx`
- Modify: `src/components/Operations/shared/MatchweekCommandBar.jsx`
- Modify: `src/lib/engines/dayOptimiserEngine.js`
- Modify: `src/components/Operations/shared/MatchdayCarParkCard.jsx`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Calendar/Control Centre create `allocation.mode: "locked"` intent.
- Optimiser and parking return derived proposals; acceptance explicitly creates locked intent.

- [ ] **Step 1: Write failing tests** for Calendar move persistence, generated recommendation replacement on rebuild, and the new Refresh Fixtures / Optimise Day distinction.
- [ ] **Step 2: Run tests** and confirm optimiser proposals currently persist as manual overrides.
- [ ] **Step 3: Use canonical fixture identity at the commit boundary for all planner actions** and expose separate scope controls.
- [ ] **Step 4: Ensure recommendations are not written as intent unless explicitly accepted as manual.**
- [ ] **Step 5: Run focused tests** and commit `feat: separate calendar intent from generated optimisation`.

### Task 5: Deterministic full-day allocation and classification coverage

**Files:**
- Modify: `src/lib/scheduler.js`
- Modify: `src/lib/planning/annualPlannerEngine.js`
- Test: `tests/regression/scheduler-recommendations.test.js`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Scheduler consumes effective fixtures and locked allocation intent.
- Annual planner source ID uses canonical fixture identity.

- [ ] **Step 1: Write failing tests** for a valid alternative allocation, U17 imported fixture classification, deterministic ten-run builds and canonical annual-calendar source IDs.
- [ ] **Step 2: Run tests** and confirm current greedy/legacy-source behaviour fails.
- [ ] **Step 3: Implement deterministic candidate search that honours locks and reports blocking reasons**, without expanding persistent state.
- [ ] **Step 4: Update calendar source identity and confirm no duplicate downstream booking key.**
- [ ] **Step 5: Run focused tests** and commit `feat: make matchday allocation deterministic and canonical`.

### Task 6: Exclusion, workflow regression and release verification

**Files:**
- Modify: `src/pages/MatchdayPage.jsx`
- Modify: `src/components/Operations/shared/FixtureDrawer.jsx`
- Modify: `src/lib/domain/schedulingState.js`
- Test: `tests/regression/scheduling-state-contract.test.js`

**Interfaces:**
- Exclusion is canonical intent with a reason; restore removes only that intent.
- Manual delete removes the stable manual record and associated intent/build state.

- [ ] **Step 1: Write failing tests** for exclusion/restore, manual deletion and the complete requested workflow including ten rebuilds.
- [ ] **Step 2: Run tests** and confirm the exclusion capability is absent.
- [ ] **Step 3: Implement confirmation-based exclusion/restore and manual deletion.**
- [ ] **Step 4: Run targeted tests, full regression suite, TypeScript, production build and startup smoke test.**
- [ ] **Step 5: Commit, push the staging branch, deploy only `daxora-ground-control-staging`, and verify its normal alias.**
