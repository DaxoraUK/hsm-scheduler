# Daxora Ground Control — Launch Regression Harness and Product Audit

**Audit date:** 3 July 2026  
**Source reviewed:** full `hsm-scheduler` project upload  
**Scope:** launch hardening only; no bolt-on products added

## Executive verdict

The scheduling, pitch validation, parking and weather foundations are strong enough to continue launch hardening. The product is **not yet safe for a multi-club pilot or paid launch**.

The main blocker is the current Supabase persistence model. REST requests use the project anon key as the bearer token, records are not scoped to an authenticated club, and several save functions delete every row in a table before reinserting the current browser's data. That is acceptable only as a temporary single-club development prototype. It must be replaced by a tenant-aware schema and tested Row Level Security before any second club is onboarded.

The visible Reports and Communications routes also expose unfinished product surfaces. Reports v1 must be completed or hidden before pilot use. Communications should either expose only working message workflows or be hidden until its foundations are operational.

## Work completed in this phase

### Regression harness

Added Vitest with V8 coverage and the following commands:

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run check
```

`npm run check` now runs lint, the regression suite and the production build as one release gate.

### Protected regression areas

The initial suite contains **33 passing tests across 6 test files** covering:

- Parking disabled, zero/unset capacity and explicit zero-car estimates
- Physical capacity and concurrent-game limits
- Fifteen-minute overlap detection
- Parking recommendation improvement checks
- Pitch format, age suitability, closures and linked pitch clashes
- Saturday, Sunday and midweek scheduling windows
- Adult weekend and evening scheduling rules
- Unresolved fixture handling
- Weekend and midweek date boundaries
- Pitch closure persistence rules
- Workspace module toggles
- Live-weather configuration, provider mapping and date-range handling
- FA Full-Time HTML parsing

### Defects fixed by the new tests

**GC-FIX-001 — Impossible calendar dates were silently accepted**  
`parseLocalDateInput("2026-02-29")` rolled into March rather than failing validation.

**GC-FIX-002 — Invalid clock values were silently accepted**  
Values such as `25:90` were converted to minutes rather than falling back safely.

Both defects were corrected in `src/lib/date/matchweekCalendar.js` and are now permanently covered.

## Validation results

| Check | Result |
|---|---:|
| Production build | Passed |
| Oxlint | Passed with 110 warnings and 0 errors |
| Regression tests | 33 passed, 0 failed |
| Coverage thresholds | Passed |
| Statement coverage | 61.38% |
| Branch coverage | 51.54% |
| Function coverage | 66.83% |
| Line coverage | 65.86% |
| npm vulnerability audit | 0 vulnerabilities |
| Production JavaScript bundle | 878.25 kB minified / 239.27 kB gzip |

Coverage is intentionally restricted to the launch-critical engines currently protected by the suite. It is not a claim of 61% coverage across the whole UI.

## Prioritised defect register

### P0 — blocks a multi-club pilot

| ID | Area | Finding | Required action |
|---|---|---|---|
| GC-001 | Tenant isolation | Supabase table reads are unfiltered and several saves issue `DELETE ... id=neq.null`, replacing every record in the table. A second club could read or erase another club's data. | Create organisation, club, membership and tenant-owned operational tables. Add `club_id` or equivalent ownership to every record. Remove global delete-and-reinsert saves. |
| GC-002 | Authentication and RLS | `supaFetch` sends the anon key as both `apikey` and bearer token instead of the authenticated user's access token. Database requests therefore do not carry trustworthy user identity for RLS. | Use the signed-in user's JWT for database requests, retain the anon key only as `apikey`, and add deny-by-default RLS policies tested for cross-club access. |
| GC-003 | Audit integrity | Audit entries are posted from the browser using client-supplied email/name fields and the same anonymous database request path. They are not a trustworthy security audit trail. | Generate actor identity from authenticated claims server-side or in secure database functions. Make audit events append-only and tenant scoped. |

### P1 — blocks pilot readiness or a credible launch

| ID | Area | Finding | Required action |
|---|---|---|---|
| GC-004 | Persistence reliability | Supabase failures return `null`, but `saveTab` still changes the status to connected and shows the section as saved. Delete-then-insert operations are not transactional, so a failed insert can leave data empty. | Make persistence throw structured errors, verify every save result, use upserts/transactions and show real retryable failure states. |
| GC-005 | Browser data isolation | 41 local-storage access points use global `hsm_*`/`gc_*` keys with no authenticated user or club namespace. Different accounts using the same browser can inherit each other's cached settings and schedules. | Introduce a storage adapter namespaced by tenant and user, then migrate or clear legacy keys safely. |
| GC-006 | Reports | The Reports route is visible in primary navigation but contains only three “Coming next” cards. | Build Reports v1 or remove the route from pilot navigation. Minimum launch scope: combined matchday pack, fixture/pitch/official/parking/weather reports, print/PDF and CSV export. |
| GC-007 | Communications | The Communications route is visible but primarily displays integration readiness and explicitly says no live provider calls exist. | Limit the page to working coach/referee message workflows or hide it until the publishing queue and audit trail exist. |
| GC-008 | Mobile navigation | The main sidebar is hidden below the `lg` breakpoint and the header has no hamburger, drawer or bottom navigation. Search is the only indirect route on smaller screens. | Add an accessible mobile navigation drawer and regression-test all primary routes at phone/tablet widths. |
| GC-009 | Fixture import reliability | Live Full-Time import depends on the public `api.allorigins.win` proxy and HTML scraping. League URLs remain hard-coded for the development club. | Move fetching/parsing server-side, make sources club-configurable, record imports, validate mappings and provide CSV/manual fallback. |
| GC-010 | Application recovery | No top-level React error boundary is present. An unexpected render error can leave the operational workspace blank. | Add a branded error boundary with safe reload, diagnostic reference and support details. |
| GC-011 | Session lifecycle | Authentication is checked/refreshed only during application mount; no proactive expiry timer or auth-state listener was found. | Centralise session management, refresh before expiry and force a safe sign-out when refresh fails. |
| GC-012 | Default customer data | The repository still carries Horwich-specific defaults, Full-Time sources and legacy product keys. New tenants could start with development-club data. | Replace customer data with an onboarding-created workspace and a clearly isolated demo seed. |

### P2 — fix during production UX, analytics and support hardening

| ID | Area | Finding | Required action |
|---|---|---|---|
| GC-013 | Bundle performance | Vite reports a single 878 kB production JavaScript chunk, above its 500 kB warning threshold. | Lazy-load major routes and heavy analytics/chart modules; review Recharts imports. |
| GC-014 | Code health | Oxlint reports 110 warnings. Many are swallowed errors, unused compatibility code or weak dependency handling. | Burn warnings down to zero or an explicitly approved baseline before release. |
| GC-015 | Dead/stale code | Static import analysis found 65 source files unreachable from `src/main.jsx`, including 8 empty placeholder files and two competing UI component locations. | Confirm ownership, delete abandoned files and retain only one active implementation for each component/engine. |
| GC-016 | Circular dependency | One cycle links validation, rules, pitch, officials and parking services. | Move shared types/pure predicates into lower-level modules so engines depend in one direction. |
| GC-017 | Blocking browser dialogs | 22 uses of `alert()`/`confirm()` remain in operational and settings flows. | Replace them with accessible inline validation, toasts and confirmation dialogs. |
| GC-018 | Type/build assurance | Most product code is JS/JSX while `tsc -b` primarily checks TS files. A successful build is not a full type check of the application. | Either migrate critical modules to TypeScript or enable staged `checkJs`/JSDoc checking. |
| GC-019 | CI | No repository CI workflow was found. | Run `npm ci`, `npm run check` and `npm run test:coverage` on every pull request and protected branch. |
| GC-020 | Repository hygiene | The root still uses starter package metadata/README and contains a nested stale `ground-control` starter project. | Rename package metadata, replace README and remove the nested starter after confirming nothing imports it. |
| GC-021 | Analytics claims | The funding-evidence area exists, but it must not imply broad grant compliance before the planned researched Grant Requirements Matrix is built. | Keep wording evidence-led and generic; validate specific funder requirements in the later matrix. |

## Structural evidence

- 230 JS/JSX/TS/TSX source files were inspected.
- 65 were not reachable from the current `src/main.jsx` static import graph.
- 8 source files were empty placeholders.
- One cross-engine circular dependency was detected:

```text
validationEngine
→ rulesEngine
→ pitchRules
→ officialRules
→ officialService
→ parkingRules
→ parkingService
→ validationEngine
```

- No `.github` CI workflow or deploy-safe `.env.example` was present.
- The current production build succeeds, but the bundle-size warning remains.

## Launch gates

Ground Control should not onboard a second real club until all of these are true:

1. Every persistent record has tenant ownership.
2. Authenticated requests carry the user JWT.
3. RLS denies cross-club reads and writes in automated tests.
4. Global table deletion has been removed.
5. Browser caches are tenant/user namespaced.
6. Save failures are visible and recoverable.
7. Reports is complete or hidden.
8. Mobile navigation is usable.
9. A top-level error boundary and production support reference exist.
10. The release gate passes in CI.

## Recommended next roadmap action

Proceed directly to **Multi-club Data Model and Supabase Row Level Security**. This is now evidence-based P0 work, not optional architecture refinement.

The correct sequence from here is:

1. Design tenant, club, site, user and membership ownership.
2. Migrate all persisted entities to tenant-scoped rows.
3. Replace the raw anonymous REST wrapper with authenticated data access.
4. Write RLS isolation tests before wiring the UI.
5. Add roles, permissions, immutable audit events and controlled support impersonation.
6. Then complete onboarding, production UX/error handling, Analytics v1 and Reports v1.

## Remaining manual audit

The automated and source-level audit is complete. A final interactive browser pass is still required on a real local deployment for visual layout, keyboard navigation, phone/tablet breakpoints, print/PDF output and provider-network failure behaviour. That pass should be executed against the protected build after the P0 data layer is in place, so findings are not invalidated by the upcoming architecture work.
