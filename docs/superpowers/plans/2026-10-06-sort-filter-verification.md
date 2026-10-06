# Sort and filter verification handoff

Date: 6 October 2026. Branch: referee-flow-staging.

## Status

Implementation and confirmed review corrections are saved locally. Deployment is held: the independent whole-branch reviewer reached the account usage limit before delivering a final verdict. Do not treat this document as release approval or a completed independent review.

The feature covers the accessible collections in the companion coverage inventory, including clickable data headings, natural A–Z ordering, configured numeric team-age ordering, clear/reset controls and original action IDs. Calendars and priority/rank views retain their domain defaults.

Confirmed review fixes:

- Communications Date used a nonexistent row field. It now reads an actual fixture date or authoritative selected matchday date.
- Several record adapters discarded configured team age. They now retain original embedded metadata, an unambiguous stable reference or unique name. Unknown/ambiguous keys do not borrow another team's age. This is display-only, not fixture identity or scheduling classification.
- Club eligibility request history and all five fixture-exception queues lacked collection controls; they now use the shared controls.

## Fresh verification

- Full Vitest run: 212 files, 1,155 tests passed, no failures.
- Added regression cases were observed failing before implementation, then passing.
- TypeScript project check: exit 0.
- Vite production build: exit 0; existing large-chunk warning remains.
- Whitespace/error diff check: clean.
- Previous local browser checks: root and sign-in loaded without console errors; actual Settings team/pitch components with synthetic records demonstrated keyboard sorting, combined filtering, counts, clear/reset, original edit mapping and mobile layout.
- Authenticated real Operations/Planner/Coach routes and a deployed candidate have NOT been verified. No live fixture rebuilds or data changes were run.

## Remaining release gates

1. Resume the existing independent reviewer and obtain its final report.
2. Resolve any remaining important findings with reproduction evidence, preserving the existing one-pass review workflow.
3. Deploy a clean committed candidate to the verified ground-control project, verify complete JS/CSS output, health and browser startup, then promote only the verified candidate using the approved release plan.

Do not delete this plan's scratch evidence until the final gate is complete.

## Rulings I made

1. Used the approved existing branch/checkout rather than another worktree. Cost if wrong: shared-checkout risk; intended paths are explicitly staged and unrelated cli-latest preserved.
2. Used PowerShell/apply_patch bookkeeping because Bash was unavailable. Cost if wrong: manual ledger requires comparison with Git/test evidence.
3. Added one shared render-prop adapter instead of duplicating collection logic. Cost if wrong: an additional shared interface needs review.
4. Skipped legacy components with no consumers, using actual routed screens. Cost if wrong: future activation of those components will require controls.
5. Updated a Communications recipient-refresh test to select the named team rather than the first card, because the default order changed. Cost if wrong: selector fragility; original recipient assertion and runtime ID checks remain.
6. Did not silently expand database/permission interfaces or present capped histories as whole-history filters. Cost if wrong: historical sorting remains unavailable pending separately approved paging.
7. Updated static Communications variable-name assertions to the new presentation wrapper names, retaining original-index/contact runtime checks. Cost if wrong: brittle static tests could miss behavior; runtime checks mitigate this.

## Deferred minors and limitations

- Existing production bundle-size warning: no unrelated code splitting added.
- Whole-history filtering is not complete for capped backend collections; see the coverage inventory for exact boundaries. This is remaining work, not an exemption.
- Final independent review and authenticated/deployed UI verification remain incomplete.

No deployment, remote push, database migration, fixture mutation, external invitation or message sending occurred during this handoff.
