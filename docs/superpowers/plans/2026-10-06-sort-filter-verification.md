# Sort and filter verification handoff

Date: 6 October 2026. Branch: referee-flow-staging.

## Status

Implementation and confirmed review corrections are saved locally. The independent whole-branch review resumed and completed. All five Important findings have reproduction tests and corrections; no Critical or Minor findings were reported. Release commit d6260c03781f29ffc46a5164e9bea37a7eeb18c1 is deployed and promoted to https://app.daxora.co.uk. See release evidence below.

The feature covers the accessible collections in the companion coverage inventory, including clickable data headings, natural A–Z ordering, configured numeric team-age ordering, clear/reset controls and original action IDs. Calendars and priority/rank views retain their domain defaults.

Confirmed review fixes:

- Communications Date used a nonexistent row field. It now reads an actual fixture date or authoritative selected matchday date.
- Several record adapters discarded configured team age. They now retain original embedded metadata, an unambiguous stable reference or unique name. Unknown/ambiguous keys do not borrow another team's age. This is display-only, not fixture identity or scheduling classification.
- Club eligibility request history and all five fixture-exception queues lacked collection controls; they now use the shared controls.
- League fixture/exception and schedule allocation controls now clear/reset the existing upstream filters, preserve selected sorting when clearing, show active counts, and recover from empty results.

## Fresh verification

- Full Vitest run: 213 files, 1,158 tests passed, no failures.
- Added regression cases were observed failing before implementation, then passing.
- TypeScript project check: exit 0.
- Vite production build: exit 0; existing large-chunk warning remains.
- Whitespace/error diff check: clean.
- Previous local browser checks: root and sign-in loaded without console errors; actual Settings team/pitch components with synthetic records demonstrated keyboard sorting, combined filtering, counts, clear/reset, original edit mapping and mobile layout.
- Candidate public page and sign-in, and promoted app.daxora.co.uk/signin, opened successfully in the browser with no captured console errors. Authenticated real Operations/Planner/Coach routes remain unverified. No live fixture rebuilds or data changes were run.

## Release evidence

- Project: ground-control, prj_TowVxcZxDozJei2uhX0fkri51GGZ, team daxora; Vite framework.
- Code SHA: d6260c03781f29ffc46a5164e9bea37a7eeb18c1; branch referee-flow-staging; deployment metadata independently matches.
- Candidate: https://ground-control-iz036cyxd-daxora.vercel.app; deployment dpl_7z4r3oq4mtbAgYkYhuZ1f2xUsZ2i; READY, production target.
- Clean git archive source upload; remote npm run build (TypeScript + Vite) passed. Vercel output build completed in approximately 10 seconds.
- Candidate verified before promotion using authenticated vercel curl, without disabling protection. Direct unauthenticated HTTP had returned Vercel protection HTML, not application HTML.
- Candidate and stable root: HTTP 200, actual Vite HTML. All 15 root-referenced JS/CSS bundles plus 8 main changed-route bundles returned HTTP 200 with nonempty, non-HTML bodies. This checks those 23 assets, not every nested lazy dependency or authenticated user flow.
- Main bundles: /assets/index-BBknO56T.js and /assets/index-BipA7WsD.css. Stable verification used public HTTP, with no protection bypass.
- Candidate and stable /api/health: HTTP 200, ready; environment staging, branch referee-flow-staging; 8 ready, 1 optional push, 0 blocked. Configuration health does not prove database transactions or mail delivery.
- Candidate public page and sign-in rendered; stable /signin rendered with empty browser error logs. Signed-in module flows are not verified.
- Before promotion app.daxora.co.uk resolved to dpl_DtxyBhorCJkaf9URqti5PkWDAJBr. After promotion it resolves to this exact candidate. The generated ground-control-daxora.vercel.app alias was assigned by Vercel despite --skip-domain; the custom main address remained unchanged until explicit promotion.
- Runtime error scan: this deployment, error level, preceding 1 hour, limit 100: no logs found. Short scan is not proof of all user flows. Drains and external monitoring configuration were not verified.
- Independent review completed; all Important findings corrected with RED/GREEN evidence. Plan scratch may now be removed; this committed record, tests and Git history retain the results.

## Rulings I made

1. Used the approved existing branch/checkout rather than another worktree. Cost if wrong: shared-checkout risk; intended paths are explicitly staged and unrelated cli-latest preserved.
2. Used PowerShell/apply_patch bookkeeping because Bash was unavailable. Cost if wrong: manual ledger requires comparison with Git/test evidence.
3. Added one shared render-prop adapter instead of duplicating collection logic. Cost if wrong: an additional shared interface needs review.
4. Skipped legacy components with no consumers, using actual routed screens. Cost if wrong: future activation of those components will require controls.
5. Updated a Communications recipient-refresh test to select the named team rather than the first card, because the default order changed. Cost if wrong: selector fragility; original recipient assertion and runtime ID checks remain.
6. Did not silently expand database/permission interfaces or present capped histories as whole-history filters. Cost if wrong: historical sorting remains unavailable pending separately approved paging.
7. Updated static Communications variable-name assertions to the new presentation wrapper names, retaining original-index/contact runtime checks. Cost if wrong: brittle static tests could miss behavior; runtime checks mitigate this.
8. Reviewer could not judge authenticated behavior or live database completeness; public deployment startup will be checked and authenticated routes explicitly labelled unverified. Cost if wrong: session-specific behavior remains untested.
9. Accepted implementer RED/GREEN evidence for reported fixes without a redundant independent re-review, as required by the approved workflow. Cost if wrong: fixes have no second independent code inspection.
10. Kept the existing branch/workspace without merge or PR because deployment, not repository integration, was approved. Cost if wrong: direct deployment does not update the remote Git branch.

## Deferred minors and limitations

- Existing production bundle-size warning: no unrelated code splitting added.
- Whole-history filtering is not complete for capped backend collections; see the coverage inventory for exact boundaries. This is remaining work, not an exemption.
- Independent review and public deployed startup verification are complete. Authenticated module verification remains pending; monitoring/drains configuration is unverified.

Deployment and explicit promotion occurred as described. No remote Git push, merge/PR, database migration, fixture mutation, external invitation or message sending occurred. Documentation-only commits after release do not change the deployed code SHA.
