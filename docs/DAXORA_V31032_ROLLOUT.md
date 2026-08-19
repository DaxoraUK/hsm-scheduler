# Daxora Ground Control v3.10.3.2 rollout

1. Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`.
2. Allow focused tests, production build, migration dry-run, commit, migration and staging push to finish.
3. The installer opens Supabase Auth URL Configuration.
4. Set Site URL to `https://ground-control-five.vercel.app`.
5. Add Redirect URL `https://ground-control-five.vercel.app/**`.
6. Wait for Vercel staging deployment.
7. Send a fresh Coach Hub invitation.
8. Open it in an InPrivate/Incognito browser, create the coach account and confirm the email.
9. Confirmation should return to Ground Control and activate Coach Hub without an operator-access error.

## Expected result

- No localhost redirect.
- No `ERR_CONNECTION_REFUSED`.
- Invitation changes from pending to accepted.
- The coach opens only the assigned team workspace.
