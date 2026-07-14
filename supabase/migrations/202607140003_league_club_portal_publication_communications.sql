-- Daxora League Operations v3.3
-- Club portal, controlled fixture publication, acknowledgements, change requests,
-- communications, calendar feeds and Full-Time reconciliation support.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.league_club_memberships (
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'club_viewer' check (role in ('club_secretary', 'team_contact', 'club_viewer')),
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, parent_club_id, user_id)
);

create table if not exists public.league_club_invitations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete cascade,
  email text not null,
  role text not null default 'club_secretary' check (role in ('club_secretary', 'team_contact', 'club_viewer')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (position('@' in email) > 1),
  check (expires_at > created_at)
);

create table if not exists public.league_publications (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete restrict,
  schedule_version_id uuid references public.league_schedule_versions(id) on delete restrict,
  scope_type text not null default 'league' check (scope_type in ('league', 'division', 'cup')),
  scope_id uuid,
  title text not null check (length(trim(title)) between 2 and 180),
  notes text,
  status text not null default 'published' check (status in ('draft', 'published', 'superseded', 'withdrawn')),
  summary jsonb not null default '{}'::jsonb,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_publication_fixtures (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.league_publications(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  target_type text not null check (target_type in ('schedule_entry', 'cup_tie')),
  target_id uuid not null,
  parent_club_ids uuid[] not null default '{}'::uuid[],
  snapshot jsonb not null,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  unique (publication_id, target_type, target_id)
);

create table if not exists public.league_fixture_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.league_publications(id) on delete cascade,
  publication_fixture_id uuid not null references public.league_publication_fixtures(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete cascade,
  status text not null default 'awaiting' check (status in ('awaiting', 'received', 'ground_confirmed', 'kickoff_confirmed', 'disputed', 'unable_to_fulfil')),
  notes text,
  responded_by uuid references auth.users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_fixture_id, parent_club_id)
);

create table if not exists public.league_fixture_change_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  parent_club_id uuid not null references public.league_parent_clubs(id) on delete cascade,
  publication_id uuid references public.league_publications(id) on delete set null,
  target_type text not null check (target_type in ('schedule_entry', 'cup_tie')),
  target_id uuid not null,
  request_type text not null check (request_type in ('date_change', 'kickoff_change', 'venue_change', 'postponement', 'ground_unavailable', 'team_withdrawal', 'cup_conflict')),
  requested_date date,
  requested_kick_off time,
  requested_venue_id uuid references public.league_venues(id) on delete restrict,
  reason text not null check (length(trim(reason)) between 3 and 1000),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
  league_response text,
  resolution_version_id uuid references public.league_schedule_versions(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_communications (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('club', 'team', 'official', 'league_member', 'all_clubs')),
  recipient_id uuid,
  recipient_label text not null,
  recipient_email text,
  template_key text not null default 'custom',
  subject text not null check (length(trim(subject)) between 2 and 220),
  body text not null check (length(trim(body)) between 2 and 10000),
  channel text not null default 'manual' check (channel in ('manual', 'email')),
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  requires_acknowledgement boolean not null default false,
  source_type text,
  source_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  sent_at timestamptz,
  delivery_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.league_calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  scope_type text not null check (scope_type in ('league', 'division', 'club', 'team', 'venue', 'cup', 'official')),
  scope_id uuid,
  label text not null,
  token_hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists league_club_memberships_user_idx on public.league_club_memberships(user_id, status, league_id);
create index if not exists league_club_invitations_lookup_idx on public.league_club_invitations(lower(email), status, expires_at);
create index if not exists league_publications_scope_idx on public.league_publications(league_id, season_id, scope_type, scope_id, published_at desc);
create unique index if not exists league_publications_one_active_scope_idx
  on public.league_publications(league_id, season_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'published';
create index if not exists league_publication_fixtures_lookup_idx on public.league_publication_fixtures(publication_id, target_type, target_id);
create index if not exists league_acknowledgements_club_idx on public.league_fixture_acknowledgements(league_id, parent_club_id, status, created_at desc);
create index if not exists league_change_requests_queue_idx on public.league_fixture_change_requests(league_id, status, created_at desc);
create unique index if not exists league_fixture_change_requests_one_open_idx
  on public.league_fixture_change_requests(league_id, parent_club_id, target_type, target_id)
  where status in ('submitted', 'under_review');
create index if not exists league_communications_queue_idx on public.league_communications(league_id, status, created_at desc);
create index if not exists league_calendar_tokens_lookup_idx on private.league_calendar_tokens(token_hash) where revoked_at is null;

-- Consistent update timestamps.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'league_club_memberships', 'league_club_invitations', 'league_publications',
    'league_fixture_acknowledgements', 'league_fixture_change_requests', 'league_communications'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      table_name || '_touch_updated_at', table_name
    );
  end loop;
end $$;

-- All browser access is through controlled functions.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'league_club_memberships', 'league_club_invitations', 'league_publications',
    'league_publication_fixtures', 'league_fixture_acknowledgements',
    'league_fixture_change_requests', 'league_communications'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

alter table private.league_calendar_tokens enable row level security;
alter table private.league_calendar_tokens force row level security;
revoke all on table private.league_calendar_tokens from anon, authenticated;

create or replace function private.current_league_club_id(target_league_id uuid, actor_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select membership.parent_club_id
  from public.league_club_memberships membership
  where membership.league_id = target_league_id
    and membership.user_id = actor_id
    and membership.status = 'active'
  order by case membership.role when 'club_secretary' then 0 when 'team_contact' then 1 else 2 end, membership.created_at
  limit 1;
$$;

create or replace function private.current_league_role(target_league_id uuid, actor_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (
      select membership.role
      from public.league_memberships membership
      where membership.league_id = target_league_id
        and membership.user_id = actor_id
        and membership.status = 'active'
      limit 1
    ),
    (
      select membership.role
      from public.league_club_memberships membership
      where membership.league_id = target_league_id
        and membership.user_id = actor_id
        and membership.status = 'active'
      order by case membership.role when 'club_secretary' then 0 when 'team_contact' then 1 else 2 end
      limit 1
    ),
    (
      select case when staff.platform_role = 'admin' then 'platform_admin' else 'platform_support' end
      from public.platform_support_staff staff
      where staff.user_id = actor_id and staff.status = 'active'
      limit 1
    ),
    'none'
  );
$$;

create or replace function public.can_view_league_club_portal(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.league_club_memberships membership
    join public.leagues league on league.id = membership.league_id
    where membership.league_id = target_league_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and league.status <> 'closed'
  );
$$;

-- Include club-portal users in product access without granting the full league workspace.
create or replace function public.list_accessible_leagues()
returns table (
  league_id uuid,
  league_name text,
  league_slug text,
  product_status text,
  league_status text,
  country_code text,
  governing_body text,
  timezone text,
  access_role text,
  read_only boolean
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  platform_access boolean := private.is_active_platform_staff(actor_id);
  platform_admin boolean := private.is_platform_admin(actor_id);
begin
  if actor_id is null then raise exception 'Sign in to access League Manager' using errcode = '42501'; end if;

  return query
  with access_rows as (
    select
      league.id as league_id,
      league.name as league_name,
      league.slug as league_slug,
      league.product_status,
      league.status as league_status,
      league.country_code,
      league.governing_body,
      league.timezone,
      coalesce(membership.role, case when platform_admin then 'platform_admin' else 'platform_support' end) as access_role,
      case when membership.role in ('owner', 'admin', 'fixtures', 'officials') or platform_admin then false else true end as read_only,
      0 as priority
    from public.leagues league
    left join public.league_memberships membership
      on membership.league_id = league.id and membership.user_id = actor_id and membership.status = 'active'
    where league.status <> 'closed' and (platform_access or membership.user_id is not null)

    union all

    select
      league.id,
      league.name,
      league.slug,
      league.product_status,
      league.status,
      league.country_code,
      league.governing_body,
      league.timezone,
      club_membership.role,
      club_membership.role = 'club_viewer',
      1
    from public.leagues league
    join public.league_club_memberships club_membership
      on club_membership.league_id = league.id
     and club_membership.user_id = actor_id
     and club_membership.status = 'active'
    where league.status <> 'closed'
  )
  select chosen.league_id,
    chosen.league_name,
    chosen.league_slug,
    chosen.product_status,
    chosen.league_status,
    chosen.country_code,
    chosen.governing_body,
    chosen.timezone,
    chosen.access_role,
    chosen.read_only
  from (
    select distinct on (access_rows.league_id)
      access_rows.league_id,
      access_rows.league_name,
      access_rows.league_slug,
      access_rows.product_status,
      access_rows.league_status,
      access_rows.country_code,
      access_rows.governing_body,
      access_rows.timezone,
      access_rows.access_role,
      access_rows.read_only,
      access_rows.priority
    from access_rows
    order by access_rows.league_id, access_rows.priority
  ) chosen
  order by chosen.league_name;
end;
$$;

create or replace function public.create_league_club_invitation(
  target_league_id uuid,
  target_parent_club_id uuid,
  invitation_email text,
  invitation_role text default 'club_secretary',
  expires_in_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_email text := lower(trim(coalesce(invitation_email, '')));
  safe_role text := lower(trim(coalesce(invitation_role, 'club_secretary')));
  raw_token text := encode(gen_random_bytes(24), 'hex');
  invitation_id uuid;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email is required' using errcode = '22023'; end if;
  if safe_role not in ('club_secretary', 'team_contact', 'club_viewer') then raise exception 'Unsupported club role' using errcode = '22023'; end if;
  if not exists (select 1 from public.league_parent_clubs club where club.id = target_parent_club_id and club.league_id = target_league_id) then raise exception 'Club not found' using errcode = 'P0002'; end if;

  update public.league_club_invitations
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where league_id = target_league_id and parent_club_id = target_parent_club_id and lower(email) = safe_email and status = 'pending';

  insert into public.league_club_invitations (
    league_id, parent_club_id, email, role, token_hash, status, invited_by, expires_at
  ) values (
    target_league_id, target_parent_club_id, safe_email, safe_role,
    encode(digest(raw_token, 'sha256'), 'hex'), 'pending', actor_id,
    now() + make_interval(days => greatest(1, least(coalesce(expires_in_days, 14), 30)))
  ) returning id into invitation_id;

  perform private.write_league_audit(target_league_id, 'league.club_invitation_created', 'club_invitation', invitation_id, jsonb_build_object('club_id', target_parent_club_id, 'email', safe_email, 'role', safe_role));
  return jsonb_build_object('id', invitation_id, 'token', raw_token, 'email', safe_email, 'role', safe_role, 'parent_club_id', target_parent_club_id);
end;
$$;

create or replace function public.accept_league_club_invitation(invitation_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  invitation public.league_club_invitations%rowtype;
  actor_email text;
begin
  if actor_id is null then raise exception 'Sign in to accept the club invitation' using errcode = '42501'; end if;
  select lower(coalesce(profile.email, '')) into actor_email from public.user_profiles profile where profile.id = actor_id;
  select * into invitation
  from public.league_club_invitations row_value
  where row_value.token_hash = encode(digest(trim(coalesce(invitation_token, '')), 'sha256'), 'hex')
  for update;
  if invitation.id is null then raise exception 'Club invitation not found' using errcode = 'P0002'; end if;
  if invitation.status <> 'pending' or invitation.expires_at <= now() then raise exception 'Club invitation has expired or is no longer available' using errcode = '42501'; end if;
  if actor_email <> lower(invitation.email) then raise exception 'Sign in using the invited email address' using errcode = '42501'; end if;

  insert into public.league_club_memberships (league_id, parent_club_id, user_id, role, status, created_by)
  values (invitation.league_id, invitation.parent_club_id, actor_id, invitation.role, 'active', invitation.invited_by)
  on conflict (league_id, parent_club_id, user_id) do update set role = excluded.role, status = 'active', updated_at = now();

  update public.league_club_invitations
  set status = 'accepted', accepted_by = actor_id, accepted_at = now(), updated_at = now()
  where id = invitation.id;
  perform private.write_league_audit(invitation.league_id, 'league.club_invitation_accepted', 'club_invitation', invitation.id, jsonb_build_object('club_id', invitation.parent_club_id, 'role', invitation.role));
  return jsonb_build_object('league_id', invitation.league_id, 'parent_club_id', invitation.parent_club_id, 'role', invitation.role);
end;
$$;

create or replace function public.revoke_league_club_invitation(target_league_id uuid, target_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  update public.league_club_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
  where id = target_invitation_id and league_id = target_league_id and status = 'pending';
  if not found then raise exception 'Pending club invitation not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.club_invitation_revoked', 'club_invitation', target_invitation_id, '{}'::jsonb);
end;
$$;

create or replace function public.remove_league_club_member(target_league_id uuid, target_parent_club_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode = '42501'; end if;
  update public.league_club_memberships set status = 'revoked', updated_at = now()
  where league_id = target_league_id and parent_club_id = target_parent_club_id and user_id = target_user_id and status <> 'revoked';
  if not found then raise exception 'Club portal member not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.club_member_removed', 'club_member', target_user_id, jsonb_build_object('club_id', target_parent_club_id));
end;
$$;

create or replace function private.publication_scope_matches(
  scope_type text,
  scope_id uuid,
  fixture_division_id uuid,
  fixture_cup_id uuid
)
returns boolean
language sql
immutable
as $$
  select scope_type = 'league'
    or (scope_type = 'division' and scope_id = fixture_division_id)
    or (scope_type = 'cup' and scope_id = fixture_cup_id);
$$;

create or replace function public.publish_league_fixture_release(
  target_league_id uuid,
  target_schedule_version_id uuid,
  target_scope_type text default 'league',
  target_scope_id uuid default null,
  publication_title text default null,
  publication_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  version_row public.league_schedule_versions%rowtype;
  safe_scope text := lower(trim(coalesce(target_scope_type, 'league')));
  new_publication_id uuid;
  fixture_count integer := 0;
  club_count integer := 0;
  publication_fixture record;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  if safe_scope not in ('league', 'division', 'cup') then raise exception 'Unsupported publication scope' using errcode = '22023'; end if;
  if safe_scope <> 'league' and target_scope_id is null then raise exception 'A division or cup is required for this publication scope' using errcode = '22023'; end if;

  select * into version_row from public.league_schedule_versions
  where id = target_schedule_version_id and league_id = target_league_id;
  if version_row.id is null then raise exception 'Schedule version not found' using errcode = 'P0002'; end if;
  if version_row.status <> 'published' then raise exception 'Publish the validated schedule version before releasing it to clubs' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext(target_league_id::text || ':publication:' || version_row.season_id::text || ':' || safe_scope || ':' || coalesce(target_scope_id::text, 'all')));
  update public.league_publications
  set status = 'superseded', superseded_at = now(), updated_at = now()
  where league_id = target_league_id and season_id = version_row.season_id
    and scope_type = safe_scope
    and coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(target_scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and status = 'published';

  insert into public.league_publications (
    league_id, season_id, schedule_version_id, scope_type, scope_id, title, notes,
    status, published_by, published_at
  ) values (
    target_league_id, version_row.season_id, version_row.id, safe_scope, target_scope_id,
    coalesce(nullif(trim(publication_title), ''), version_row.name || ' fixture release'),
    nullif(trim(coalesce(publication_notes, '')), ''), 'published', actor_id, now()
  ) returning id into new_publication_id;

  insert into public.league_publication_fixtures (
    publication_id, league_id, target_type, target_id, parent_club_ids, snapshot, fingerprint
  )
  select
    new_publication_id,
    target_league_id,
    'schedule_entry',
    entry.id,
    array_remove(array[home_team.parent_club_id, away_team.parent_club_id], null),
    to_jsonb(entry) || jsonb_build_object(
      'competition_type', 'league',
      'competition_id', entry.division_id,
      'home_team_name', home_team.name,
      'away_team_name', away_team.name,
      'venue_name', venue.name
    ),
    encode(digest(concat_ws('|', entry.id, entry.scheduled_date, entry.kick_off, entry.venue_id, entry.home_team_id, entry.away_team_id, entry.locked), 'sha256'), 'hex')
  from public.league_schedule_entries entry
  join public.league_teams home_team on home_team.id = entry.home_team_id
  join public.league_teams away_team on away_team.id = entry.away_team_id
  left join public.league_venues venue on venue.id = entry.venue_id
  where entry.version_id = version_row.id
    and entry.placement_status = 'placed'
    and private.publication_scope_matches(safe_scope, target_scope_id, entry.division_id, null);
  get diagnostics fixture_count = row_count;

  if safe_scope in ('league', 'cup') then
    insert into public.league_publication_fixtures (
      publication_id, league_id, target_type, target_id, parent_club_ids, snapshot, fingerprint
    )
    select
      new_publication_id,
      target_league_id,
      'cup_tie',
      tie.id,
      array_remove(array[home_team.parent_club_id, away_team.parent_club_id], null),
      to_jsonb(tie) || jsonb_build_object(
        'competition_type', 'cup',
        'competition_id', tie.cup_id,
        'home_team_name', home_team.name,
        'away_team_name', away_team.name,
        'venue_name', venue.name
      ),
      encode(digest(concat_ws('|', tie.id, tie.scheduled_date, tie.kick_off, tie.venue_id, tie.home_team_id, tie.away_team_id, tie.status), 'sha256'), 'hex')
    from public.league_cup_ties tie
    join public.league_teams home_team on home_team.id = tie.home_team_id
    left join public.league_teams away_team on away_team.id = tie.away_team_id
    left join public.league_venues venue on venue.id = tie.venue_id
    where tie.league_id = target_league_id and tie.season_id = version_row.season_id
      and tie.scheduled_date is not null
      and tie.status not in ('cancelled', 'void', 'bye')
      and private.publication_scope_matches(safe_scope, target_scope_id, null, tie.cup_id);
    get diagnostics club_count = row_count;
    fixture_count := fixture_count + club_count;
  end if;

  if fixture_count = 0 then raise exception 'The selected publication scope contains no scheduled fixtures' using errcode = '23514'; end if;

  for publication_fixture in
    select fixture.id, unnest(fixture.parent_club_ids) as parent_club_id
    from public.league_publication_fixtures fixture
    where fixture.publication_id = new_publication_id
  loop
    insert into public.league_fixture_acknowledgements (
      publication_id, publication_fixture_id, league_id, parent_club_id, status
    ) values (
      new_publication_id, publication_fixture.id, target_league_id, publication_fixture.parent_club_id, 'awaiting'
    ) on conflict (publication_fixture_id, parent_club_id) do nothing;
  end loop;

  select count(distinct acknowledgement.parent_club_id) into club_count
  from public.league_fixture_acknowledgements acknowledgement
  where acknowledgement.publication_id = new_publication_id;

  update public.league_publications
  set summary = jsonb_build_object('fixtures', fixture_count, 'clubs', club_count, 'awaiting_acknowledgements', (select count(*) from public.league_fixture_acknowledgements acknowledgement where acknowledgement.publication_id = new_publication_id))
  where id = new_publication_id;

  insert into public.league_communications (
    league_id, recipient_type, recipient_id, recipient_label, recipient_email,
    template_key, subject, body, channel, status, requires_acknowledgement,
    source_type, source_id, created_by
  )
  select
    target_league_id,
    'club',
    club.id,
    club.name,
    null,
    'fixture_publication',
    coalesce(nullif(trim(publication_title), ''), version_row.name || ' fixture release'),
    'A new fixture programme has been published in the Daxora club portal. Please review and acknowledge the fixtures for your club.',
    'manual',
    'draft',
    true,
    'publication',
    new_publication_id,
    actor_id
  from public.league_parent_clubs club
  where club.id in (select distinct acknowledgement.parent_club_id from public.league_fixture_acknowledgements acknowledgement where acknowledgement.publication_id = new_publication_id);

  perform private.write_league_audit(target_league_id, 'league.fixture_release_published', 'publication', new_publication_id, jsonb_build_object('version_id', version_row.id, 'scope_type', safe_scope, 'scope_id', target_scope_id, 'fixtures', fixture_count, 'clubs', club_count));
  return jsonb_build_object('publication_id', new_publication_id, 'fixtures', fixture_count, 'clubs', club_count);
end;
$$;

create or replace function public.withdraw_league_publication(target_league_id uuid, target_publication_id uuid, withdrawal_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  update public.league_publications set status = 'withdrawn', withdrawn_at = now(), notes = concat_ws(E'\n', notes, nullif(trim(coalesce(withdrawal_reason, '')), '')), updated_at = now()
  where id = target_publication_id and league_id = target_league_id and status = 'published';
  if not found then raise exception 'Active publication not found' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.fixture_release_withdrawn', 'publication', target_publication_id, jsonb_build_object('reason', nullif(trim(coalesce(withdrawal_reason, '')), '')));
end;
$$;

create or replace function public.restore_league_publication(target_league_id uuid, target_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_publication public.league_publications%rowtype;
  active_version_id uuid;
  result jsonb;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  select * into target_publication from public.league_publications where id = target_publication_id and league_id = target_league_id;
  if target_publication.id is null or target_publication.schedule_version_id is null then raise exception 'Restorable publication not found' using errcode = 'P0002'; end if;

  select id into active_version_id from public.league_schedule_versions where league_id = target_league_id and season_id = target_publication.season_id and status = 'published' limit 1;
  if active_version_id = target_publication.schedule_version_id then raise exception 'This schedule version is already published' using errcode = '23514'; end if;

  update public.league_schedule_versions set status = 'archived', updated_at = now()
  where league_id = target_league_id and season_id = target_publication.season_id and status = 'published';
  update public.league_schedule_versions set status = 'draft', published_at = null, published_by = null, updated_at = now()
  where id = target_publication.schedule_version_id and league_id = target_league_id;
  result := public.publish_league_schedule_version(target_league_id, target_publication.schedule_version_id);
  perform public.publish_league_fixture_release(target_league_id, target_publication.schedule_version_id, target_publication.scope_type, target_publication.scope_id, target_publication.title || ' restored', 'Restored from publication ' || target_publication.id::text);
  perform private.write_league_audit(target_league_id, 'league.fixture_release_restored', 'publication', target_publication.id, jsonb_build_object('schedule_version_id', target_publication.schedule_version_id));
  return result;
end;
$$;

create or replace function public.acknowledge_league_fixture(
  target_league_id uuid,
  target_acknowledgement_id uuid,
  acknowledgement_status text,
  acknowledgement_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id, actor_id);
  safe_status text := lower(trim(coalesce(acknowledgement_status, 'received')));
begin
  if club_id is null then raise exception 'Club portal access required' using errcode = '42501'; end if;
  if safe_status not in ('received', 'ground_confirmed', 'kickoff_confirmed', 'disputed', 'unable_to_fulfil') then raise exception 'Unsupported acknowledgement status' using errcode = '22023'; end if;
  update public.league_fixture_acknowledgements acknowledgement
  set status = safe_status, notes = nullif(trim(coalesce(acknowledgement_notes, '')), ''), responded_by = actor_id, responded_at = now(), updated_at = now()
  where acknowledgement.id = target_acknowledgement_id
    and acknowledgement.league_id = target_league_id
    and acknowledgement.parent_club_id = club_id
    and exists (
      select 1 from public.league_publications publication
      where publication.id = acknowledgement.publication_id and publication.status = 'published'
    );
  if not found then raise exception 'Fixture acknowledgement not found for this club' using errcode = 'P0002'; end if;
  perform private.write_league_audit(target_league_id, 'league.fixture_acknowledged', 'fixture_acknowledgement', target_acknowledgement_id, jsonb_build_object('club_id', club_id, 'status', safe_status));
end;
$$;

create or replace function public.create_league_fixture_change_request(target_league_id uuid, request_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id, actor_id);
  safe_target_type text := lower(trim(coalesce(request_data ->> 'target_type', '')));
  safe_request_type text := lower(trim(coalesce(request_data ->> 'request_type', '')));
  safe_target_id uuid := nullif(request_data ->> 'target_id', '')::uuid;
  request_id uuid;
  fixture_club_ids uuid[];
begin
  if club_id is null then raise exception 'Club portal access required' using errcode = '42501'; end if;
  if private.current_league_role(target_league_id, actor_id) = 'club_viewer' then raise exception 'This club portal role cannot request fixture changes' using errcode = '42501'; end if;
  if safe_target_type not in ('schedule_entry', 'cup_tie') then raise exception 'Unsupported fixture target' using errcode = '22023'; end if;
  if safe_request_type not in ('date_change', 'kickoff_change', 'venue_change', 'postponement', 'ground_unavailable', 'team_withdrawal', 'cup_conflict') then raise exception 'Unsupported fixture change request' using errcode = '22023'; end if;
  if length(trim(coalesce(request_data ->> 'reason', ''))) < 3 then raise exception 'A reason is required' using errcode = '22023'; end if;
  if safe_request_type = 'date_change' and nullif(request_data ->> 'requested_date', '') is null then raise exception 'A proposed date is required for a date change' using errcode = '22023'; end if;
  if safe_request_type = 'kickoff_change' and nullif(request_data ->> 'requested_kick_off', '') is null then raise exception 'A proposed kick-off is required for a kick-off change' using errcode = '22023'; end if;
  if safe_request_type = 'venue_change' and nullif(request_data ->> 'requested_venue_id', '') is null then raise exception 'A proposed venue is required for a venue change' using errcode = '22023'; end if;
  if nullif(request_data ->> 'requested_venue_id', '') is not null and not exists (
    select 1 from public.league_venues venue
    where venue.id = (request_data ->> 'requested_venue_id')::uuid and venue.league_id = target_league_id
  ) then raise exception 'The proposed venue is not part of this league' using errcode = '22023'; end if;

  if not exists (
    select 1
    from public.league_publication_fixtures publication_fixture
    join public.league_publications publication
      on publication.id = publication_fixture.publication_id and publication.status = 'published'
    where publication_fixture.league_id = target_league_id
      and publication_fixture.target_type = safe_target_type
      and publication_fixture.target_id = safe_target_id
      and club_id = any(publication_fixture.parent_club_ids)
      and (nullif(request_data ->> 'publication_id', '') is null or publication_fixture.publication_id = (request_data ->> 'publication_id')::uuid)
  ) then raise exception 'Only an active published club fixture can be changed' using errcode = '42501'; end if;

  if safe_target_type = 'schedule_entry' then
    select array_remove(array[home_team.parent_club_id, away_team.parent_club_id], null) into fixture_club_ids
    from public.league_schedule_entries entry
    join public.league_teams home_team on home_team.id = entry.home_team_id
    join public.league_teams away_team on away_team.id = entry.away_team_id
    where entry.id = safe_target_id and entry.league_id = target_league_id;
  else
    select array_remove(array[home_team.parent_club_id, away_team.parent_club_id], null) into fixture_club_ids
    from public.league_cup_ties tie
    join public.league_teams home_team on home_team.id = tie.home_team_id
    left join public.league_teams away_team on away_team.id = tie.away_team_id
    where tie.id = safe_target_id and tie.league_id = target_league_id;
  end if;
  if fixture_club_ids is null or not (club_id = any(fixture_club_ids)) then raise exception 'This fixture does not belong to your club' using errcode = '42501'; end if;

  insert into public.league_fixture_change_requests (
    league_id, parent_club_id, publication_id, target_type, target_id, request_type,
    requested_date, requested_kick_off, requested_venue_id, reason, evidence, status, requested_by
  ) values (
    target_league_id, club_id, nullif(request_data ->> 'publication_id', '')::uuid,
    safe_target_type, safe_target_id, safe_request_type,
    nullif(request_data ->> 'requested_date', '')::date,
    nullif(request_data ->> 'requested_kick_off', '')::time,
    nullif(request_data ->> 'requested_venue_id', '')::uuid,
    trim(request_data ->> 'reason'), coalesce(request_data -> 'evidence', '{}'::jsonb), 'submitted', actor_id
  ) returning id into request_id;
  perform private.write_league_audit(target_league_id, 'league.fixture_change_requested', 'fixture_change_request', request_id, jsonb_build_object('club_id', club_id, 'target_type', safe_target_type, 'target_id', safe_target_id, 'request_type', safe_request_type));
  return request_id;
end;
$$;

create or replace function public.resolve_league_fixture_change_request(
  target_league_id uuid,
  target_request_id uuid,
  decision text,
  response_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  request_row public.league_fixture_change_requests%rowtype;
  safe_decision text := lower(trim(coalesce(decision, '')));
  source_entry public.league_schedule_entries%rowtype;
  source_version public.league_schedule_versions%rowtype;
  new_version_id uuid;
  new_entry_id uuid;
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  if safe_decision not in ('approved', 'rejected', 'under_review') then raise exception 'Unsupported request decision' using errcode = '22023'; end if;
  select * into request_row from public.league_fixture_change_requests
  where id = target_request_id and league_id = target_league_id for update;
  if request_row.id is null then raise exception 'Fixture change request not found' using errcode = 'P0002'; end if;
  if request_row.status not in ('submitted', 'under_review') then raise exception 'This fixture change request has already been resolved' using errcode = '23514'; end if;
  if safe_decision = 'approved' and request_row.request_type = 'team_withdrawal' then
    raise exception 'Team withdrawal requires the dedicated competition withdrawal workflow' using errcode = '0A000';
  end if;

  if safe_decision = 'under_review' then
    update public.league_fixture_change_requests set status = 'under_review', league_response = nullif(trim(coalesce(response_notes, '')), ''), updated_at = now() where id = target_request_id;
    perform private.write_league_audit(target_league_id, 'league.fixture_change_under_review', 'fixture_change_request', target_request_id, '{}'::jsonb);
    return jsonb_build_object('status', 'under_review');
  end if;

  if safe_decision = 'rejected' then
    update public.league_fixture_change_requests set status = 'rejected', league_response = nullif(trim(coalesce(response_notes, '')), ''), resolved_by = actor_id, resolved_at = now(), updated_at = now() where id = target_request_id;
    perform private.write_league_audit(target_league_id, 'league.fixture_change_rejected', 'fixture_change_request', target_request_id, jsonb_build_object('response', nullif(trim(coalesce(response_notes, '')), '')));
    return jsonb_build_object('status', 'rejected');
  end if;

  if request_row.target_type = 'schedule_entry' then
    select * into source_entry from public.league_schedule_entries where id = request_row.target_id and league_id = target_league_id;
    if source_entry.id is null then raise exception 'Source schedule fixture not found' using errcode = 'P0002'; end if;
    select * into source_version from public.league_schedule_versions where id = source_entry.version_id and league_id = target_league_id;
    new_version_id := public.clone_league_schedule_version(target_league_id, source_version.id, source_version.name || ' · club request');
    select entry.id into new_entry_id
    from public.league_schedule_entries entry
    where entry.version_id = new_version_id
      and entry.home_team_id = source_entry.home_team_id
      and entry.away_team_id = source_entry.away_team_id
      and entry.meeting_number = source_entry.meeting_number
    limit 1;
    if new_entry_id is null then raise exception 'Cloned schedule fixture could not be located' using errcode = 'P0002'; end if;

    update public.league_schedule_entries
    set scheduled_date = case when request_row.request_type in ('date_change', 'postponement', 'ground_unavailable', 'cup_conflict') then request_row.requested_date else scheduled_date end,
        kick_off = case when request_row.request_type = 'kickoff_change' then request_row.requested_kick_off else coalesce(request_row.requested_kick_off, kick_off) end,
        venue_id = case when request_row.request_type in ('venue_change', 'ground_unavailable') then request_row.requested_venue_id else coalesce(request_row.requested_venue_id, venue_id) end,
        placement_status = case when request_row.request_type in ('postponement', 'ground_unavailable', 'cup_conflict') and request_row.requested_date is null then 'unplaced' else 'placed' end,
        unresolved_reason = case when request_row.request_type in ('postponement', 'ground_unavailable', 'cup_conflict') and request_row.requested_date is null then initcap(replace(request_row.request_type, '_', ' ')) || ' from approved club request' else null end,
        notes = concat_ws(E'\n', notes, 'Approved club request ' || request_row.id::text),
        updated_at = now()
    where id = new_entry_id;
  else
    update public.league_cup_ties
    set scheduled_date = case when request_row.request_type in ('date_change', 'postponement', 'ground_unavailable', 'cup_conflict') then request_row.requested_date else scheduled_date end,
        kick_off = case when request_row.request_type = 'kickoff_change' then request_row.requested_kick_off else coalesce(request_row.requested_kick_off, kick_off) end,
        venue_id = case when request_row.request_type in ('venue_change', 'ground_unavailable') then request_row.requested_venue_id else coalesce(request_row.requested_venue_id, venue_id) end,
        status = case when request_row.request_type in ('postponement', 'ground_unavailable', 'cup_conflict') and request_row.requested_date is null then 'postponed' else status end,
        notes = concat_ws(E'\n', notes, 'Approved club request ' || request_row.id::text),
        updated_at = now()
    where id = request_row.target_id and league_id = target_league_id;
    if not found then raise exception 'Cup fixture not found' using errcode = 'P0002'; end if;
  end if;

  update public.league_fixture_change_requests
  set status = 'approved', league_response = nullif(trim(coalesce(response_notes, '')), ''),
      resolution_version_id = new_version_id, resolved_by = actor_id, resolved_at = now(), updated_at = now()
  where id = target_request_id;
  perform private.write_league_audit(target_league_id, 'league.fixture_change_approved', 'fixture_change_request', target_request_id, jsonb_build_object('resolution_version_id', new_version_id, 'target_type', request_row.target_type, 'target_id', request_row.target_id));
  return jsonb_build_object('status', 'approved', 'resolution_version_id', new_version_id);
end;
$$;

create or replace function public.save_league_communication(target_league_id uuid, communication_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  communication_id uuid := coalesce(nullif(communication_data ->> 'id', '')::uuid, gen_random_uuid());
  safe_recipient_type text := lower(trim(coalesce(communication_data ->> 'recipient_type', 'club')));
  safe_status text := lower(trim(coalesce(communication_data ->> 'status', 'draft')));
begin
  if not public.can_operate_league(target_league_id) then raise exception 'League fixture access required' using errcode = '42501'; end if;
  if safe_recipient_type not in ('club', 'team', 'official', 'league_member', 'all_clubs') then raise exception 'Unsupported communication recipient' using errcode = '22023'; end if;
  if safe_status not in ('draft', 'queued', 'sent', 'failed', 'cancelled') then raise exception 'Unsupported communication status' using errcode = '22023'; end if;
  if length(trim(coalesce(communication_data ->> 'subject', ''))) < 2 or length(trim(coalesce(communication_data ->> 'body', ''))) < 2 then raise exception 'Communication subject and body are required' using errcode = '22023'; end if;

  insert into public.league_communications (
    id, league_id, recipient_type, recipient_id, recipient_label, recipient_email,
    template_key, subject, body, channel, status, requires_acknowledgement,
    source_type, source_id, created_by, sent_at, delivery_detail
  ) values (
    communication_id, target_league_id, safe_recipient_type, nullif(communication_data ->> 'recipient_id', '')::uuid,
    trim(coalesce(communication_data ->> 'recipient_label', 'League recipient')),
    nullif(lower(trim(coalesce(communication_data ->> 'recipient_email', ''))), ''),
    coalesce(nullif(trim(communication_data ->> 'template_key'), ''), 'custom'),
    trim(communication_data ->> 'subject'), trim(communication_data ->> 'body'),
    coalesce(nullif(lower(trim(communication_data ->> 'channel')), ''), 'manual'), safe_status,
    coalesce((communication_data ->> 'requires_acknowledgement')::boolean, false),
    nullif(trim(coalesce(communication_data ->> 'source_type', '')), ''),
    nullif(communication_data ->> 'source_id', '')::uuid, actor_id,
    case when safe_status = 'sent' then now() else null end,
    coalesce(communication_data -> 'delivery_detail', '{}'::jsonb)
  )
  on conflict (id) do update set
    recipient_type = excluded.recipient_type, recipient_id = excluded.recipient_id,
    recipient_label = excluded.recipient_label, recipient_email = excluded.recipient_email,
    template_key = excluded.template_key, subject = excluded.subject, body = excluded.body,
    channel = excluded.channel, status = excluded.status,
    requires_acknowledgement = excluded.requires_acknowledgement,
    source_type = excluded.source_type, source_id = excluded.source_id,
    sent_at = case when excluded.status = 'sent' then coalesce(public.league_communications.sent_at, now()) else public.league_communications.sent_at end,
    delivery_detail = excluded.delivery_detail, updated_at = now()
  where public.league_communications.league_id = target_league_id;

  perform private.write_league_audit(target_league_id, 'league.communication_saved', 'communication', communication_id, jsonb_build_object('recipient_type', safe_recipient_type, 'status', safe_status));
  return communication_id;
end;
$$;

create or replace function public.create_league_calendar_feed(
  target_league_id uuid,
  target_scope_type text,
  target_scope_id uuid default null,
  feed_label text default null,
  expires_in_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_scope text := lower(trim(coalesce(target_scope_type, 'league')));
  raw_token text := encode(gen_random_bytes(24), 'hex');
  token_id uuid;
  club_id uuid := private.current_league_club_id(target_league_id, actor_id);
begin
  if not public.can_view_league(target_league_id) and club_id is null then raise exception 'League access required' using errcode = '42501'; end if;
  if safe_scope not in ('league', 'division', 'club', 'team', 'venue', 'cup', 'official') then raise exception 'Unsupported calendar scope' using errcode = '22023'; end if;
  if club_id is not null then
    if safe_scope = 'club' then target_scope_id := club_id;
    elsif safe_scope = 'team' and not exists (select 1 from public.league_teams team where team.id = target_scope_id and team.league_id = target_league_id and team.parent_club_id = club_id) then raise exception 'Club users can only create calendars for their own teams' using errcode = '42501';
    elsif safe_scope not in ('club', 'team') then raise exception 'Club users can only create club or team calendars' using errcode = '42501';
    end if;
  end if;
  if safe_scope <> 'league' and target_scope_id is null then raise exception 'A calendar scope record is required' using errcode = '22023'; end if;

  insert into private.league_calendar_tokens (
    league_id, scope_type, scope_id, label, token_hash, created_by, expires_at
  ) values (
    target_league_id, safe_scope, target_scope_id,
    coalesce(nullif(trim(feed_label), ''), initcap(replace(safe_scope, '_', ' ')) || ' calendar'),
    encode(digest(raw_token, 'sha256'), 'hex'), actor_id,
    case when expires_in_days is null then null else now() + make_interval(days => greatest(1, least(expires_in_days, 3650))) end
  ) returning id into token_id;
  perform private.write_league_audit(target_league_id, 'league.calendar_feed_created', 'calendar_feed', token_id, jsonb_build_object('scope_type', safe_scope, 'scope_id', target_scope_id));
  return jsonb_build_object('id', token_id, 'token', raw_token, 'scope_type', safe_scope, 'scope_id', target_scope_id);
end;
$$;

create or replace function public.revoke_league_calendar_feed(target_league_id uuid, target_feed_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id, actor_id);
begin
  if not public.can_manage_league(target_league_id) and club_id is null then raise exception 'Calendar feed access required' using errcode = '42501'; end if;
  update private.league_calendar_tokens
  set revoked_at = now()
  where id = target_feed_id and league_id = target_league_id
    and (public.can_manage_league(target_league_id) or (scope_type in ('club', 'team') and (scope_id = club_id or exists (select 1 from public.league_teams team where team.id = scope_id and team.parent_club_id = club_id))));
  if not found then raise exception 'Calendar feed not found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.get_league_calendar_feed(feed_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  token_row private.league_calendar_tokens%rowtype;
  league_row public.leagues%rowtype;
  result jsonb;
begin
  select * into token_row from private.league_calendar_tokens
  where token_hash = encode(digest(trim(coalesce(feed_token, '')), 'sha256'), 'hex')
    and revoked_at is null and (expires_at is null or expires_at > now());
  if token_row.id is null then raise exception 'Calendar feed is invalid or expired' using errcode = 'P0002'; end if;
  select * into league_row from public.leagues where id = token_row.league_id and status <> 'closed';
  if league_row.id is null then raise exception 'League calendar is unavailable' using errcode = 'P0002'; end if;

  select jsonb_build_object(
    'league', jsonb_build_object('id', league_row.id, 'name', league_row.name, 'timezone', league_row.timezone),
    'feed', jsonb_build_object('id', token_row.id, 'scope_type', token_row.scope_type, 'scope_id', token_row.scope_id, 'label', token_row.label),
    'fixtures', coalesce(jsonb_agg(fixture_row order by fixture_row ->> 'scheduled_date', fixture_row ->> 'kick_off'), '[]'::jsonb)
  ) into result
  from (
    select jsonb_build_object(
      'id', fixture.id, 'target_type', 'league_fixture', 'competition_type', fixture.competition_type,
      'competition_id', coalesce(fixture.competition_id, fixture.division_id),
      'scheduled_date', fixture.scheduled_date, 'kick_off', fixture.kick_off,
      'home_team_id', fixture.home_team_id, 'away_team_id', fixture.away_team_id,
      'home_team_name', home_team.name, 'away_team_name', away_team.name,
      'venue_id', fixture.venue_id, 'venue_name', venue.name, 'venue_address', venue.address,
      'venue_postcode', venue.postcode, 'status', fixture.status
    ) as fixture_row
    from public.league_fixtures fixture
    join public.league_teams home_team on home_team.id = fixture.home_team_id
    join public.league_teams away_team on away_team.id = fixture.away_team_id
    left join public.league_venues venue on venue.id = fixture.venue_id
    where fixture.league_id = token_row.league_id and fixture.scheduled_date is not null
      and fixture.status not in ('cancelled')
      and (
        token_row.scope_type = 'league'
        or (token_row.scope_type = 'division' and fixture.division_id = token_row.scope_id)
        or (token_row.scope_type = 'club' and (home_team.parent_club_id = token_row.scope_id or away_team.parent_club_id = token_row.scope_id))
        or (token_row.scope_type = 'team' and token_row.scope_id in (fixture.home_team_id, fixture.away_team_id))
        or (token_row.scope_type = 'venue' and fixture.venue_id = token_row.scope_id)
        or (token_row.scope_type = 'cup' and fixture.competition_type = 'cup' and fixture.competition_id = token_row.scope_id)
        or (token_row.scope_type = 'official' and exists (
          select 1
          from public.league_official_assignments assignment
          join public.league_schedule_entries schedule_entry on schedule_entry.id = assignment.target_id
          where assignment.league_id = token_row.league_id
            and assignment.official_id = token_row.scope_id
            and assignment.target_type = 'schedule_entry'
            and assignment.status not in ('declined', 'withdrawn', 'replacement_required')
            and schedule_entry.version_id = fixture.schedule_version_id
            and schedule_entry.home_team_id = fixture.home_team_id
            and schedule_entry.away_team_id = fixture.away_team_id
            and schedule_entry.meeting_number = fixture.meeting_number
        ))
      )
    union all
    select jsonb_build_object(
      'id', tie.id, 'target_type', 'cup_tie', 'competition_type', 'cup', 'competition_id', tie.cup_id,
      'scheduled_date', tie.scheduled_date, 'kick_off', tie.kick_off,
      'home_team_id', tie.home_team_id, 'away_team_id', tie.away_team_id,
      'home_team_name', home_team.name, 'away_team_name', away_team.name,
      'venue_id', tie.venue_id, 'venue_name', venue.name, 'venue_address', venue.address,
      'venue_postcode', venue.postcode, 'status', tie.status
    )
    from public.league_cup_ties tie
    join public.league_teams home_team on home_team.id = tie.home_team_id
    left join public.league_teams away_team on away_team.id = tie.away_team_id
    left join public.league_venues venue on venue.id = tie.venue_id
    where tie.league_id = token_row.league_id and tie.scheduled_date is not null and tie.status not in ('cancelled', 'void')
      and (
        token_row.scope_type = 'league'
        or (token_row.scope_type = 'club' and (home_team.parent_club_id = token_row.scope_id or away_team.parent_club_id = token_row.scope_id))
        or (token_row.scope_type = 'team' and token_row.scope_id in (tie.home_team_id, tie.away_team_id))
        or (token_row.scope_type = 'venue' and tie.venue_id = token_row.scope_id)
        or (token_row.scope_type = 'cup' and tie.cup_id = token_row.scope_id)
        or (token_row.scope_type = 'official' and exists (select 1 from public.league_official_assignments assignment where assignment.league_id = token_row.league_id and assignment.official_id = token_row.scope_id and assignment.target_type = 'cup_tie' and assignment.target_id = tie.id and assignment.status not in ('declined', 'withdrawn', 'replacement_required')))
      )
  ) rows;
  return result;
end;
$$;

create or replace function public.get_league_club_operations_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.can_view_league(target_league_id) then raise exception 'League workspace access denied' using errcode = '42501'; end if;
  update public.league_club_invitations set status = 'expired', updated_at = now()
  where league_id = target_league_id and status = 'pending' and expires_at <= now();

  select jsonb_build_object(
    'access', jsonb_build_object('can_manage', public.can_manage_league(target_league_id), 'can_operate', public.can_operate_league(target_league_id), 'can_manage_clubs', public.can_manage_league(target_league_id)),
    'publications', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.published_at desc nulls last, row_value.created_at desc) from public.league_publications row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'publication_fixtures', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at) from public.league_publication_fixtures row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'acknowledgements', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.status, row_value.created_at desc) from public.league_fixture_acknowledgements row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'change_requests', coalesce((select jsonb_agg(to_jsonb(row_value) order by case row_value.status when 'submitted' then 0 when 'under_review' then 1 else 2 end, row_value.created_at desc) from public.league_fixture_change_requests row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'communications', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_communications row_value where row_value.league_id = target_league_id), '[]'::jsonb),
    'club_memberships', coalesce((select jsonb_agg(to_jsonb(membership) || jsonb_build_object('display_name', profile.display_name, 'email', profile.email) order by club.name, coalesce(profile.display_name, profile.email)) from public.league_club_memberships membership join public.league_parent_clubs club on club.id = membership.parent_club_id left join public.user_profiles profile on profile.id = membership.user_id where membership.league_id = target_league_id and membership.status <> 'revoked'), '[]'::jsonb),
    'club_invitations', case when public.can_manage_league(target_league_id) then coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_club_invitations row_value where row_value.league_id = target_league_id), '[]'::jsonb) else '[]'::jsonb end,
    'calendar_feeds', coalesce((select jsonb_agg(jsonb_build_object('id', token.id, 'scope_type', token.scope_type, 'scope_id', token.scope_id, 'feed_label', token.label, 'expires_at', token.expires_at, 'revoked_at', token.revoked_at, 'created_at', token.created_at) order by token.created_at desc) from private.league_calendar_tokens token where token.league_id = target_league_id), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_league_club_portal_data(target_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id, actor_id);
  club_role text := private.current_league_role(target_league_id, actor_id);
  result jsonb;
begin
  if club_id is null then raise exception 'Club portal access denied' using errcode = '42501'; end if;
  select jsonb_build_object(
    'league', to_jsonb(league),
    'club', to_jsonb(club),
    'access', jsonb_build_object('role', club_role, 'can_respond', club_role in ('club_secretary', 'team_contact'), 'can_request_changes', club_role in ('club_secretary', 'team_contact')),
    'teams', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_teams row_value where row_value.league_id = target_league_id and row_value.parent_club_id = club_id), '[]'::jsonb),
    'venues', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.name) from public.league_venues row_value where row_value.league_id = target_league_id and row_value.parent_club_id = club_id), '[]'::jsonb),
    'fixtures', coalesce((
      select jsonb_agg(visible_fixture.fixture_json order by visible_fixture.fixture_json ->> 'scheduled_date', visible_fixture.fixture_json ->> 'kick_off')
      from (
        select distinct on (publication_fixture.target_type, publication_fixture.target_id)
          publication_fixture.snapshot || jsonb_build_object(
            'target_type', publication_fixture.target_type,
            'target_id', publication_fixture.target_id,
            'publication_id', publication_fixture.publication_id,
            'publication_fixture_id', publication_fixture.id
          ) as fixture_json
        from public.league_publication_fixtures publication_fixture
        join public.league_publications publication on publication.id = publication_fixture.publication_id and publication.status = 'published'
        where publication_fixture.league_id = target_league_id and club_id = any(publication_fixture.parent_club_ids)
        order by publication_fixture.target_type, publication_fixture.target_id, publication.published_at desc, publication.created_at desc
      ) visible_fixture
    ), '[]'::jsonb),
    'acknowledgements', coalesce((
      select jsonb_agg(to_jsonb(acknowledgement) order by acknowledgement.status, acknowledgement.created_at desc)
      from public.league_fixture_acknowledgements acknowledgement
      where acknowledgement.league_id = target_league_id
        and acknowledgement.parent_club_id = club_id
        and acknowledgement.publication_fixture_id in (
          select visible_fixture.publication_fixture_id
          from (
            select distinct on (publication_fixture.target_type, publication_fixture.target_id)
              publication_fixture.id as publication_fixture_id
            from public.league_publication_fixtures publication_fixture
            join public.league_publications publication
              on publication.id = publication_fixture.publication_id and publication.status = 'published'
            where publication_fixture.league_id = target_league_id and club_id = any(publication_fixture.parent_club_ids)
            order by publication_fixture.target_type, publication_fixture.target_id, publication.published_at desc, publication.created_at desc
          ) visible_fixture
        )
    ), '[]'::jsonb),
    'change_requests', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_fixture_change_requests row_value where row_value.league_id = target_league_id and row_value.parent_club_id = club_id), '[]'::jsonb),
    'communications', coalesce((select jsonb_agg(to_jsonb(row_value) order by row_value.created_at desc) from public.league_communications row_value where row_value.league_id = target_league_id and row_value.status in ('queued', 'sent') and (row_value.recipient_type = 'all_clubs' or (row_value.recipient_type = 'club' and row_value.recipient_id = club_id) or (row_value.recipient_type = 'team' and exists (select 1 from public.league_teams team where team.id = row_value.recipient_id and team.parent_club_id = club_id))), '[]'::jsonb),
    'calendar_feeds', coalesce((select jsonb_agg(jsonb_build_object('id', token.id, 'scope_type', token.scope_type, 'scope_id', token.scope_id, 'feed_label', token.label, 'expires_at', token.expires_at, 'revoked_at', token.revoked_at, 'created_at', token.created_at) order by token.created_at desc) from private.league_calendar_tokens token where token.league_id = target_league_id and token.created_by = actor_id and token.revoked_at is null), '[]'::jsonb)
  ) into result
  from public.leagues league
  join public.league_parent_clubs club on club.id = club_id and club.league_id = league.id
  where league.id = target_league_id;
  return result;
end;
$$;

revoke all on function public.can_view_league_club_portal(uuid) from public, anon;
revoke all on function public.create_league_club_invitation(uuid, uuid, text, text, integer) from public, anon;
revoke all on function public.accept_league_club_invitation(text) from public, anon;
revoke all on function public.revoke_league_club_invitation(uuid, uuid) from public, anon;
revoke all on function public.remove_league_club_member(uuid, uuid, uuid) from public, anon;
revoke all on function public.publish_league_fixture_release(uuid, uuid, text, uuid, text, text) from public, anon;
revoke all on function public.withdraw_league_publication(uuid, uuid, text) from public, anon;
revoke all on function public.restore_league_publication(uuid, uuid) from public, anon;
revoke all on function public.acknowledge_league_fixture(uuid, uuid, text, text) from public, anon;
revoke all on function public.create_league_fixture_change_request(uuid, jsonb) from public, anon;
revoke all on function public.resolve_league_fixture_change_request(uuid, uuid, text, text) from public, anon;
revoke all on function public.save_league_communication(uuid, jsonb) from public, anon;
revoke all on function public.create_league_calendar_feed(uuid, text, uuid, text, integer) from public, anon;
revoke all on function public.revoke_league_calendar_feed(uuid, uuid) from public, anon;
revoke all on function public.get_league_club_operations_data(uuid) from public, anon;
revoke all on function public.get_league_club_portal_data(uuid) from public, anon;
revoke all on function public.get_league_calendar_feed(text) from public;

grant execute on function public.can_view_league_club_portal(uuid) to authenticated;
grant execute on function public.create_league_club_invitation(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.accept_league_club_invitation(text) to authenticated;
grant execute on function public.revoke_league_club_invitation(uuid, uuid) to authenticated;
grant execute on function public.remove_league_club_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.publish_league_fixture_release(uuid, uuid, text, uuid, text, text) to authenticated;
grant execute on function public.withdraw_league_publication(uuid, uuid, text) to authenticated;
grant execute on function public.restore_league_publication(uuid, uuid) to authenticated;
grant execute on function public.acknowledge_league_fixture(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_league_fixture_change_request(uuid, jsonb) to authenticated;
grant execute on function public.resolve_league_fixture_change_request(uuid, uuid, text, text) to authenticated;
grant execute on function public.save_league_communication(uuid, jsonb) to authenticated;
grant execute on function public.create_league_calendar_feed(uuid, text, uuid, text, integer) to authenticated;
grant execute on function public.revoke_league_calendar_feed(uuid, uuid) to authenticated;
grant execute on function public.get_league_club_operations_data(uuid) to authenticated;
grant execute on function public.get_league_club_portal_data(uuid) to authenticated;
grant execute on function public.get_league_calendar_feed(text) to anon, authenticated;

commit;
