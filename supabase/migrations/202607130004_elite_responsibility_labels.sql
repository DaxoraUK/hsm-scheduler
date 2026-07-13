-- Daxora Ground Control: expose safe member labels for Elite site responsibility
-- boards without leaking raw authentication identifiers into the interface.

begin;

create or replace function public.list_elite_site_responsibilities(target_club_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.can_read_club(target_club_id)
     or not private.club_has_entitlement(target_club_id, 'site_responsibility') then
    raise exception 'Elite site responsibility access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', responsibility.id,
        'club_id', responsibility.club_id,
        'site_id', responsibility.site_id,
        'user_id', responsibility.user_id,
        'display_name', nullif(trim(profile.display_name), ''),
        'email', nullif(trim(profile.email), ''),
        'responsibility', responsibility.responsibility,
        'active', responsibility.active,
        'created_at', responsibility.created_at,
        'updated_at', responsibility.updated_at
      ) order by responsibility.site_id asc, responsibility.created_at asc
    )
    from public.elite_site_responsibilities responsibility
    left join public.user_profiles profile on profile.id = responsibility.user_id
    where responsibility.club_id = target_club_id
      and responsibility.active = true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_elite_site_responsibilities(uuid) from public, anon, authenticated;
grant execute on function public.list_elite_site_responsibilities(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
