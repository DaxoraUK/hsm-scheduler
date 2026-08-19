# Daxora Ground Control v3.10.4 Rollout

## Installation

Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the fully extracted release folder.

The installer targets `C:\Development\hsm-scheduler`, creates a timestamped backup, installs exact replacement files, validates hashes, runs focused and full regression tests, runs the production build, dry-runs and applies the linked Supabase migration, commits only the v3.10.4 files and pushes `staging`.

## Post-deployment checks

### 1. Coach Hub recovery

- Sign in as the activated coach.
- Open each Coach Hub tab.
- Confirm the application-wide recovery page no longer appears.
- If a section fault is deliberately reproduced, confirm the local Coach Hub retry panel appears instead.

### 2. Request editing

- Submit a new training request.
- Open Requests and select **Edit request**.
- Change the date, time, pitch or notes.
- Save and confirm the same request updates rather than a duplicate appearing.
- Confirm the request remains editable while `submitted` or `needs information`.

### 3. Pitch selector

- Confirm the request form shows the club’s saved pitches.
- Confirm the coach is no longer asked to type a pitch name.
- Select Pitch 4 and verify its capacity note is shown.

### 4. Training capacity

- As an administrator, open Settings → Pitches.
- Set Pitch 4 **Simultaneous training teams** to 2 and save.
- Create or approve two overlapping training bookings on Pitch 4; both should succeed.
- Attempt a third overlapping training booking; it should be blocked.
- Attempt an overlapping friendly; it should be blocked.

### 5. Live-style conversation

- Open the same request conversation in an administrator browser and coach browser.
- Send a message from one browser.
- Leave the other conversation open.
- Confirm the new message appears automatically within approximately six seconds without a loading flash.
- Confirm focus switching triggers an immediate refresh.

## Rollback

The installer stores source backups under:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.4-<timestamp>`

If installation fails before the migration is applied, the affected source files are restored automatically. If the database migration has already been applied, the installer retains the compatible source files and backup rather than rolling the application back to an incompatible state.
