# Ground Control customer onboarding rollout

This release adds a new table and four database RPCs. Install the application patch first, validate it, then apply the migration while the development server is stopped.

## 1. Create a checkpoint

From the local project:

```powershell
cd C:\Development\hsm-scheduler
git add .
git commit -m "Checkpoint before customer onboarding"
```

Extract the supplied patch into the project root and replace the included files. Do not copy `.env`, `node_modules`, `dist` or `.git` from another project.

Run:

```powershell
npm run check
```

Do not continue to Supabase unless the command returns successfully.

## 2. Back up Supabase

Confirm a current backup, restore point or appropriate point-in-time recovery window exists.

The migration runs inside one transaction. A SQL error during installation should roll it back, but after the wizard has been used, recovery should use the pre-release backup rather than weakening RLS or deleting onboarding records manually.

## 3. Stop Ground Control

If Vite is running, stop it with:

```text
Ctrl + C
```

## 4. Apply the migration

In the Ground Control Supabase project, open **SQL Editor → New query**.

Open this local file:

```text
supabase/migrations/202607030003_customer_onboarding.sql
```

Copy the complete contents into SQL Editor and press **Run**.

Expected result: the transaction completes without a SQL error.

## 5. Verify the database objects

Run in Supabase SQL Editor:

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relname = 'club_onboarding';
```

Both RLS columns should be `true`.

Confirm the existing club was protected from forced onboarding:

```sql
select club.name,
       onboarding.status,
       onboarding.required,
       onboarding.current_step,
       onboarding.completed_at
from public.clubs club
join public.club_onboarding onboarding on onboarding.club_id = club.id
order by club.name;
```

Horwich St Mary's FC should show:

```text
status: complete
required: false
current_step: 7
```

## 6. Restart Ground Control

From the project root:

```powershell
npm run dev
```

Sign in as the existing club owner. The normal workspace should open; the wizard must not be forced over the current club.

## 7. Test a voluntary re-run safely

Open:

```text
Settings → Setup wizard
```

Confirm the page shows the setup as complete, then select **Run setup wizard again**.

Verify:

1. Existing club, venue, teams, pitches and scheduling values are prefilled.
2. You can move between steps.
3. Select **Finish later**, reopen the wizard and confirm it resumes at the saved step.
4. Fixed core modules cannot be toggled off.
5. Optional midweek and parking modules can be changed.
6. An invalid postcode, scheduling window or duplicate pitch ID blocks completion.

For the first live test, make no material changes. Review the final screen and complete the wizard using the current values.

## 8. Verify completion

After completion, confirm Ground Control reopens normally and that fixtures, teams, pitches, parking, weather and settings remain intact.

Run:

```sql
select status,
       required,
       current_step,
       completed_steps,
       started_at,
       completed_at,
       updated_by
from public.club_onboarding
where club_id = (
  select id from public.clubs where name = 'Horwich St Mary''s FC' limit 1
);
```

Then verify the trusted audit event:

```sql
select occurred_at, action, entity_type, actor_user_id, metadata
from public.audit_events
where action in ('onboarding.start', 'onboarding.restart', 'onboarding.complete')
order by occurred_at desc
limit 10;
```

The completion event should be database-sourced and contain team and pitch counts.

## 9. New-club acceptance test

Do this only in a staging project or with a disposable test club.

A newly created club should:

- receive `status = pending` and `required = true` automatically;
- open the onboarding wizard after workspace hydration;
- contain no Horwich-specific postcode, venue, teams or pitches;
- prevent dismissal until valid setup is completed;
- permit only an owner or administrator to save or complete setup;
- create club, team and pitch configuration atomically on completion.

Do not create a disposable club in the production project merely to test this unless you already have a safe cleanup process.

## 10. Commit the release

After local and live verification:

```powershell
git add src supabase tests docs
git commit -m "Add secure customer onboarding wizard"
```

## Failure handling

- If `npm run check` fails, do not run the migration. Keep the final error output.
- If the SQL migration fails, save the full Supabase error before retrying.
- If Ground Control reports a missing onboarding RPC, confirm `202607030003_customer_onboarding.sql` ran in the same project used by `.env.local`.
- If the existing club is forced into onboarding, do not complete it blindly. Check the `club_onboarding` row and confirm the migration seeded existing clubs as complete.
- If progress cannot save, confirm the signed-in user is an active owner or administrator and that RLS remains forced.
- Never add permissive direct-write policies or a service-role key to the browser to bypass an onboarding error.
