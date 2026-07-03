# Admin and Support Tooling — Controlled Rollout

## Prerequisites

Confirm that migrations through the following file are already installed:

```text
202607030004_entitlements_subscriptions.sql
```

Your current Horwich St Mary’s workspace should load normally before starting.

## 1. Create a code checkpoint

From PowerShell:

```powershell
cd C:\Development\hsm-scheduler

git add .
git commit -m "Checkpoint before Daxora admin tooling"
```

## 2. Install the application patch

Extract `ground-control-admin-support-tooling.zip` directly into:

```text
C:\Development\hsm-scheduler
```

Choose **Replace files in the destination**.

Run:

```powershell
npm run check
npm run test:coverage
```

Expected validation:

```text
Test Files  19 passed
Tests       117 passed
Production build passed
0 lint errors
```

The existing non-blocking lint warnings and the Vite large-bundle warning may still appear.

## 3. Back up Supabase

Before changing the database, confirm that a current Supabase backup or suitable restore point exists.

Stop the development server with `Ctrl + C` while applying the migration.

## 4. Run migration 005

Open:

```text
Supabase → SQL Editor → New query
```

Copy and run the complete contents of:

```text
supabase\migrations\202607030005_admin_support_tooling.sql
```

A successful run should return without a SQL error.

## 5. Authorise your Daxora account as Platform Administrator

Platform users cannot elevate themselves from the Ground Control interface. The first administrator must be authorised deliberately in the Supabase SQL Editor.

Find your account UUID:

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Copy the UUID for your own Ground Control account. Replace both UUID placeholders below with that value:

```sql
insert into public.platform_support_staff (
  user_id,
  display_name,
  status,
  created_by,
  platform_role
)
values (
  'REPLACE-WITH-YOUR-AUTH-UUID',
  'Andrew Manville',
  'active',
  'REPLACE-WITH-YOUR-AUTH-UUID',
  'admin'
)
on conflict (user_id)
do update set
  display_name = excluded.display_name,
  status = 'active',
  platform_role = 'admin',
  updated_at = now();
```

Do not use a service-role key in the browser and do not add this UUID to application source code.

## 6. Restart Ground Control

```powershell
npm run dev
```

Sign in normally. A new navigation item should appear:

```text
Daxora Admin
```

The header should identify your internal role as **Platform Administrator**.

## 7. Safe first verification

Open **Daxora Admin** and confirm:

- Horwich St Mary’s appears in the club list.
- The current plan is Elite/Internal and billing exempt.
- Club, member, team, pitch and history counts look credible.
- Your current workspace still opens normally.
- The page clearly states that operational access requires owner approval.

Create a harmless support case for Horwich St Mary’s, add an internal note, then mark it resolved. Confirm the event appears in **Platform activity**.

Do not suspend the live Horwich workspace during the first verification.

## 8. Verify commercial controls carefully

The existing Horwich subscription should already be Elite/Internal. Do not change it merely to test the form.

For future pilot clubs, a Platform Administrator can manually set:

- Link, Core, Pro or Elite
- trial, active, grace, suspended, cancelled or internal status
- monthly, annual or manual billing interval
- trial/grace/period dates
- billing-exempt state

Every change requires a reason and is audited.

## 9. Verify support access separation

For a club where your Daxora account is not a member:

1. Open the club in Daxora Admin.
2. Confirm platform metadata is visible.
3. Press **Check support access**.
4. Confirm Ground Control refuses to open operational data without owner approval.
5. Have the club owner grant a time-limited support session from **Settings → Access & audit**.
6. Return to Daxora Admin and press **Open read-only workspace**.
7. Confirm the support banner is visible and editing is blocked.

The platform console must never grant this access itself.

## 10. Optional staging security proof

Do not run this against live production data as a routine test.

In a staging or local Supabase project, replace the UUID placeholders and run:

```text
supabase\tests\admin_support_tooling.sql
```

The script rolls back all of its changes. It proves that Support Operators cannot change plans or suspend clubs, while Platform Administrators can use the guarded actions.

## 11. Commit after verification

```powershell
git add src supabase tests docs PATCH_CONTENTS.md
git commit -m "Add Daxora admin and support tooling"
```

## Recovery

If the migration fails, copy the complete Supabase error before retrying. Do not run fragments repeatedly unless the error has been understood.

If the application patch causes a local problem before the migration is run:

```powershell
git reset --hard HEAD
```

Only use that command if the checkpoint commit was created and there are no later changes you need to retain.

## Next roadmap phase

After this phase is verified, move to:

```text
Billing and legal readiness → pilot-club preparation → paid launch
```

Change Display Name remains a separate core launch task.
