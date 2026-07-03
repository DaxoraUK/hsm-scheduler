# Ground Control multi-club security rollout

This change converts the original single-club prototype into an authenticated, club-scoped Supabase model. It must be installed as a controlled database-and-application release. Do not expose the app between the database migration and the matching frontend deployment.

## What this release protects

- Every operational row belongs to a `club_id`.
- Users reach an active club through an active `club_memberships` row. Suspended or closed clubs are denied.
- Supabase Row Level Security independently enforces the membership boundary.
- The browser sends the public anon key as `apikey` and the signed-in user's JWT as `Authorization`.
- Collection replacement deletes only the selected club's rows and runs transactionally.
- Audit actor IDs come from `auth.uid()`, not from browser-supplied names or email addresses.
- Browser caches are separated by user and club.
- The one-time legacy workspace claim requires an explicit, expiring allowlist entry.

## Release order

### 1. Prepare a maintenance window

Temporarily prevent normal use of the current app. Also disable public sign-ups in Supabase Authentication until the first workspace has been claimed.

Create a database backup or confirm point-in-time recovery is available. This migration changes primary keys and ownership columns; the safe rollback is a database restore, not an improvised reverse migration.

### 2. Identify the existing owner account

In the Supabase SQL Editor, run:

```sql
select id, email, created_at
from auth.users
order by created_at;
```

Copy the UUID for the account that must own the existing Horwich St Mary's workspace.

### 3. Run the migration

Run the complete contents of:

```text
supabase/migrations/202607030001_multi_club_rls.sql
```

The migration creates the organisation, club, membership, audit and RLS structure. Existing operational rows are retained with a temporary unassigned `club_id`; RLS makes them invisible until the authorised owner claims them.

### 4. Authorise the one-time owner claim

Replace the UUID below with the owner account UUID copied in step 2:

```sql
insert into public.workspace_bootstrap_authorisations (user_id, expires_at)
values ('REPLACE-WITH-OWNER-USER-UUID', now() + interval '30 minutes')
on conflict (user_id)
do update set expires_at = excluded.expires_at;
```

This allowlist is deliberately short-lived. It prevents a random authenticated account from claiming the original data while the database contains no club.

### 5. Configure and deploy the application

The deployment environment—not each club—must contain:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

The anon key is the public application identifier. It is not used as the user's identity and does not replace RLS. Never put a service-role key in a Vite variable or browser bundle.

Install the matching frontend patch and run:

```powershell
npm install
npm run check
```

Then deploy the built application while the maintenance window remains active.

### 6. Claim the legacy workspace

Sign in using the authorised owner account. Ground Control should show **Secure the existing workspace**.

Confirm the club name and use the one-time action. The transaction will:

1. Create the organisation and club.
2. Make the signed-in account the club owner.
3. Assign every unowned legacy row to that club.
4. Make `club_id` mandatory on all operational tables.
5. Record the bootstrap audit event.
6. Consume the allowlist entry.

If the screen says **Bootstrap authorisation required**, repeat step 4 for the correct signed-in user UUID and select **Check authorisation again**.

### 7. Verify the live club

Run these checks in Supabase:

```sql
select club.id, club.name, membership.user_id, membership.role, membership.status
from public.clubs club
join public.club_memberships membership on membership.club_id = club.id;
```

```sql
select 'history' as table_name, count(*) as rows, count(*) filter (where club_id is null) as unowned from public.history
union all
select 'refs', count(*), count(*) filter (where club_id is null) from public.refs
union all
select 'team_config', count(*), count(*) filter (where club_id is null) from public.team_config
union all
select 'club_config', count(*), count(*) filter (where club_id is null) from public.club_config
union all
select 'pitches', count(*), count(*) filter (where club_id is null) from public.pitches
union all
select 'pitch_closures', count(*), count(*) filter (where club_id is null) from public.pitch_closures;
```

Every `unowned` value must be `0`.

Confirm RLS is enabled and forced:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in (
    'organisations', 'clubs', 'club_memberships',
    'history', 'refs', 'team_config', 'club_config',
    'pitches', 'pitch_closures', 'audit_events', 'audit_log'
  )
order by relname;
```

Run `supabase/tests/rls_isolation.sql` in a non-production project using two test Auth users. The script proves cross-club select, insert, update, delete and membership isolation, creates all test records inside a transaction, and rolls everything back.

### 8. Application checks

Complete these checks before reopening access:

- Sign in and confirm the correct club appears in the header.
- Confirm club details, teams, pitches, referees, history and closures load.
- Save one club setting and reload the browser.
- Save a matchweek and confirm only one club-scoped history row is written.
- Sign out and confirm the protected workspace closes immediately.
- Use a second test user without membership and confirm it sees **No club access found**.
- With two test clubs, confirm switching clubs shows a loading gate rather than briefly displaying the previous club's data.
- Confirm no network request uses the anon key as the bearer token.

## Recovery and failure handling

If the migration fails, the surrounding transaction rolls back. Save the SQL error before retrying.

If the migration succeeds but the owner claim has not run, the legacy rows remain preserved but hidden by RLS. Fix the owner allowlist and retry the claim; do not add permissive policies.

If the owner claim fails partway through, its transaction rolls back. The allowlist entry remains available until expiry.

After the workspace has been claimed and used, rollback requires restoring the pre-release database backup or point-in-time snapshot. Do not drop `club_id` or disable RLS to force the old client to work.

## Deliberately deferred to the next phase

This release establishes the secure role model but does not yet provide the full UI for invitations, membership management, role changes, support impersonation or audit-log review. Those belong to the next roadmap phase: **Roles, permissions, audit logs and support impersonation**.

Direct membership inserts, updates and deletes are intentionally unavailable to browser clients in this release. Use only controlled SQL in a non-production test project until the dedicated role-management RPCs and owner-protection rules are delivered.
