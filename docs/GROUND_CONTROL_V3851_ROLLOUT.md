# Ground Control v3.8.5.1 rollout and acceptance

## Installation

Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the fully extracted package.

The installer validates the payload, backs up affected files, runs lint, all regression tests and the production build, creates release evidence, commits the hotfix and pushes `staging`.

No Supabase migration is included.

## Staging acceptance

Test Saturday and Sunday using an unlocked schedule:

1. Press and release a fixture without moving it. The fixture drawer must open and no schedule change must be created.
2. Drag from the fixture name area rather than the grip. The fixture must move after the pointer travels beyond the threshold.
3. Drag from the six-dot grip. Behaviour must match whole-card dragging.
4. Move a fixture with a mouse and, where available, a touchscreen or touchpad.
5. Drop onto a valid pitch and time. The draft-change bar must appear.
6. Attempt a hard-clash move. The move must remain blocked and alternatives must appear.
7. Accept an advisory warning. The change must remain unpublished until saved.
8. Confirm Undo, Redo, Review changes, Discard and Save schedule.
9. Lock the schedule. The planner must show `Schedule locked — unlock it to move fixtures` and must not begin a drag.
10. Confirm the compact one-line lane layout and live weather readiness remain correct.

## Git and Vercel verification

```powershell
cd C:\Development\hsm-scheduler
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The final two hashes must match. The pushed commit should trigger the Vercel staging Preview deployment.
