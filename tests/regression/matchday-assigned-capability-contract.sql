-- Dedicated staging only. Membership/role changes never commit.
begin;
do $$
declare club uuid := 'ce481c32-be1e-4db1-ba58-7ed923e3c81a'; actor uuid;
begin
  select user_id into actor from public.club_memberships where club_id=club and role='scheduler' and status='active' limit 1;
  assert actor is not null, 'Active staging scheduler required';
  perform set_config('request.jwt.claim.sub',actor::text,true);
  update public.club_memberships set role='viewer' where club_id=club and user_id=actor;
  insert into public.club_member_roles(club_id,user_id,role_code,scope_type,scope_id,status)
    values(club,actor,'fixture_officer','club','','active')
    on conflict(club_id,user_id,role_code,scope_type,scope_id) do update set status='active';
  assert public.can_operate_club(club), 'Assigned Fixture Officer scheduling capability was ignored';
  assert public.can_publish_club_matchweek(club), 'Assigned Fixture Officer publishing capability was ignored';
  assert not public.can_operate_club('00000000-0000-0000-0000-000000000001'), 'Cross-club authority';
  update public.club_member_roles set status='revoked' where club_id=club and user_id=actor;
  assert not public.can_operate_club(club), 'Revoked assignment still grants scheduling';
  assert not public.can_publish_club_matchweek(club), 'Revoked assignment still grants publishing';
  update public.club_memberships set role='admin' where club_id=club and user_id=actor;
  assert public.can_operate_club(club), 'Admin scheduling denied';
  update public.club_memberships set status='revoked' where club_id=club and user_id=actor;
  assert not public.can_operate_club(club), 'Inactive membership still grants scheduling';
end; $$;
rollback;
