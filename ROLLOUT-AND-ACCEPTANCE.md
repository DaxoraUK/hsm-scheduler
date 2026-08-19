# v3.10.32 Rollout and Acceptance

1. Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the extracted release package.
2. Confirm the installer verifies all payload and deletion-target hashes before modification.
3. Confirm focused Coach Hub/access regressions pass.
4. Confirm the full regression catalogue passes in controlled batches.
5. Confirm lint and production build pass; existing warnings must be reported separately.
6. Confirm the Supabase dry run passes, then the linked migration is applied.
7. Confirm Git whitespace validation passes and only release files are staged.
8. Confirm commit and push target `origin staging`.
9. After deployment, sign in as a club administrator and confirm Access & Security can display/add/remove additional roles.
10. Confirm a Coach role remains team-oriented and a Coach + Fixture/Operations role receives combined permissions without member-management access.
11. Confirm the Vercel API tree still has one deployable `api/[...path].js` entry.
