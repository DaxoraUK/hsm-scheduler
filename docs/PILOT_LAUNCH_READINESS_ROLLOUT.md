# Pilot and Launch Readiness Rollout

## 1. Create a checkpoint

```powershell
cd C:\Development\hsm-scheduler
git add .
git commit -m "Checkpoint before pilot and launch readiness"
```

## 2. Install the patch

Extract the supplied archive into the project root and replace the included files.

## 3. Validate locally

```powershell
npm run check
npm run test:coverage
```

## 4. Apply migration 007

In Supabase SQL Editor, run:

```text
supabase/migrations/202607030007_pilot_launch_readiness.sql
```

Do not run the staging security proof against production.

## 5. Restart Ground Control

```powershell
npm run dev
```

## 6. Verify profile editing

1. Open the header account menu.
2. Select **My profile**.
3. Change the display name.
4. Confirm the name updates immediately.
5. Sign out and in again and confirm it remains changed.
6. Confirm Access & Audit member lists show the same name.

## 7. Verify Daxora Pilot & Launch

Open **Daxora Admin → Pilot & launch**.

- Confirm the seeded launch gates appear.
- Add Horwich St Mary's as a candidate pilot only if that reflects the real rollout decision.
- Do not mark a gate Ready without evidence.
- Keep `launch_signoff` blocked until all accepted risks are recorded.

## 8. Verify telemetry safely

Use a development-only deliberate error or the browser console in a non-production environment. Confirm a sanitised event appears under **Unresolved client events** and can be resolved by platform staff.

Do not submit real credentials, fixture details or personal data in test error messages.

## 9. Configure release metadata

Copy `.env.production.example` into the production host's environment-variable settings and replace placeholders. Do not commit a real `.env.production` file.

## 10. Complete external launch gates

Follow:

- `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`
- `docs/PILOT_OPERATIONS_RUNBOOK.md`
- `docs/INCIDENT_RESPONSE_RUNBOOK.md`

## 11. Commit after verification

```powershell
git add src supabase tests docs .env.production.example
git commit -m "Add pilot operations launch gates telemetry and user profiles"
```
