-- Match src/lib/security/permissions.js's existing OPERATE_MATCHDAYS and
-- PUBLISH_MATCHWEEKS grants. Do not change the global role resolver or RLS.
create or replace function private.has_club_scheduling_authority(target_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.club_memberships membership
    join public.clubs club on club.id=membership.club_id
    where membership.club_id=target_club_id and membership.user_id=auth.uid()
      and membership.status='active' and club.status='active'
      and (
        membership.role = any(array['owner','admin','scheduler','fixture_officer','operations_officer'])
        or exists (
          select 1 from public.club_member_roles assignment
          where assignment.club_id=membership.club_id and assignment.user_id=membership.user_id
            and assignment.status='active' and assignment.scope_type='club'
            and assignment.role_code = any(array['fixture_officer','operations_officer'])
        )
      )
  );
$$;
revoke all on function private.has_club_scheduling_authority(uuid) from public,anon,authenticated;

create or replace function public.can_operate_club(target_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_club_scheduling_authority(target_club_id);
$$;
create or replace function public.can_publish_club_matchweek(target_club_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_club_scheduling_authority(target_club_id);
$$;
revoke all on function public.can_operate_club(uuid) from public,anon;
revoke all on function public.can_publish_club_matchweek(uuid) from public,anon;
grant execute on function public.can_operate_club(uuid) to authenticated;
grant execute on function public.can_publish_club_matchweek(uuid) to authenticated;
