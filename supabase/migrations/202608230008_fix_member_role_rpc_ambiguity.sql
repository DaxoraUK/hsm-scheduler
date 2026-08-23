-- Remove PostgreSQL name ambiguity from the multi-role administration RPCs.

create or replace function public.add_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  role_code text,
  scope_type text default 'club',
  scope_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  safe_role text := lower(trim(coalesce(role_code, '')));
  safe_scope text := lower(trim(coalesce(scope_type, 'club')));
  safe_scope_id text := nullif(trim(scope_id), '');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then raise exception 'Club administrator access required' using errcode = '42501'; end if;
  if safe_role not in ('chair','club_secretary','fixture_officer','operations_officer','treasurer','welfare_officer','communications_officer','coach','team_manager','volunteer') then raise exception 'Unsupported additional role' using errcode = '22023'; end if;
  if safe_scope not in ('club','team','site') then raise exception 'Unsupported role scope' using errcode = '22023'; end if;
  if safe_scope <> 'club' and safe_scope_id is null then raise exception 'A team or site scope requires a scope identifier' using errcode = '22023'; end if;
  if not exists (select 1 from public.club_memberships membership where membership.club_id = target_club_id and membership.user_id = target_user_id and membership.status = 'active') then raise exception 'Active club member not found' using errcode = 'P0002'; end if;

  insert into public.club_member_roles (club_id,user_id,role_code,scope_type,scope_id,status,created_by)
  values (target_club_id,target_user_id,safe_role,safe_scope,safe_scope_id,'active',actor_id)
  on conflict on constraint club_member_roles_pkey
  do update set status = 'active', updated_at = now(), created_by = excluded.created_by;

  perform private.write_audit_event(target_club_id,actor_id,'membership.additional_role.add','club_member_role',target_user_id::text,jsonb_build_object('role',safe_role,'scope_type',safe_scope,'scope_id',safe_scope_id),'database');
  return jsonb_build_object('club_id',target_club_id,'user_id',target_user_id,'role',safe_role,'scope_type',safe_scope,'scope_id',safe_scope_id);
end;
$$;

create or replace function public.remove_club_member_role(
  target_club_id uuid,
  target_user_id uuid,
  role_code text,
  scope_type text default 'club',
  scope_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  safe_role text := lower(trim(coalesce(role_code, '')));
  safe_scope text := lower(trim(coalesce(scope_type, 'club')));
  safe_scope_id text := nullif(trim(scope_id), '');
begin
  actor_role := private.current_actor_role(target_club_id, actor_id);
  if actor_role not in ('owner', 'admin') then raise exception 'Club administrator access required' using errcode = '42501'; end if;
  if safe_role = '' then raise exception 'Role is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.club_member_roles member_role where member_role.club_id = target_club_id and member_role.user_id = target_user_id and member_role.role_code = safe_role and member_role.scope_type = safe_scope and member_role.scope_id is not distinct from safe_scope_id and member_role.status = 'active') then raise exception 'Additional role assignment not found' using errcode = 'P0002'; end if;

  update public.club_member_roles as member_role
  set status = 'revoked', updated_at = now()
  where member_role.club_id = target_club_id
    and member_role.user_id = target_user_id
    and member_role.role_code = safe_role
    and member_role.scope_type = safe_scope
    and member_role.scope_id is not distinct from safe_scope_id;

  perform private.write_audit_event(target_club_id,actor_id,'membership.additional_role.remove','club_member_role',target_user_id::text,jsonb_build_object('role',safe_role,'scope_type',safe_scope,'scope_id',safe_scope_id),'database');
end;
$$;

revoke all on function public.add_club_member_role(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.remove_club_member_role(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.add_club_member_role(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.remove_club_member_role(uuid, uuid, text, text, text) to authenticated;

notify pgrst, 'reload schema';
