# Daxora Ground Control v3.10.3.1 Rollout

1. Install the migration-only hotfix on the `staging` branch.
2. Run the focused regression test, full regression suite and production build.
3. Dry-run and apply the linked Supabase migration.
4. Push the committed migration and evidence files to `staging`.
5. After Vercel finishes, open **Settings → Coach Hub** and use **Invite coach** for Andrew Manville.
6. Confirm the invitation is delivered and the status changes from **Not invited** to **Pending**.
7. Open the invitation using the receiving email account and confirm acceptance activates Coach Hub access.

No manual SQL is required when the installer completes successfully.
