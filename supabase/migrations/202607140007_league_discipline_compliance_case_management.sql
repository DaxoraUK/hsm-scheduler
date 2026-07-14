-- Daxora League Operations v3.6: discipline, compliance and case management.
begin;

alter table public.league_memberships drop constraint if exists league_memberships_role_check;
alter table public.league_memberships add constraint league_memberships_role_check
  check (role in ('owner','admin','fixtures','officials','results','discipline','viewer'));

alter table public.league_invitations drop constraint if exists league_invitations_role_check;
alter table public.league_invitations add constraint league_invitations_role_check
  check (role in ('admin','fixtures','officials','results','discipline','viewer'));

create table if not exists public.league_discipline_cases (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete restrict,
  case_reference text not null,
  case_type text not null default 'misconduct'
    check (case_type in ('misconduct','abandoned_match','eligibility','administrative','complaint','appeal','other')),
  status text not null default 'draft'
    check (status in ('draft','awaiting_review','awaiting_club_response','hearing_scheduled','decision_pending','decided','appealed','closed','withdrawn')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  title text not null check (length(trim(title)) between 3 and 220),
  summary text not null default '' check (length(summary) <= 10000),
  incident_on date,
  response_due_on date,
  hearing_on timestamptz,
  hearing_location text,
  hearing_panel jsonb not null default '[]'::jsonb,
  decision_on date,
  closed_at timestamptz,
  publication_fixture_id uuid references public.league_publication_fixtures(id) on delete set null,
  target_type text check (target_type is null or target_type in ('schedule_entry','cup_tie','club','team','other')),
  target_id uuid,
  reporting_club_id uuid references public.league_parent_clubs(id) on delete set null,
  respondent_club_id uuid references public.league_parent_clubs(id) on delete set null,
  respondent_team_id uuid references public.league_teams(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  confidential boolean not null default false,
  club_response_required boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, case_reference)
);

create table if not exists public.league_case_charges (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_id uuid not null references public.league_discipline_cases(id) on delete cascade,
  charge_code text,
  title text not null check (length(trim(title)) between 2 and 220),
  description text not null default '' check (length(description) <= 10000),
  rule_reference text,
  status text not null default 'alleged'
    check (status in ('alleged','admitted','upheld','part_upheld','dismissed','withdrawn')),
  decision_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_case_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_id uuid not null references public.league_discipline_cases(id) on delete cascade,
  event_type text not null default 'note'
    check (event_type in ('case_created','status_changed','note','club_response','decision_acknowledged','hearing','decision','appeal','payment','document','system')),
  visibility text not null default 'league' check (visibility in ('league','club')),
  title text not null check (length(trim(title)) between 2 and 220),
  detail text not null default '' check (length(detail) <= 20000),
  event_data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists public.league_case_documents (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_id uuid not null references public.league_discipline_cases(id) on delete cascade,
  document_type text not null default 'evidence'
    check (document_type in ('evidence','club_response','hearing_pack','decision','appeal','payment','other')),
  title text not null check (length(trim(title)) between 2 and 220),
  file_name text,
  document_url text not null check (length(trim(document_url)) between 8 and 2000 and document_url ~* '^https?://'),
  visibility text not null default 'league' check (visibility in ('league','club')),
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.league_case_sanctions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_id uuid not null references public.league_discipline_cases(id) on delete cascade,
  sanction_type text not null default 'warning'
    check (sanction_type in ('warning','fine','points_deduction','match_suspension','date_suspension','ground_closure','competition_exclusion','suspended_sanction','other')),
  subject_type text not null default 'club' check (subject_type in ('club','team','person','fixture','other')),
  subject_id uuid,
  subject_label text not null check (length(trim(subject_label)) between 2 and 220),
  status text not null default 'proposed'
    check (status in ('proposed','active','unpaid','paid','served','appealed','revoked')),
  amount_pence integer not null default 0 check (amount_pence between 0 and 100000000),
  points_delta integer not null default 0 check (points_delta between -100 and 100),
  match_count integer not null default 0 check (match_count between 0 and 100),
  matches_served integer not null default 0 check (matches_served between 0 and 100),
  starts_on date,
  ends_on date,
  payment_due_on date,
  paid_at timestamptz,
  table_adjustment_id uuid references public.league_table_adjustments(id) on delete set null,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_case_appeals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  case_id uuid not null references public.league_discipline_cases(id) on delete cascade,
  submitted_by_club_id uuid references public.league_parent_clubs(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted','under_review','hearing_scheduled','upheld','part_upheld','dismissed','withdrawn')),
  grounds text not null check (length(trim(grounds)) between 3 and 10000),
  appeal_due_on date,
  decision text,
  decision_reason text,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_discipline_cases_queue_idx
  on public.league_discipline_cases(league_id,status,response_due_on,hearing_on,updated_at desc);
create index if not exists league_discipline_cases_club_idx
  on public.league_discipline_cases(league_id,respondent_club_id,reporting_club_id,status);
create index if not exists league_case_charges_case_idx on public.league_case_charges(league_id,case_id,status);
create index if not exists league_case_events_case_idx on public.league_case_events(league_id,case_id,created_at desc);
create index if not exists league_case_documents_case_idx on public.league_case_documents(league_id,case_id,created_at desc);
create index if not exists league_case_sanctions_queue_idx
  on public.league_case_sanctions(league_id,status,payment_due_on,starts_on,ends_on);
create index if not exists league_case_appeals_queue_idx on public.league_case_appeals(league_id,status,submitted_at desc);

alter table public.league_discipline_cases enable row level security;
alter table public.league_discipline_cases force row level security;
alter table public.league_case_charges enable row level security;
alter table public.league_case_charges force row level security;
alter table public.league_case_events enable row level security;
alter table public.league_case_events force row level security;
alter table public.league_case_documents enable row level security;
alter table public.league_case_documents force row level security;
alter table public.league_case_sanctions enable row level security;
alter table public.league_case_sanctions force row level security;
alter table public.league_case_appeals enable row level security;
alter table public.league_case_appeals force row level security;

revoke all on table public.league_discipline_cases, public.league_case_charges, public.league_case_events,
  public.league_case_documents, public.league_case_sanctions, public.league_case_appeals from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'league_discipline_cases_touch_updated_at') then
    create trigger league_discipline_cases_touch_updated_at before update on public.league_discipline_cases
      for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'league_case_charges_touch_updated_at') then
    create trigger league_case_charges_touch_updated_at before update on public.league_case_charges
      for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'league_case_sanctions_touch_updated_at') then
    create trigger league_case_sanctions_touch_updated_at before update on public.league_case_sanctions
      for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'league_case_appeals_touch_updated_at') then
    create trigger league_case_appeals_touch_updated_at before update on public.league_case_appeals
      for each row execute function public.touch_updated_at();
  end if;
end $$;

create or replace function public.can_view_league_discipline(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select auth.uid() is not null and (
    private.is_platform_admin(auth.uid()) or exists (
      select 1
      from public.league_memberships membership
      join public.leagues league on league.id = membership.league_id
      where membership.league_id = target_league_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = any(array['owner','admin','discipline'])
        and league.status = 'active'
    )
  );
$$;

create or replace function public.can_manage_league_discipline(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.can_view_league_discipline(target_league_id);
$$;

create or replace function private.can_view_league_case(target_case_id uuid, actor_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.league_discipline_cases discipline_case
    where discipline_case.id = target_case_id
      and (
        public.can_view_league_discipline(discipline_case.league_id)
        or (
          not discipline_case.confidential
          and private.current_league_club_id(discipline_case.league_id, actor_id) in (discipline_case.reporting_club_id, discipline_case.respondent_club_id)
        )
      )
  );
$$;

drop policy if exists league_discipline_cases_read on public.league_discipline_cases;
create policy league_discipline_cases_read on public.league_discipline_cases for select to authenticated using (
  public.can_view_league_discipline(league_id)
  or (not confidential and private.current_league_club_id(league_id,auth.uid()) in (reporting_club_id,respondent_club_id))
);

drop policy if exists league_case_charges_read on public.league_case_charges;
create policy league_case_charges_read on public.league_case_charges for select to authenticated using (private.can_view_league_case(case_id,auth.uid()));

drop policy if exists league_case_events_read on public.league_case_events;
create policy league_case_events_read on public.league_case_events for select to authenticated using (
  private.can_view_league_case(case_id,auth.uid())
  and (public.can_view_league_discipline(league_id) or visibility = 'club')
);

drop policy if exists league_case_documents_read on public.league_case_documents;
create policy league_case_documents_read on public.league_case_documents for select to authenticated using (
  private.can_view_league_case(case_id,auth.uid())
  and (public.can_view_league_discipline(league_id) or visibility = 'club')
);

drop policy if exists league_case_sanctions_read on public.league_case_sanctions;
create policy league_case_sanctions_read on public.league_case_sanctions for select to authenticated using (private.can_view_league_case(case_id,auth.uid()));

drop policy if exists league_case_appeals_read on public.league_case_appeals;
create policy league_case_appeals_read on public.league_case_appeals for select to authenticated using (private.can_view_league_case(case_id,auth.uid()));

create or replace function public.create_league_invitation(
  target_league_id uuid,
  invite_email text,
  invite_role text default 'viewer',
  expiry_hours integer default 168
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_email text := lower(trim(coalesce(invite_email,'')));
  safe_role text := lower(trim(coalesce(invite_role,'viewer')));
  raw_token text := encode(gen_random_bytes(32),'hex');
  invitation_id uuid;
  invitation_expiry timestamptz;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email address is required' using errcode='22023'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  update public.league_invitations invitation_value
    set status='revoked',revoked_at=now(),updated_at=now()
    where invitation_value.league_id=target_league_id and lower(invitation_value.email)=safe_email and invitation_value.status='pending';
  invitation_expiry := now() + make_interval(hours => greatest(1,least(coalesce(expiry_hours,168),720)));
  insert into public.league_invitations(league_id,email,role,token_hash,status,invited_by,expires_at)
    values(target_league_id,safe_email,safe_role,encode(digest(raw_token,'sha256'),'hex'),'pending',actor_id,invitation_expiry)
    returning id into invitation_id;
  perform private.write_league_audit(target_league_id,'league.invitation_created','invitation',invitation_id,jsonb_build_object('email',safe_email,'role',safe_role));
  return jsonb_build_object('id',invitation_id,'token',raw_token,'email',safe_email,'role',safe_role,'expires_at',invitation_expiry);
end;
$$;

create or replace function public.update_league_member_role(target_league_id uuid,target_user_id uuid,next_role text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  safe_role text := lower(trim(coalesce(next_role,'')));
  target_current_role text;
begin
  if not public.can_manage_league(target_league_id) then raise exception 'League administrator access required' using errcode='42501'; end if;
  if safe_role not in ('admin','fixtures','officials','results','discipline','viewer') then raise exception 'Invalid league role' using errcode='22023'; end if;
  select membership.role into target_current_role
  from public.league_memberships membership
  where membership.league_id=target_league_id and membership.user_id=target_user_id and membership.status='active';
  if target_current_role is null then raise exception 'League member not found' using errcode='P0002'; end if;
  if target_current_role='owner' then raise exception 'The league owner role cannot be changed here' using errcode='42501'; end if;
  update public.league_memberships membership set role=safe_role,updated_at=now()
    where membership.league_id=target_league_id and membership.user_id=target_user_id;
  perform private.write_league_audit(target_league_id,'league.member_role_changed','member',target_user_id,jsonb_build_object('role',safe_role));
end;
$$;

create or replace function private.league_case_reference(target_league_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  candidate text;
begin
  loop
    candidate := 'DISC-' || to_char(current_date,'YY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists (
      select 1 from public.league_discipline_cases discipline_case
      where discipline_case.league_id=target_league_id and discipline_case.case_reference=candidate
    );
  end loop;
  return candidate;
end;
$$;

create or replace function public.get_league_discipline_data(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := private.current_league_role(target_league_id,actor_id);
begin
  if not public.can_view_league_discipline(target_league_id) then raise exception 'League discipline access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',public.can_manage_league_discipline(target_league_id),'is_club_portal',false),
    'cases',coalesce((
      select jsonb_agg(
        to_jsonb(discipline_case) || jsonb_build_object(
          'reporting_club_name',reporting_club.name,
          'respondent_club_name',respondent_club.name,
          'respondent_team_name',respondent_team.name,
          'assigned_to_name',coalesce(assigned_profile.display_name,assigned_profile.email),
          'created_by_name',coalesce(created_profile.display_name,created_profile.email),
          'fixture_label',case when publication_fixture.id is null then null else concat_ws(' v ',publication_fixture.snapshot->>'home_team_name',publication_fixture.snapshot->>'away_team_name') end
        )
        order by case discipline_case.priority when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
          discipline_case.response_due_on nulls last,discipline_case.updated_at desc
      )
      from public.league_discipline_cases discipline_case
      left join public.league_parent_clubs reporting_club on reporting_club.id=discipline_case.reporting_club_id
      left join public.league_parent_clubs respondent_club on respondent_club.id=discipline_case.respondent_club_id
      left join public.league_teams respondent_team on respondent_team.id=discipline_case.respondent_team_id
      left join public.user_profiles assigned_profile on assigned_profile.id=discipline_case.assigned_to
      left join public.user_profiles created_profile on created_profile.id=discipline_case.created_by
      left join public.league_publication_fixtures publication_fixture on publication_fixture.id=discipline_case.publication_fixture_id
      where discipline_case.league_id=target_league_id
    ),'[]'::jsonb),
    'charges',coalesce((select jsonb_agg(to_jsonb(charge) order by charge.created_at) from public.league_case_charges charge where charge.league_id=target_league_id),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(to_jsonb(case_event) || jsonb_build_object('created_by_name',coalesce(profile.display_name,profile.email)) order by case_event.created_at desc)
      from public.league_case_events case_event
      left join public.user_profiles profile on profile.id=case_event.created_by
      where case_event.league_id=target_league_id
    ),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(document) order by document.created_at desc) from public.league_case_documents document where document.league_id=target_league_id),'[]'::jsonb),
    'sanctions',coalesce((select jsonb_agg(to_jsonb(sanction) order by sanction.created_at desc) from public.league_case_sanctions sanction where sanction.league_id=target_league_id),'[]'::jsonb),
    'appeals',coalesce((select jsonb_agg(to_jsonb(appeal) order by appeal.submitted_at desc) from public.league_case_appeals appeal where appeal.league_id=target_league_id),'[]'::jsonb)
  );
end;
$$;

create or replace function public.get_league_club_discipline_data(target_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  actor_role text := private.current_league_role(target_league_id,actor_id);
begin
  if club_id is null or not public.can_view_league_club_portal(target_league_id) then raise exception 'Club portal access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'access',jsonb_build_object('role',actor_role,'can_view',true,'can_manage',false,'is_club_portal',true,'club_id',club_id),
    'cases',coalesce((
      select jsonb_agg(
        to_jsonb(discipline_case) || jsonb_build_object(
          'reporting_club_name',reporting_club.name,
          'respondent_club_name',respondent_club.name,
          'respondent_team_name',respondent_team.name,
          'fixture_label',case when publication_fixture.id is null then null else concat_ws(' v ',publication_fixture.snapshot->>'home_team_name',publication_fixture.snapshot->>'away_team_name') end
        ) order by discipline_case.updated_at desc
      )
      from public.league_discipline_cases discipline_case
      left join public.league_parent_clubs reporting_club on reporting_club.id=discipline_case.reporting_club_id
      left join public.league_parent_clubs respondent_club on respondent_club.id=discipline_case.respondent_club_id
      left join public.league_teams respondent_team on respondent_team.id=discipline_case.respondent_team_id
      left join public.league_publication_fixtures publication_fixture on publication_fixture.id=discipline_case.publication_fixture_id
      where discipline_case.league_id=target_league_id and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb),
    'charges',coalesce((
      select jsonb_agg(to_jsonb(charge) order by charge.created_at)
      from public.league_case_charges charge
      join public.league_discipline_cases discipline_case on discipline_case.id=charge.case_id
      where charge.league_id=target_league_id and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(to_jsonb(case_event) || jsonb_build_object('created_by_name',coalesce(profile.display_name,profile.email)) order by case_event.created_at desc)
      from public.league_case_events case_event
      join public.league_discipline_cases discipline_case on discipline_case.id=case_event.case_id
      left join public.user_profiles profile on profile.id=case_event.created_by
      where case_event.league_id=target_league_id and case_event.visibility='club' and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb),
    'documents',coalesce((
      select jsonb_agg(to_jsonb(document) order by document.created_at desc)
      from public.league_case_documents document
      join public.league_discipline_cases discipline_case on discipline_case.id=document.case_id
      where document.league_id=target_league_id and document.visibility='club' and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb),
    'sanctions',coalesce((
      select jsonb_agg(to_jsonb(sanction) order by sanction.created_at desc)
      from public.league_case_sanctions sanction
      join public.league_discipline_cases discipline_case on discipline_case.id=sanction.case_id
      where sanction.league_id=target_league_id and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb),
    'appeals',coalesce((
      select jsonb_agg(to_jsonb(appeal) order by appeal.submitted_at desc)
      from public.league_case_appeals appeal
      join public.league_discipline_cases discipline_case on discipline_case.id=appeal.case_id
      where appeal.league_id=target_league_id and not discipline_case.confidential
        and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.upsert_league_discipline_case(target_league_id uuid,case_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  entity_id uuid := coalesce(nullif(case_data->>'id','')::uuid,gen_random_uuid());
  existing_case public.league_discipline_cases%rowtype;
  case_reference text;
  safe_status text := lower(trim(coalesce(case_data->>'status','draft')));
  safe_type text := lower(trim(coalesce(case_data->>'case_type','misconduct')));
  safe_priority text := lower(trim(coalesce(case_data->>'priority','normal')));
  next_title text := trim(coalesce(case_data->>'title',''));
  next_summary text := coalesce(case_data->>'summary','');
  is_new boolean := true;
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  if length(next_title) < 3 then raise exception 'A case title is required' using errcode='22023'; end if;
  if safe_status not in ('draft','awaiting_review','awaiting_club_response','hearing_scheduled','decision_pending','decided','appealed','closed','withdrawn') then raise exception 'Invalid case status' using errcode='22023'; end if;
  if safe_type not in ('misconduct','abandoned_match','eligibility','administrative','complaint','appeal','other') then raise exception 'Invalid case type' using errcode='22023'; end if;
  if safe_priority not in ('low','normal','high','critical') then raise exception 'Invalid case priority' using errcode='22023'; end if;

  select discipline_case.* into existing_case
  from public.league_discipline_cases discipline_case
  where discipline_case.id=entity_id and discipline_case.league_id=target_league_id;
  if existing_case.id is not null then is_new := false; end if;
  case_reference := coalesce(existing_case.case_reference,nullif(trim(case_data->>'case_reference'),''),private.league_case_reference(target_league_id));

  insert into public.league_discipline_cases(
    id,league_id,season_id,case_reference,case_type,status,priority,title,summary,incident_on,response_due_on,
    hearing_on,hearing_location,hearing_panel,decision_on,closed_at,publication_fixture_id,target_type,target_id,
    reporting_club_id,respondent_club_id,respondent_team_id,assigned_to,confidential,club_response_required,created_by,updated_by
  ) values(
    entity_id,target_league_id,nullif(case_data->>'season_id','')::uuid,case_reference,safe_type,safe_status,safe_priority,next_title,next_summary,
    nullif(case_data->>'incident_on','')::date,nullif(case_data->>'response_due_on','')::date,nullif(case_data->>'hearing_on','')::timestamptz,
    nullif(trim(coalesce(case_data->>'hearing_location','')),''),coalesce(case_data->'hearing_panel','[]'::jsonb),nullif(case_data->>'decision_on','')::date,
    case when safe_status in ('closed','withdrawn') then coalesce(existing_case.closed_at,now()) else null end,
    nullif(case_data->>'publication_fixture_id','')::uuid,nullif(case_data->>'target_type',''),nullif(case_data->>'target_id','')::uuid,
    nullif(case_data->>'reporting_club_id','')::uuid,nullif(case_data->>'respondent_club_id','')::uuid,nullif(case_data->>'respondent_team_id','')::uuid,
    nullif(case_data->>'assigned_to','')::uuid,coalesce((case_data->>'confidential')::boolean,false),
    coalesce((case_data->>'club_response_required')::boolean,false),actor_id,actor_id
  )
  on conflict(id) do update set
    season_id=excluded.season_id,case_type=excluded.case_type,status=excluded.status,priority=excluded.priority,title=excluded.title,
    summary=excluded.summary,incident_on=excluded.incident_on,response_due_on=excluded.response_due_on,hearing_on=excluded.hearing_on,
    hearing_location=excluded.hearing_location,hearing_panel=excluded.hearing_panel,decision_on=excluded.decision_on,closed_at=excluded.closed_at,
    publication_fixture_id=excluded.publication_fixture_id,target_type=excluded.target_type,target_id=excluded.target_id,
    reporting_club_id=excluded.reporting_club_id,respondent_club_id=excluded.respondent_club_id,respondent_team_id=excluded.respondent_team_id,
    assigned_to=excluded.assigned_to,confidential=excluded.confidential,club_response_required=excluded.club_response_required,updated_by=actor_id,updated_at=now()
  where public.league_discipline_cases.league_id=target_league_id;

  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
  values(target_league_id,entity_id,case when is_new then 'case_created' else 'system' end,'club',
    case when is_new then 'Case opened' else 'Case details updated' end,
    case when is_new then next_summary else 'The league updated the case record.' end,
    jsonb_build_object('status',safe_status,'priority',safe_priority,'case_type',safe_type),actor_id,private.current_league_role(target_league_id,actor_id));

  perform private.write_league_audit(target_league_id,case when is_new then 'league.discipline_case_created' else 'league.discipline_case_updated' end,'discipline_case',entity_id,jsonb_build_object('case_reference',case_reference,'status',safe_status));
  return entity_id;
end;
$$;

create or replace function public.update_league_discipline_case_status(target_league_id uuid,target_case_id uuid,next_status text,status_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(next_status,'')));
  previous_status text;
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  if safe_status not in ('draft','awaiting_review','awaiting_club_response','hearing_scheduled','decision_pending','decided','appealed','closed','withdrawn') then raise exception 'Invalid case status' using errcode='22023'; end if;
  select discipline_case.status into previous_status from public.league_discipline_cases discipline_case where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id;
  if previous_status is null then raise exception 'Discipline case not found' using errcode='P0002'; end if;
  update public.league_discipline_cases discipline_case
    set status=safe_status,decision_on=case when safe_status='decided' then coalesce(discipline_case.decision_on,current_date) else discipline_case.decision_on end,
      closed_at=case when safe_status in ('closed','withdrawn') then coalesce(discipline_case.closed_at,now()) else null end,
      updated_by=actor_id,updated_at=now()
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id;
  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(target_league_id,target_case_id,'status_changed','club','Case status changed',nullif(trim(coalesce(status_note,'')),''),jsonb_build_object('from',previous_status,'to',safe_status),actor_id,private.current_league_role(target_league_id,actor_id));
  perform private.write_league_audit(target_league_id,'league.discipline_case_status_changed','discipline_case',target_case_id,jsonb_build_object('from',previous_status,'to',safe_status));
end;
$$;

create or replace function public.add_league_case_event(target_league_id uuid,target_case_id uuid,event_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  event_id uuid := gen_random_uuid();
  safe_type text := lower(trim(coalesce(event_data->>'event_type','note')));
  safe_visibility text := lower(trim(coalesce(event_data->>'visibility','league')));
  safe_title text := trim(coalesce(event_data->>'title','Case note'));
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  if not exists(select 1 from public.league_discipline_cases discipline_case where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id) then raise exception 'Discipline case not found' using errcode='P0002'; end if;
  if safe_type not in ('note','hearing','decision','payment','system') then safe_type := 'note'; end if;
  if safe_visibility not in ('league','club') then safe_visibility := 'league'; end if;
  insert into public.league_case_events(id,league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(event_id,target_league_id,target_case_id,safe_type,safe_visibility,safe_title,coalesce(event_data->>'detail',''),coalesce(event_data->'event_data','{}'::jsonb),actor_id,private.current_league_role(target_league_id,actor_id));
  perform private.write_league_audit(target_league_id,'league.discipline_case_event_added','discipline_case',target_case_id,jsonb_build_object('event_id',event_id,'event_type',safe_type,'visibility',safe_visibility));
  return event_id;
end;
$$;

create or replace function public.upsert_league_case_charge(target_league_id uuid,target_case_id uuid,charge_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  entity_id uuid := coalesce(nullif(charge_data->>'id','')::uuid,gen_random_uuid());
  safe_status text := lower(trim(coalesce(charge_data->>'status','alleged')));
  safe_title text := trim(coalesce(charge_data->>'title',''));
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  if not exists(select 1 from public.league_discipline_cases discipline_case where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id) then raise exception 'Discipline case not found' using errcode='P0002'; end if;
  if length(safe_title)<2 then raise exception 'A charge title is required' using errcode='22023'; end if;
  if safe_status not in ('alleged','admitted','upheld','part_upheld','dismissed','withdrawn') then raise exception 'Invalid charge status' using errcode='22023'; end if;
  insert into public.league_case_charges(id,league_id,case_id,charge_code,title,description,rule_reference,status,decision_reason,created_by,updated_by)
    values(entity_id,target_league_id,target_case_id,nullif(trim(coalesce(charge_data->>'charge_code','')),''),safe_title,coalesce(charge_data->>'description',''),nullif(trim(coalesce(charge_data->>'rule_reference','')),''),safe_status,nullif(trim(coalesce(charge_data->>'decision_reason','')),''),actor_id,actor_id)
  on conflict(id) do update set charge_code=excluded.charge_code,title=excluded.title,description=excluded.description,rule_reference=excluded.rule_reference,status=excluded.status,decision_reason=excluded.decision_reason,updated_by=actor_id,updated_at=now()
  where public.league_case_charges.league_id=target_league_id and public.league_case_charges.case_id=target_case_id;
  perform private.write_league_audit(target_league_id,'league.discipline_charge_saved','discipline_case',target_case_id,jsonb_build_object('charge_id',entity_id,'status',safe_status));
  return entity_id;
end;
$$;

create or replace function public.upsert_league_case_sanction(target_league_id uuid,target_case_id uuid,sanction_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  entity_id uuid := coalesce(nullif(sanction_data->>'id','')::uuid,gen_random_uuid());
  safe_type text := lower(trim(coalesce(sanction_data->>'sanction_type','warning')));
  safe_subject_type text := lower(trim(coalesce(sanction_data->>'subject_type','club')));
  safe_status text := lower(trim(coalesce(sanction_data->>'status','proposed')));
  safe_subject_id uuid := nullif(sanction_data->>'subject_id','')::uuid;
  safe_subject_label text := trim(coalesce(sanction_data->>'subject_label',''));
  safe_points integer := greatest(-100,least(coalesce((sanction_data->>'points_delta')::integer,0),100));
  existing_adjustment_id uuid;
  case_season_id uuid;
  team_division_id uuid;
  adjustment_id uuid;
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  select discipline_case.season_id into case_season_id from public.league_discipline_cases discipline_case where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id;
  if not found then raise exception 'Discipline case not found' using errcode='P0002'; end if;
  if safe_type not in ('warning','fine','points_deduction','match_suspension','date_suspension','ground_closure','competition_exclusion','suspended_sanction','other') then raise exception 'Invalid sanction type' using errcode='22023'; end if;
  if safe_subject_type not in ('club','team','person','fixture','other') then raise exception 'Invalid sanction subject' using errcode='22023'; end if;
  if safe_status not in ('proposed','active','unpaid','paid','served','appealed','revoked') then raise exception 'Invalid sanction status' using errcode='22023'; end if;
  if length(safe_subject_label)<2 then raise exception 'A sanction subject is required' using errcode='22023'; end if;

  select sanction.table_adjustment_id into existing_adjustment_id
  from public.league_case_sanctions sanction
  where sanction.id=entity_id and sanction.league_id=target_league_id and sanction.case_id=target_case_id;

  if safe_type='points_deduction' and safe_status='active' then
    if safe_subject_type<>'team' or safe_subject_id is null then raise exception 'Points deductions must target a team' using errcode='22023'; end if;
    select team.division_id,coalesce(case_season_id,team.season_id) into team_division_id,case_season_id
    from public.league_teams team where team.id=safe_subject_id and team.league_id=target_league_id;
    if team_division_id is null or case_season_id is null then raise exception 'The team division and season are required for a points deduction' using errcode='22023'; end if;
    adjustment_id := coalesce(existing_adjustment_id,gen_random_uuid());
    insert into public.league_table_adjustments(id,league_id,season_id,division_id,team_id,points_delta,reason,status,effective_on,created_by)
      values(adjustment_id,target_league_id,case_season_id,team_division_id,safe_subject_id,safe_points,
        'Discipline case '||(select discipline_case.case_reference from public.league_discipline_cases discipline_case where discipline_case.id=target_case_id),
        'active',coalesce(nullif(sanction_data->>'starts_on','')::date,current_date),actor_id)
    on conflict(id) do update set points_delta=excluded.points_delta,reason=excluded.reason,status='active',effective_on=excluded.effective_on,revoked_by=null,revoked_at=null,updated_at=now()
    where public.league_table_adjustments.league_id=target_league_id;
  elsif existing_adjustment_id is not null and safe_status in ('revoked','served') then
    update public.league_table_adjustments adjustment set status='revoked',revoked_by=actor_id,revoked_at=now(),updated_at=now()
      where adjustment.id=existing_adjustment_id and adjustment.league_id=target_league_id;
    adjustment_id := existing_adjustment_id;
  else
    adjustment_id := existing_adjustment_id;
  end if;

  insert into public.league_case_sanctions(
    id,league_id,case_id,sanction_type,subject_type,subject_id,subject_label,status,amount_pence,points_delta,match_count,matches_served,
    starts_on,ends_on,payment_due_on,paid_at,table_adjustment_id,notes,created_by,updated_by
  ) values(
    entity_id,target_league_id,target_case_id,safe_type,safe_subject_type,safe_subject_id,safe_subject_label,safe_status,
    greatest(0,coalesce((sanction_data->>'amount_pence')::integer,0)),safe_points,
    greatest(0,least(coalesce((sanction_data->>'match_count')::integer,0),100)),greatest(0,least(coalesce((sanction_data->>'matches_served')::integer,0),100)),
    nullif(sanction_data->>'starts_on','')::date,nullif(sanction_data->>'ends_on','')::date,nullif(sanction_data->>'payment_due_on','')::date,
    case when safe_status='paid' then coalesce(nullif(sanction_data->>'paid_at','')::timestamptz,now()) else nullif(sanction_data->>'paid_at','')::timestamptz end,
    adjustment_id,nullif(trim(coalesce(sanction_data->>'notes','')),''),actor_id,actor_id
  )
  on conflict(id) do update set sanction_type=excluded.sanction_type,subject_type=excluded.subject_type,subject_id=excluded.subject_id,subject_label=excluded.subject_label,
    status=excluded.status,amount_pence=excluded.amount_pence,points_delta=excluded.points_delta,match_count=excluded.match_count,matches_served=excluded.matches_served,
    starts_on=excluded.starts_on,ends_on=excluded.ends_on,payment_due_on=excluded.payment_due_on,paid_at=excluded.paid_at,table_adjustment_id=excluded.table_adjustment_id,
    notes=excluded.notes,updated_by=actor_id,updated_at=now()
  where public.league_case_sanctions.league_id=target_league_id and public.league_case_sanctions.case_id=target_case_id;

  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(target_league_id,target_case_id,'decision','club','Sanction recorded',nullif(trim(coalesce(sanction_data->>'notes','')),''),jsonb_build_object('sanction_id',entity_id,'sanction_type',safe_type,'status',safe_status,'subject_label',safe_subject_label),actor_id,private.current_league_role(target_league_id,actor_id));
  perform private.write_league_audit(target_league_id,'league.discipline_sanction_saved','discipline_case',target_case_id,jsonb_build_object('sanction_id',entity_id,'sanction_type',safe_type,'status',safe_status));
  return entity_id;
end;
$$;

create or replace function public.add_league_case_document(target_league_id uuid,target_case_id uuid,document_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  document_id uuid := gen_random_uuid();
  safe_visibility text := lower(trim(coalesce(document_data->>'visibility','league')));
  safe_type text := lower(trim(coalesce(document_data->>'document_type','evidence')));
  safe_title text := trim(coalesce(document_data->>'title','Evidence'));
  safe_url text := trim(coalesce(document_data->>'document_url',''));
  actor_role text := private.current_league_role(target_league_id,actor_id);
begin
  if public.can_manage_league_discipline(target_league_id) then
    null;
  elsif club_id is not null and exists(
    select 1 from public.league_discipline_cases discipline_case
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id and not discipline_case.confidential
      and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
  ) then
    safe_visibility := 'club';
    safe_type := case when safe_type='appeal' then 'appeal' else 'club_response' end;
  else
    raise exception 'Case document access denied' using errcode='42501';
  end if;
  if safe_visibility not in ('league','club') then safe_visibility := 'league'; end if;
  if safe_type not in ('evidence','club_response','hearing_pack','decision','appeal','payment','other') then safe_type := 'evidence'; end if;
  if length(safe_title)<2 or safe_url !~* '^https?://' then raise exception 'Document title and a secure HTTP link are required' using errcode='22023'; end if;
  insert into public.league_case_documents(id,league_id,case_id,document_type,title,file_name,document_url,visibility,notes,created_by)
    values(document_id,target_league_id,target_case_id,safe_type,safe_title,nullif(trim(coalesce(document_data->>'file_name','')),''),safe_url,safe_visibility,nullif(trim(coalesce(document_data->>'notes','')),''),actor_id);
  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(target_league_id,target_case_id,'document',safe_visibility,'Document added',safe_title,jsonb_build_object('document_id',document_id,'document_type',safe_type),actor_id,actor_role);
  perform private.write_league_audit(target_league_id,'league.discipline_document_added','discipline_case',target_case_id,jsonb_build_object('document_id',document_id,'document_type',safe_type));
  return document_id;
end;
$$;

create or replace function public.submit_league_case_response(target_league_id uuid,target_case_id uuid,response_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  response_id uuid := gen_random_uuid();
  response_type text := lower(trim(coalesce(response_data->>'response_type','response')));
  response_detail text := trim(coalesce(response_data->>'detail',''));
  next_event_type text;
  next_title text;
begin
  if club_id is null then raise exception 'Club portal access required' using errcode='42501'; end if;
  if not exists(
    select 1 from public.league_discipline_cases discipline_case
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id and not discipline_case.confidential
      and club_id in (discipline_case.reporting_club_id,discipline_case.respondent_club_id)
  ) then raise exception 'This case is outside your club access' using errcode='42501'; end if;
  if length(response_detail)<3 then raise exception 'Add the club response or acknowledgement' using errcode='22023'; end if;
  if response_type='decision_acknowledged' then next_event_type:='decision_acknowledged'; next_title:='Decision acknowledged';
  elsif response_type='payment' then next_event_type:='payment'; next_title:='Payment evidence submitted';
  else next_event_type:='club_response'; next_title:='Club response submitted'; end if;
  insert into public.league_case_events(id,league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(response_id,target_league_id,target_case_id,next_event_type,'club',next_title,response_detail,coalesce(response_data->'event_data','{}'::jsonb),actor_id,private.current_league_role(target_league_id,actor_id));
  if next_event_type='club_response' then
    update public.league_discipline_cases discipline_case set status='decision_pending',updated_by=actor_id,updated_at=now()
      where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id and discipline_case.status='awaiting_club_response';
  end if;
  perform private.write_league_audit(target_league_id,'league.discipline_club_response_submitted','discipline_case',target_case_id,jsonb_build_object('response_id',response_id,'response_type',response_type));
  return response_id;
end;
$$;

create or replace function public.submit_league_case_appeal(target_league_id uuid,target_case_id uuid,appeal_data jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  club_id uuid := private.current_league_club_id(target_league_id,actor_id);
  appeal_id uuid := gen_random_uuid();
  safe_grounds text := trim(coalesce(appeal_data->>'grounds',''));
  case_status text;
begin
  if club_id is null then raise exception 'Club portal access required' using errcode='42501'; end if;
  select discipline_case.status into case_status from public.league_discipline_cases discipline_case
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id and not discipline_case.confidential and discipline_case.respondent_club_id=club_id;
  if case_status is null then raise exception 'This case is outside your club access' using errcode='42501'; end if;
  if case_status not in ('decided','closed') then raise exception 'An appeal can be submitted after the league records its decision' using errcode='22023'; end if;
  if length(safe_grounds)<3 then raise exception 'Appeal grounds are required' using errcode='22023'; end if;
  if exists(select 1 from public.league_case_appeals appeal where appeal.case_id=target_case_id and appeal.status in ('submitted','under_review','hearing_scheduled')) then raise exception 'An open appeal already exists for this case' using errcode='23505'; end if;
  insert into public.league_case_appeals(id,league_id,case_id,submitted_by_club_id,status,grounds,appeal_due_on,submitted_by)
    values(appeal_id,target_league_id,target_case_id,club_id,'submitted',safe_grounds,nullif(appeal_data->>'appeal_due_on','')::date,actor_id);
  update public.league_discipline_cases discipline_case set status='appealed',closed_at=null,updated_by=actor_id,updated_at=now()
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id;
  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(target_league_id,target_case_id,'appeal','club','Appeal submitted',safe_grounds,jsonb_build_object('appeal_id',appeal_id),actor_id,private.current_league_role(target_league_id,actor_id));
  perform private.write_league_audit(target_league_id,'league.discipline_appeal_submitted','discipline_case',target_case_id,jsonb_build_object('appeal_id',appeal_id));
  return appeal_id;
end;
$$;

create or replace function public.review_league_case_appeal(target_league_id uuid,target_appeal_id uuid,appeal_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  safe_status text := lower(trim(coalesce(appeal_data->>'status','under_review')));
  target_case_id uuid;
begin
  if not public.can_manage_league_discipline(target_league_id) then raise exception 'Discipline officer access required' using errcode='42501'; end if;
  if safe_status not in ('under_review','hearing_scheduled','upheld','part_upheld','dismissed','withdrawn') then raise exception 'Invalid appeal decision' using errcode='22023'; end if;
  select appeal.case_id into target_case_id from public.league_case_appeals appeal where appeal.id=target_appeal_id and appeal.league_id=target_league_id;
  if target_case_id is null then raise exception 'Appeal not found' using errcode='P0002'; end if;
  update public.league_case_appeals appeal set status=safe_status,decision=nullif(trim(coalesce(appeal_data->>'decision','')),''),decision_reason=nullif(trim(coalesce(appeal_data->>'decision_reason','')),''),
    decided_by=case when safe_status in ('upheld','part_upheld','dismissed','withdrawn') then actor_id else null end,
    decided_at=case when safe_status in ('upheld','part_upheld','dismissed','withdrawn') then now() else null end,updated_at=now()
    where appeal.id=target_appeal_id and appeal.league_id=target_league_id;
  update public.league_discipline_cases discipline_case set status=case when safe_status in ('upheld','part_upheld','dismissed','withdrawn') then 'decided' else 'appealed' end,updated_by=actor_id,updated_at=now()
    where discipline_case.id=target_case_id and discipline_case.league_id=target_league_id;
  insert into public.league_case_events(league_id,case_id,event_type,visibility,title,detail,event_data,created_by,created_by_role)
    values(target_league_id,target_case_id,'appeal','club','Appeal updated',coalesce(appeal_data->>'decision_reason',''),jsonb_build_object('appeal_id',target_appeal_id,'status',safe_status,'decision',appeal_data->>'decision'),actor_id,private.current_league_role(target_league_id,actor_id));
  perform private.write_league_audit(target_league_id,'league.discipline_appeal_reviewed','discipline_case',target_case_id,jsonb_build_object('appeal_id',target_appeal_id,'status',safe_status));
end;
$$;

grant execute on function public.can_view_league_discipline(uuid) to authenticated;
grant execute on function public.can_manage_league_discipline(uuid) to authenticated;
grant execute on function public.get_league_discipline_data(uuid) to authenticated;
grant execute on function public.get_league_club_discipline_data(uuid) to authenticated;
grant execute on function public.upsert_league_discipline_case(uuid,jsonb) to authenticated;
grant execute on function public.update_league_discipline_case_status(uuid,uuid,text,text) to authenticated;
grant execute on function public.add_league_case_event(uuid,uuid,jsonb) to authenticated;
grant execute on function public.upsert_league_case_charge(uuid,uuid,jsonb) to authenticated;
grant execute on function public.upsert_league_case_sanction(uuid,uuid,jsonb) to authenticated;
grant execute on function public.add_league_case_document(uuid,uuid,jsonb) to authenticated;
grant execute on function public.submit_league_case_response(uuid,uuid,jsonb) to authenticated;
grant execute on function public.submit_league_case_appeal(uuid,uuid,jsonb) to authenticated;
grant execute on function public.review_league_case_appeal(uuid,uuid,jsonb) to authenticated;

commit;
