-- Carry scoped club responsibilities through a secure single-use invitation.

alter table public.club_invitations
  add column if not exists responsibilities jsonb not null default '[]'::jsonb;

alter table public.club_invitations
  drop constraint if exists club_invitations_responsibilities_array;
alter table public.club_invitations
  add constraint club_invitations_responsibilities_array
  check (jsonb_typeof(responsibilities) = 'array');

-- The existing composite key requires a scope id. Use a stable internal value
-- for club-wide assignments while keeping the public scope type as "club".
alter table public.club_member_roles alter column scope_id set default '__club__';

create or replace function public.list_club_invitations(target_club_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
begin
  if not public.can_manage_club(target_club_id) then raise exception 'Club administrator access required' using errcode = '42501'; end if;
  update public.club_invitations set status = 'expired', updated_at = now()
  where club_id = target_club_id and status = 'pending' and expires_at <= now();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', invitation.id, 'email', invitation.email, 'role', invitation.role,
    'responsibilities', invitation.responsibilities, 'status', invitation.status,
    'expires_at', invitation.expires_at, 'created_at', invitation.created_at,
    'invited_by', invitation.invited_by) order by invitation.created_at desc)
    from public.club_invitations invitation where invitation.club_id = target_club_id
    and invitation.status in ('pending','expired')), '[]'::jsonb);
end; $$;

drop function if exists public.create_club_invitation(uuid, text, text, integer);
create function public.create_club_invitation(
  target_club_id uuid, invite_email text, invite_role text default 'viewer',
  expiry_hours integer default 72, invite_responsibilities jsonb default '[]'::jsonb
) returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare
  actor_id uuid := auth.uid(); actor_role text;
  safe_email text := lower(trim(coalesce(invite_email, '')));
  safe_role text := lower(trim(coalesce(invite_role, 'viewer')));
  safe_hours integer := greatest(1, least(coalesce(expiry_hours, 72), 168));
  safe_responsibilities jsonb := coalesce(invite_responsibilities, '[]'::jsonb);
  assignment jsonb; assignment_role text; assignment_scope text; assignment_scope_id text;
  invitation_id uuid; invitation_token text := encode(gen_random_bytes(32), 'hex');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner','admin') then raise exception 'Club administrator access required' using errcode = '42501'; end if;
  if position('@' in safe_email) <= 1 then raise exception 'A valid email address is required' using errcode = '22023'; end if;
  if safe_role not in ('admin','scheduler','viewer') then raise exception 'Unsupported invitation role' using errcode = '22023'; end if;
  if actor_role = 'admin' and safe_role = 'admin' then raise exception 'Only the club owner can invite another administrator' using errcode = '42501'; end if;
  if jsonb_typeof(safe_responsibilities) <> 'array' or jsonb_array_length(safe_responsibilities) > 20 then raise exception 'Invitation responsibilities must be an array of no more than 20 assignments' using errcode = '22023'; end if;
  for assignment in select value from jsonb_array_elements(safe_responsibilities) loop
    assignment_role := lower(trim(coalesce(assignment->>'role','')));
    assignment_scope := lower(trim(coalesce(assignment->>'scope_type','club')));
    assignment_scope_id := nullif(trim(assignment->>'scope_id'),'');
    if assignment_role not in ('chair','club_secretary','fixture_officer','operations_officer','treasurer','welfare_officer','communications_officer','coach','team_manager','volunteer') then raise exception 'Unsupported invitation responsibility' using errcode = '22023'; end if;
    if assignment_scope not in ('club','team','site') or (assignment_scope <> 'club' and assignment_scope_id is null) then raise exception 'Invalid invitation responsibility scope' using errcode = '22023'; end if;
  end loop;
  if exists (select 1 from public.club_memberships membership join public.user_profiles profile on profile.id = membership.user_id where membership.club_id = target_club_id and lower(profile.email) = safe_email and membership.status = 'active') then raise exception 'This person already has active club access' using errcode = '23505'; end if;
  update public.club_invitations set status='revoked', revoked_at=now(), updated_at=now() where club_id=target_club_id and lower(email)=safe_email and status='pending';
  insert into public.club_invitations(club_id,email,role,responsibilities,token_hash,invited_by,expires_at)
  values(target_club_id,safe_email,safe_role,safe_responsibilities,encode(digest(invitation_token,'sha256'),'hex'),actor_id,now()+make_interval(hours=>safe_hours)) returning id into invitation_id;
  perform private.write_audit_event(target_club_id,actor_id,'membership.invitation.create','club_invitation',invitation_id::text,jsonb_build_object('email',safe_email,'role',safe_role,'responsibilities',safe_responsibilities,'expiry_hours',safe_hours),'database');
  return jsonb_build_object('id',invitation_id,'token',invitation_token,'email',safe_email,'role',safe_role,'responsibilities',safe_responsibilities,'expires_at',now()+make_interval(hours=>safe_hours));
end; $$;

create or replace function public.accept_club_invitation(invitation_token text)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off as $$
declare actor_id uuid := auth.uid(); actor_email text; invitation public.club_invitations%rowtype;
begin
  if actor_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(profile.email) into actor_email from public.user_profiles profile where profile.id=actor_id;
  select invitation_row.* into invitation from public.club_invitations invitation_row where invitation_row.token_hash=encode(digest(trim(coalesce(invitation_token,'')),'sha256'),'hex') for update;
  if invitation.id is null then raise exception 'Invitation link is invalid' using errcode = 'P0002'; end if;
  if invitation.status <> 'pending' then raise exception 'Invitation is no longer available' using errcode = '42501'; end if;
  if invitation.expires_at <= now() then update public.club_invitations set status='expired',updated_at=now() where id=invitation.id; raise exception 'Invitation has expired' using errcode = '42501'; end if;
  if actor_email is null or actor_email <> lower(invitation.email) then raise exception 'Sign in with the email address that received this invitation' using errcode = '42501'; end if;
  insert into public.club_memberships(club_id,user_id,role,status,created_by) values(invitation.club_id,actor_id,invitation.role,'active',invitation.invited_by)
  on conflict(club_id,user_id) do update set role=excluded.role,status='active',updated_at=now();
  insert into public.club_member_roles(club_id,user_id,role_code,scope_type,scope_id,status,created_by)
  select invitation.club_id,actor_id,lower(trim(item->>'role')),lower(trim(coalesce(item->>'scope_type','club'))),case when lower(trim(coalesce(item->>'scope_type','club')))='club' then '__club__' else nullif(trim(item->>'scope_id'),'') end,'active',invitation.invited_by
  from jsonb_array_elements(invitation.responsibilities) item
  on conflict(club_id,user_id,role_code,scope_type,scope_id) do update set status='active',updated_at=now(),created_by=excluded.created_by;
  update public.club_invitations set status='accepted',accepted_by=actor_id,accepted_at=now(),updated_at=now() where id=invitation.id;
  perform private.write_audit_event(invitation.club_id,actor_id,'membership.invitation.accept','club_membership',actor_id::text,jsonb_build_object('role',invitation.role,'responsibilities',invitation.responsibilities,'invitation_id',invitation.id),'database');
  return jsonb_build_object('club_id',invitation.club_id,'role',invitation.role,'responsibilities',invitation.responsibilities);
end; $$;

revoke all on function public.create_club_invitation(uuid,text,text,integer,jsonb) from public, anon, authenticated;
grant execute on function public.create_club_invitation(uuid,text,text,integer,jsonb) to authenticated;
