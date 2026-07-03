# Ground Control roles, audit and support rollout

This release must be installed as one controlled application-and-database change. The current client does not know about the new audited write RPCs, while the new client requires them. Do not leave either mismatched version running for normal use.

## 1. Install and validate the application patch

From the local project:

```powershell
cd C:\Development\hsm-scheduler
git add .
git commit -m "Checkpoint before roles and audit security"
```

Extract the supplied patch into the project root and replace the included files. Do not copy `.env`, `node_modules`, `dist` or `.git` from another project.

Run:

```powershell
npm install
npm run check
```

Do not start normal use yet. Stop any running Vite server with `Ctrl + C` before changing Supabase.

## 2. Back up Supabase

Create a current backup or confirm an appropriate restore point/point-in-time recovery window exists.

The migration is transactional. A SQL error during the migration rolls that migration back, but after the release is used the correct rollback is restoring the pre-release database backup—not weakening RLS or restoring direct browser writes.

## 3. Apply the database migration

In the Supabase project, open **SQL Editor → New query**. Run the complete contents of:

```text
supabase/migrations/202607030002_roles_audit_support.sql
```

Expected result: the query completes successfully with no uncommitted transaction or SQL error.

## 4. Restart Ground Control

From the project root:

```powershell
npm run dev
```

Sign in with the existing Horwich St Mary's owner account.

Open the profile menu and select **Access & audit**, or open:

```text
Settings → Access & audit
```

The current account should appear as **Club Owner**. Do not alter ownership during the first verification.

## 5. Verify the role infrastructure

Run in Supabase SQL Editor:

```sql
select membership.club_id,
       club.name,
       profile.email,
       profile.display_name,
       membership.role,
       membership.status
from public.club_memberships membership
join public.clubs club on club.id = membership.club_id
left join public.user_profiles profile on profile.id = membership.user_id
order by club.name, membership.role;
```

Confirm the owner is present and active.

Verify the new tables and RLS state:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'user_profiles', 'club_invitations', 'platform_support_staff',
    'support_access_sessions', 'audit_events'
  )
order by relname;
```

Every listed table should show RLS enabled. The new security tables and audit rows are accessed through RPCs rather than direct browser table writes.

## 6. Test a normal audited save

In Ground Control:

1. Change a harmless club setting.
2. Save it.
3. Open **Access & audit**.
4. Confirm a new database-sourced audit event appears with your account and owner role.
5. Publish a test matchweek and confirm **Matchweek published** appears in the audit history.

The save and its audit event are now part of the same database transaction.

## 7. Test a club invitation

Use a separate test email/account, not the owner account.

1. In **Access & audit**, enter the exact email address.
2. Select Viewer or Scheduler.
3. Create the invitation.
4. Copy the single-use link.
5. Open the link in a private browser window.
6. Create/sign in to the account using the exact invited email.
7. Confirm the club opens with the assigned role.

The raw token is shown only when the invitation is created. Supabase stores its hash, not the reusable link value. Revoke the test member after verification if the account is not required.

## 8. Register a dedicated Daxora support account

Support must use a separate Auth account that is not a member of the club. Never register the club owner account as support.

Create or sign up the dedicated support account, then find its UUID:

```sql
select id, email, created_at
from auth.users
where lower(email) = lower('REPLACE-WITH-SUPPORT-EMAIL');
```

Register that exact account as platform support:

```sql
insert into public.platform_support_staff (
  user_id,
  display_name,
  status,
  created_by
)
values (
  'REPLACE-WITH-SUPPORT-USER-UUID',
  'Daxora Support',
  'active',
  'REPLACE-WITH-OWNER-USER-UUID'
)
on conflict (user_id)
do update set
  display_name = excluded.display_name,
  status = 'active',
  updated_at = now();
```

This operator-only registration is intentional. A club owner can approve a registered support identity, but cannot turn an arbitrary email into platform support.

## 9. Verify safe support access

From the owner account:

1. Enter the registered support email.
2. Select 30 minutes.
3. Enter a specific reason.
4. Grant access.

Sign in separately as the support account. Confirm:

- The club appears as **Daxora Support** access.
- A prominent read-only support banner is visible.
- The expiry time is shown.
- Settings and audit navigation are unavailable.
- Matchday controls cannot be used.
- Direct database writes are rejected by RPC permissions/RLS.
- **End support session** closes the workspace.

Repeat once and revoke the session from the owner screen. The support client rechecks every 30 seconds and whenever the browser regains focus, so the workspace should close promptly.

## 10. Non-production SQL proofs

Do not use real operational accounts for these scripts. In a staging/local Supabase project with two test Auth users, replace the placeholder UUIDs and run:

```text
supabase/tests/rls_isolation.sql
supabase/tests/roles_permissions_support.sql
```

Both scripts create test data inside a transaction and finish with `ROLLBACK`. They prove cross-club isolation, audited RPC-only writes, role boundaries, read-only support, support revocation and server-side role attribution.

## 11. Commit the release

After local and live verification:

```powershell
git add src supabase tests docs
git commit -m "Add roles trusted audit logs and safe support access"
```

## Failure handling

- If `npm run check` fails, do not run the migration. Keep the final error output.
- If the SQL migration fails, its transaction should roll back. Save the complete SQL error before retrying.
- If the migration succeeds but the old dev server is still running, stop it and start the patched application immediately.
- If the app reports a missing RPC, confirm migration `202607030002_roles_audit_support.sql` completed in the same Supabase project referenced by `.env.local`.
- If a support email is rejected, confirm it exists in `auth.users`, has a matching `user_profiles` row, is active in `platform_support_staff`, and is not an active club member.
- Never solve an access problem by adding permissive RLS policies, restoring direct table writes or placing a service-role key in `.env.local`.

## Deliberately deferred

- Change Display Name/profile editing
- Automated invitation emails through a server-side function
- Platform-wide support staff administration UI
- Mobile navigation replacement
- Reports v1 and Analytics v1 completion
