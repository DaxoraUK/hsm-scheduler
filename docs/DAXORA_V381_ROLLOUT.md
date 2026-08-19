# Daxora v3.8.1 rollout and acceptance

## Prerequisite

Deploy League Operations v3.8 Analytics and Reports before applying this package.

## Database

v3.8.1 is a front-end interaction and PWA identity release. It contains no Supabase migration and the installer does not run `supabase db push`.

## Automated installer

Extract the package fully and double-click:

`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

The installer targets `C:\Development\hsm-scheduler` by default and:

1. Verifies the `staging` branch and remote relationship.
2. Rejects unrelated working-tree or staged changes.
3. SHA-256 verifies the complete payload.
4. Backs up every affected file.
5. Copies and re-verifies the release.
6. Runs lint, all regression tests and the production build.
7. Commits only the v3.8.1 release files.
8. Generates commit-specific release evidence.
9. Pushes `staging` to GitHub.
10. Confirms local `HEAD` equals `origin/staging`.

A complete log is written to the Windows Desktop and the command window remains open on success or failure.

## Staging acceptance

### Dialogues

- Open a destructive League Manager action such as deleting a draft schedule or deactivating an official.
- Confirm the dialogue uses Daxora branding rather than an Edge popup.
- Confirm Cancel leaves the record unchanged.
- Confirm the action button shows precise wording rather than a generic OK label.
- Test Escape and backdrop cancellation.
- Test a guided text response such as rejecting a result or fixture-change request.

### Toasts and activity centre

- Trigger a successful save and confirm the Daxora toast styling.
- Trigger or simulate an error and confirm it appears in the activity centre after the toast closes.
- Open the header bell and test unread count, mark-all-read, dismissal and clear-read.
- Open a retained item with a workspace link and confirm routing works.
- Open a second tab and confirm read/dismiss changes synchronise.

### PWA identity

- In Edge, inspect the install-app option and confirm the application name is Daxora Ground Control.
- Confirm the installed shortcut/taskbar identity uses the Daxora icon.
- Confirm the standalone window uses the dark Daxora theme colour.

### Regression boundaries

- Close or reload a tab while a form has unsaved work. A browser-owned warning is expected and cannot be Daxora styled.
- Confirm ordinary internal navigation uses the Daxora unsaved-change dialogue.
- Confirm no action silently falls back to a generic browser prompt.

### Release and Vercel

Run or verify:

```powershell
cd C:\Development\hsm-scheduler
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The hashes must match. Then confirm a Vercel Preview deployment exists for the same `staging` commit.

## Rollback

The installer records a timestamped backup under:

`C:\Development\hsm-scheduler\.daxora-backups\daxora-v381-*`

Before the GitHub push, a failed validation restores the previous files and removes any local release commit. After a successful push, rollback should be performed through a normal Git revert so history remains auditable.
