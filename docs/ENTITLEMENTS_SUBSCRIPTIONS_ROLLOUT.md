# Entitlements and Subscription Rollout

## Prerequisites

Apply this only after the earlier migrations are live through:

```text
202607030003_customer_onboarding.sql
```

The current club should already open correctly under multi-club RLS, roles and onboarding.

## 1. Create a local checkpoint

From PowerShell:

```powershell
cd C:\Development\hsm-scheduler
git add .
git commit -m "Checkpoint before subscription entitlements"
```

## 2. Install the application patch

Extract `ground-control-entitlements-subscriptions.zip` directly into:

```text
C:\Development\hsm-scheduler
```

Choose **Replace files in the destination**.

## 3. Run the local release gate

```powershell
npm run check
```

Expected result for this patch:

```text
Test Files  16 passed
Tests       103 passed
Production build passed
```

Existing lint warnings may still be printed, but there should be no lint errors.

## 4. Back up Supabase

Confirm a recent backup or suitable restore point before changing the production schema. Stop the local development server while the migration is being applied.

## 5. Run the migration

In **Supabase → SQL Editor → New query**, open and run the complete contents of:

```text
supabase\migrations\202607030004_entitlements_subscriptions.sql
```

The migration is transactional.

## 6. Restart Ground Control

```powershell
npm run dev
```

Sign in normally and open:

```text
Settings → Plan & subscription
```

## 7. Verify the current club

For the existing Horwich St Mary's workspace, the page should show:

- Plan: **Elite**
- Status: **Internal**
- Billing: **Billing exempt**
- Workspace access: **Full access**
- Unlimited plan limits

The migration must not restrict or charge the existing pilot workspace.

Check that the plan catalogue uses **Link**. The retired “Club Link” name should not appear in the application.

Also verify that Operations, Analytics, Reports, Settings, teams, pitches and existing history remain available.

## 8. Optional database enforcement proof

Use this only in a staging/local Supabase project or during a controlled test window.

Open:

```text
supabase\tests\entitlements_subscriptions.sql
```

Replace the two placeholder UUIDs with two real users from `auth.users`, then run the complete script in SQL Editor. It runs inside a transaction and ends with `rollback;`.

The proof checks:

- new-club Core trial creation
- owner denial from platform plan assignment
- authorised platform-staff assignment
- Link matchday-publishing denial
- Link team, venue and user limits
- Core matchday enablement
- suspended-club read-only enforcement

## 9. Commit the phase

After local and Supabase verification:

```powershell
git add src supabase tests docs
git commit -m "Add subscription entitlements and plan enforcement"
```

## Operating rules before billing is connected

- Do not add a service-role or secret key to the browser.
- Do not let club owners update `club_subscriptions` directly.
- Do not manually edit plan rows casually in production.
- Plan changes should use the guarded platform RPC and include a meaningful reason.
- Live payments, checkout and webhook status remain out of scope until the billing phase.
